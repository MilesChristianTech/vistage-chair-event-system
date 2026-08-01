'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser, getTenantSettings, getMailboxConnection } from '@/lib/tenant';
import { getPaceSpanMs, buildSendSchedule, type PaceProfile } from '@/lib/pacing';
import { distributeVariants } from '@/lib/variant-distribution';
import { resolveGreetingName, resolveMergeFields, plainTextToHtml, appendCalendarLinkIfRelevant } from '@/lib/merge-fields';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

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

export interface PreflightStatus {
  mailboxReady: boolean;
  mailboxMessage: string;
  messageApproved: boolean;
  formReady: boolean;
  eventFactsComplete: boolean;
  missingFacts: string[];
  recipientCount: number;
  isDemo: boolean;
  blockers: string[];
}

/** Whether a job of this type for this event is still running or paused —
 * nothing previously stopped a Host from starting a second one on top of it,
 * which would independently re-target the same not-yet-sent recipients and
 * risk sending the same message to the same person twice. */
async function getActiveJobForType(eventId: string, jobType: SendJobType) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('send_jobs')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('job_type', jobType)
    .in('status', ['running', 'paused'])
    .maybeSingle();
  return data;
}

/** Part 7.7: "Before a send can start, the app verifies..." */
export async function getPreflightStatusAction(eventId: string, jobType: SendJobType): Promise<PreflightStatus> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const [{ data: tenant }, mailbox, { data: event }, { data: message }, { data: form }, recipients, activeJob] = await Promise.all([
    supabase.from('tenants').select('is_demo').eq('id', appUser.tenant_id).single(),
    getMailboxConnection(appUser.tenant_id),
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('messages').select('id, is_approved, body').eq('event_id', eventId).eq('message_type', jobType).maybeSingle(),
    supabase.from('forms').select('is_published').eq('event_id', eventId).single(),
    getRecipientCandidates(eventId, jobType),
    getActiveJobForType(eventId, jobType),
  ]);

  const isDemo = tenant?.is_demo ?? false;
  const missingFacts: string[] = [];
  if (event) {
    if (!event.starts_at) missingFacts.push('Date & time');
    if (!event.is_virtual && !event.venue_name) missingFacts.push('Venue');
    if (event.is_virtual && !event.virtual_link) missingFacts.push('Virtual link');
    if (!event.rsvp_deadline && jobType === 'invitation') missingFacts.push('RSVP deadline');
  }

  const mailboxReady = isDemo || mailbox?.status === 'connected';
  const mailboxMessage = isDemo
    ? 'Demo tenant — sending is simulated, no real email will be sent.'
    : mailbox?.status === 'connected'
      ? `Connected as ${mailbox.connected_email}`
      : mailbox?.status === 'needs_reconnect'
        ? 'Your connection needs to be refreshed before sending.'
        : mailbox?.status === 'throttled'
          ? 'Microsoft has temporarily throttled this mailbox.'
          : 'Your email is not connected yet.';

  const blockers: string[] = [];
  if (activeJob) {
    blockers.push(
      `A send of this message is already ${activeJob.status} for this event — check Send history to pause, resume, or cancel it before starting another.`
    );
  }
  if (!mailboxReady) blockers.push(mailboxMessage);
  if (!message?.is_approved) blockers.push('This message has not been approved yet — approve it in Compose first.');
  if (jobType === 'invitation' && !form?.is_published) blockers.push('Your RSVP form is not published yet.');
  if (missingFacts.length > 0) blockers.push(`Missing event details: ${missingFacts.join(', ')}.`);
  if (recipients.length === 0) blockers.push('There is no one to send to right now.');

  return {
    mailboxReady,
    mailboxMessage,
    messageApproved: Boolean(message?.is_approved),
    formReady: Boolean(form?.is_published),
    eventFactsComplete: missingFacts.length === 0,
    missingFacts,
    recipientCount: recipients.length,
    isDemo,
    blockers,
  };
}

/** Which invitations are eligible for a given message type — Part 7.7,
 * "add-on sends only go to the newly added, never re-sending to those
 * already invited." */
