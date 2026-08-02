import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getTenantSettings } from '@/lib/tenant';
import { getPaceSpanMs, buildSendSchedule, type PaceProfile } from '@/lib/pacing';
import { distributeVariants } from '@/lib/variant-distribution';
import { resolveGreetingName, resolveMergeFields, plainTextToHtml, appendCalendarLinkIfRelevant } from '@/lib/merge-fields';

export type SendJobType =
  | 'invitation'
  | 'reminder'
  | 'priority_follow_up'
  | 'rsvp_confirmation'
  | 'final_details'
  | 'waitlist'
  | 'cancellation'
  | 'thank_you'
  | 'post_event_follow_up';

export interface CreateSendJobResult {
  ok: boolean;
  error?: string;
  jobId?: string;
}

/** Which invitations are eligible for a given message type - Part 7.7,
 * "add-on sends only go to the newly added, never re-sending to those
 * already invited." Parameterized on the Supabase client so it works both
 * from a Host's authenticated session and from the service-role client used
 * by the auto-scheduling cron. */
export async function getRecipientCandidates(
  supabase: SupabaseClient<Database>,
  eventId: string,
  jobType: SendJobType
) {
  let query = supabase
    .from('invitations')
    .select('id, invite_status, rsvp_status, attendance_status, people!inner(email, contact_preference)')
    .eq('event_id', eventId)
    .neq('people.contact_preference', 'do_not_contact')
    .not('people.email', 'is', null);

  if (jobType === 'invitation') {
    query = query.in('invite_status', ['planned', 'ready']);
  } else if (jobType === 'reminder' || jobType === 'priority_follow_up') {
    query = query.eq('invite_status', 'sent').eq('rsvp_status', 'no_response');
  } else if (jobType === 'rsvp_confirmation') {
    query = query.eq('rsvp_status', 'yes');
  } else if (jobType === 'final_details') {
    query = query.in('rsvp_status', ['yes']);
  } else if (jobType === 'waitlist') {
    query = query.eq('rsvp_status', 'waitlisted');
  } else if (jobType === 'thank_you') {
    query = query.eq('attendance_status', 'attended');
  } else if (jobType === 'post_event_follow_up') {
    query = query.in('rsvp_status', ['no', 'no_response']);
  } else if (jobType === 'cancellation') {
    query = query.in('invite_status', ['sent']);
  }

  const { data } = await query;
  return data ?? [];
}

/** Whether a job of this type for this event is already running or paused -
 * without this check, a second job would independently re-target the same
 * not-yet-sent recipients as the first, risking the same message going out
 * to the same person twice. */
export async function getActiveJobForType(supabase: SupabaseClient<Database>, eventId: string, jobType: SendJobType) {
  const { data } = await supabase
    .from('send_jobs')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('job_type', jobType)
    .in('status', ['running', 'paused'])
    .maybeSingle();
  return data;
}

/** The actual job-creation pipeline - resolve candidates, freeze merge
 * fields per recipient, build the send schedule, write send_jobs +
 * send_job_recipients. Shared by the Host's manual "Send" button
 * (session-scoped client, createdBy = the Host) and the auto-scheduling
 * cron (service-role client, createdBy = null, called with no Host
 * present). Callers are responsible for their own approval/active-job
 * checks appropriate to their context. */
