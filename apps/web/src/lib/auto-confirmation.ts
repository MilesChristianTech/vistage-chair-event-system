import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { resolveGreetingName, resolveMergeFields, plainTextToHtml, appendCalendarLinkIfRelevant } from '@/lib/merge-fields';

/**
 * Fires the moment someone RSVPs "yes" on the public form (Part 7's
 * rsvp_confirmation message is meant to go out "immediately" — unlike every
 * other message type, which the Host triggers manually as a batch from the
 * Send page). Uses the service-role client since it runs from the
 * unauthenticated public submit route. Silently no-ops if there's no
 * approved rsvp_confirmation message yet, or if one's already queued for
 * this invitation (a form can be resubmitted).
 */
export async function queueAutomaticRsvpConfirmation(
  supabase: SupabaseClient<Database>,
  params: { tenantId: string; eventId: string; invitationId: string }
) {
  const { tenantId, eventId, invitationId } = params;

  const { data: message } = await supabase
    .from('messages')
    .select('id, subject, body, attachment_urls, is_approved')
    .eq('event_id', eventId)
    .eq('message_type', 'rsvp_confirmation')
    .maybeSingle();

  if (!message?.is_approved || !message.body) return;

  const { data: alreadyQueued } = await supabase
    .from('send_job_recipients')
    .select('id, send_jobs!inner(message_id)')
    .eq('invitation_id', invitationId)
    .eq('send_jobs.message_id', message.id)
    .in('status', ['queued', 'sent'])
    .limit(1)
    .maybeSingle();

  if (alreadyQueued) return;

  const [{ data: tenant }, { data: event }, { data: tenantSettings }, { data: form }, { data: invitation }] = await Promise.all([
    supabase.from('tenants').select('is_demo').eq('id', tenantId).single(),
    supabase.from('events').select('public_title').eq('id', eventId).single(),
    supabase.from('tenant_settings').select('host_display_name, host_signature').eq('tenant_id', tenantId).single(),
    supabase.from('forms').select('public_token').eq('event_id', eventId).single(),
    supabase
      .from('invitations')
      .select('id, public_token, people(first_name, preferred_name, email)')
      .eq('id', invitationId)
      .single(),
  ]);

  const person = invitation ? (Array.isArray(invitation.people) ? invitation.people[0] : invitation.people) : null;
  if (!person?.email) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const formLink = form && invitation ? `${appUrl}/r/${form.public_token}?i=${invitation.public_token}` : '';
  const calendarLink = form ? `${appUrl}/api/public/calendar/${form.public_token}` : null;

  const mergeCtx = {
    greetingName: resolveGreetingName({ preferredName: person.preferred_name, firstName: person.first_name }),
    eventPublicTitle: event?.public_title ?? '',
    formLink,
    calendarLink: calendarLink ?? '',
    hostDisplayName: tenantSettings?.host_display_name ?? '',
    hostSignature: tenantSettings?.host_signature ?? tenantSettings?.host_display_name ?? '',
  };

  const resolvedBody = appendCalendarLinkIfRelevant(resolveMergeFields(message.body, mergeCtx), 'rsvp_confirmation', calendarLink);

  const { data: job, error: jobError } = await supabase
    .from('send_jobs')
    .insert({
      tenant_id: tenantId,
      event_id: eventId,
      message_id: message.id,
      job_type: 'rsvp_confirmation',
      pace_profile: 'immediate',
      status: 'running',
      total_recipients: 1,
      is_simulated: tenant?.is_demo ?? false,
      created_by: null,
    })
    .select('id')
    .single();

  if (jobError || !job) {
    console.error('[auto-confirmation] could not create send job:', jobError?.message);
    return;
  }

  const { error: recipientError } = await supabase.from('send_job_recipients').insert({
    tenant_id: tenantId,
    send_job_id: job.id,
    invitation_id: invitationId,
    message_variant_id: null,
    resolved_subject: resolveMergeFields(message.subject ?? '', mergeCtx),
    resolved_body: plainTextToHtml(resolvedBody),
    attachment_urls: message.attachment_urls ?? [],
    scheduled_at: new Date().toISOString(),
  });

  if (recipientError) {
    console.error('[auto-confirmation] could not queue recipient:', recipientError.message);
  }
}