async function getRecipientCandidates(eventId: string, jobType: SendJobType) {
  const supabase = await createClient();

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

export interface CreateSendJobResult extends ActionResult {
  jobId?: string;
}

export async function createSendJobAction(params: {
  eventId: string;
  jobType: SendJobType;
  paceProfile: PaceProfile;
}): Promise<CreateSendJobResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { eventId, jobType, paceProfile } = params;

  const [{ data: tenant }, { data: event }, { data: message }, { data: form }, tenantSettings, candidates, activeJob] = await Promise.all([
    supabase.from('tenants').select('is_demo').eq('id', appUser.tenant_id).single(),
    supabase.from('events').select('public_title').eq('id', eventId).single(),
    supabase.from('messages').select('id, subject, body, is_approved').eq('event_id', eventId).eq('message_type', jobType).single(),
    supabase.from('forms').select('public_token').eq('event_id', eventId).single(),
    getTenantSettings(appUser.tenant_id),
    getRecipientCandidates(eventId, jobType),
    getActiveJobForType(eventId, jobType),
  ]);

  // Re-checked here (not just in the preflight status the UI reads before
  // showing the Send button) since preflight could be stale by the time this
  // actually runs — without this, a second job for the same type would
  // independently re-target the same not-yet-sent recipients as the first,
  // risking the same message going out to the same person twice.
  if (activeJob) {
    return {
      ok: false,
      error: `A send of this message is already ${activeJob.status} for this event. Cancel or wait for it to finish before starting another.`,
    };
  }
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
  // a preview session — see lib/preview/simulate-worker.ts.
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
      tenant_id: appUser.tenant_id,
      event_id: eventId,
      message_id: message.id,
      job_type: jobType,
      pace_profile: paceProfile,
      status: 'running',
      total_recipients: candidates.length,
      is_simulated: isSimulated,
      created_by: appUser.id,
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
      tenant_id: appUser.tenant_id,
      send_job_id: job.id,
      invitation_id: inv.id,
      message_variant_id: variant?.id ?? null,
      resolved_subject: resolveMergeFields(subjectTemplate, mergeCtx),
      resolved_body: plainTextToHtml(resolvedBody),
      scheduled_at: (schedule[idx] ?? new Date()).toISOString(),
    };
  });

  const { error: recipientsError } = await supabase.from('send_job_recipients').insert(recipientRows);
  if (recipientsError) return { ok: false, error: recipientsError.message };

  revalidatePath(`/events/${eventId}`, 'layout');
  return { ok: true, jobId: job.id };
}

export interface SendJobProgress {
  id: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  nextScheduledAt: string | null;
  estimatedFinishAt: string | null;
}

export async function getSendJobProgressAction(jobId: string): Promise<SendJobProgress | null> {
  const supabase = await createClient();

  // PREVIEW_MODE: no separate worker process is running alongside this dev
  // server, so simulate its core behavior right here — see
  // lib/preview/simulate-worker.ts for why this is safe and why it's never
  // reached in a real deployment.
  if (process.env.PREVIEW_MODE === 'true') {
    const { advanceSimulatedSendJob } = await import('@/lib/preview/simulate-worker');
    advanceSimulatedSendJob(jobId);
  }

  const { data: job } = await supabase.from('send_jobs').select('*').eq('id', jobId).single();
  if (!job) return null;

  const { data: nextUp } = await supabase
    .from('send_job_recipients')
    .select('scheduled_at')
    .eq('send_job_id', jobId)
    .eq('status', 'queued')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: lastScheduled } = await supabase
    .from('send_job_recipients')
    .select('scheduled_at')
    .eq('send_job_id', jobId)
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: job.id,
    status: job.status,
    totalRecipients: job.total_recipients,
    sentCount: job.sent_count,
    failedCount: job.failed_count,
    nextScheduledAt: nextUp?.scheduled_at ?? null,
    estimatedFinishAt: lastScheduled?.scheduled_at ?? null,
  };
}

export async function getActiveSendJobsAction(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('send_jobs')
    .select('id, job_type, status, total_recipients, sent_count, failed_count, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function pauseSendJobAction(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('send_jobs').update({ status: 'paused' }).eq('id', jobId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function resumeSendJobAction(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('send_jobs').update({ status: 'running' }).eq('id', jobId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cancelSendJobAction(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.from('send_job_recipients').update({ status: 'cancelled' }).eq('send_job_id', jobId).eq('status', 'queued');
  const { error } = await supabase.from('send_jobs').update({ status: 'cancelled' }).eq('id', jobId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