export async function createSendJobCore(
  supabase: SupabaseClient<Database>,
  params: { tenantId: string; createdBy: string | null; eventId: string; jobType: SendJobType; paceProfile: PaceProfile }
): Promise<CreateSendJobResult> {
  const { tenantId, createdBy, eventId, jobType, paceProfile } = params;

  const [{ data: tenant }, { data: event }, { data: message }, { data: form }, tenantSettings, candidates] = await Promise.all([
    supabase.from('tenants').select('is_demo').eq('id', tenantId).single(),
    supabase.from('events').select('public_title').eq('id', eventId).single(),
    supabase.from('messages').select('id, subject, body, attachment_urls, is_approved').eq('event_id', eventId).eq('message_type', jobType).single(),
    supabase.from('forms').select('public_token').eq('event_id', eventId).single(),
    getTenantSettings(tenantId),
    getRecipientCandidates(supabase, eventId, jobType),
  ]);

  if (!message?.is_approved) return { ok: false, error: 'Approve this message before sending.' };
  if (candidates.length === 0) return { ok: false, error: 'There is no one to send to right now.' };

  const { data: fullInvitations } = await supabase
    .from('invitations')
    .select('id, public_token, personalization_note, people(first_name, last_name, preferred_name, email)')
    .in(
      'id',
      candidates.map((c) => c.id)
    );

  const variants = jobType === 'invitation'
    ? (await supabase.from('message_variants').select('*').eq('message_id', message.id).eq('is_active', true).order('variant_index')).data ?? []
    : [];

  const isSimulated = tenant?.is_demo ?? false;
  // PREVIEW_MODE: compress real pacing (minutes-to-days) down to a handful
  // of seconds so clicking "Send" is actually watchable in a demo, instead
  // of looking stalled for the length of a real send. Never applies outside
  // a preview session - see lib/preview/simulate-worker.ts.
  const spanMs =
    process.env.PREVIEW_MODE === 'true'
      ? Math.min(20_000, Math.max(4_000, candidates.length * 1_500))
      : getPaceSpanMs(paceProfile, candidates.length);
  const schedule = buildSendSchedule({ recipientCount: candidates.length, spanMs });

  const variantAssignment =
    variants.length > 0 ? distributeVariants(candidates.map((c) => c.id), variants) : new Map<string, (typeof variants)[number]>();

  const { data: job, error: jobError } = await supabase
    .from('send_jobs')
    .insert({
      tenant_id: tenantId,
      event_id: eventId,
      message_id: message.id,
      job_type: jobType,
      pace_profile: paceProfile,
      status: 'running',
      total_recipients: candidates.length,
      is_simulated: isSimulated,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (jobError || !job) return { ok: false, error: jobError?.message ?? 'Could not start the send.' };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  const recipientRows = (fullInvitations ?? []).map((inv, idx) => {
    const person = Array.isArray(inv.people) ? inv.people[0] : inv.people;
    const variant = variantAssignment.get(inv.id);
    const subjectTemplate = variant?.subject ?? message.subject ?? '';
    const bodyTemplate = variant?.body ?? message.body;

    const formLink = form ? `${appUrl}/r/${form.public_token}?i=${inv.public_token}` : '';
    const calendarLink = form ? `${appUrl}/api/public/calendar/${form.public_token}` : null;

    const mergeCtx = {
      greetingName: person ? resolveGreetingName({ preferredName: person.preferred_name, firstName: person.first_name }) : 'there',
      eventPublicTitle: event?.public_title ?? '',
      formLink,
      calendarLink: calendarLink ?? '',
      hostDisplayName: tenantSettings?.host_display_name ?? '',
      hostSignature: tenantSettings?.host_signature ?? tenantSettings?.host_display_name ?? '',
      personalTouch: jobType === 'invitation' ? inv.personalization_note : null,
    };

    const resolvedBody = appendCalendarLinkIfRelevant(resolveMergeFields(bodyTemplate, mergeCtx), jobType, calendarLink);

    return {
      tenant_id: tenantId,
      send_job_id: job.id,
      invitation_id: inv.id,
      message_variant_id: variant?.id ?? null,
      resolved_subject: resolveMergeFields(subjectTemplate, mergeCtx),
      resolved_body: plainTextToHtml(resolvedBody),
      attachment_urls: message.attachment_urls ?? [],
      scheduled_at: (schedule[idx] ?? new Date()).toISOString(),
    };
  });

  const { error: recipientsError } = await supabase.from('send_job_recipients').insert(recipientRows);
  if (recipientsError) return { ok: false, error: recipientsError.message };

  return { ok: true, jobId: job.id };
}
