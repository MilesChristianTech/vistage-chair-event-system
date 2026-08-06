'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser, getMailboxConnection, getTenantSettings } from '@/lib/tenant';
import type { PaceProfile } from '@/lib/pacing';
import {
  getRecipientCandidates,
  getActiveJobForType,
  createSendJobCore,
  type SendJobType,
  type CreateSendJobResult,
} from '@/lib/send-job-core';
import { resolveGreetingName, resolveMergeFields, plainTextToHtml, appendCalendarLinkIfRelevant } from '@/lib/merge-fields';
import { getFormPreviewData, type PublicFormData } from '@/lib/public-form';

export async function getFormPreviewAction(eventId: string): Promise<PublicFormData | null> {
  return getFormPreviewData(eventId);
}

export interface RecipientPreview {
  invitationId: string;
  name: string;
  email: string | null;
}

/** The actual people this particular send will reach, one level narrower
 * than the event's whole invitee list (Part 7.7's per-type targeting - a
 * reminder only goes to non-responders, a thank-you only to attendees,
 * etc.) - so the Host can see exactly who's about to get this message and
 * uncheck anyone who doesn't need it, without changing the event's invitees. */
export async function getRecipientPreviewAction(eventId: string, jobType: SendJobType): Promise<RecipientPreview[]> {
  const supabase = await createClient();
  const candidates = await getRecipientCandidates(supabase, eventId, jobType);
  return candidates.map((c) => {
    const person = Array.isArray(c.people) ? c.people[0] : c.people;
    return {
      invitationId: c.id,
      name: person ? `${person.first_name} ${person.last_name}` : 'Unknown',
      email: person?.email ?? null,
    };
  });
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export type { SendJobType };

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
    getRecipientCandidates(supabase, eventId, jobType),
    getActiveJobForType(supabase, eventId, jobType),
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
    ? 'Demo tenant - sending is simulated, no real email will be sent.'
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
      `A send of this message is already ${activeJob.status} for this event - check Send history to pause, resume, or cancel it before starting another.`
    );
  }
  if (!mailboxReady) blockers.push(mailboxMessage);
  if (!message?.is_approved) blockers.push('This message has not been approved yet - approve it in Compose first.');
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

export type { CreateSendJobResult };

export async function createSendJobAction(params: {
  eventId: string;
  jobType: SendJobType;
  paceProfile: PaceProfile;
  excludeInvitationIds?: string[];
}): Promise<CreateSendJobResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { eventId, jobType, paceProfile, excludeInvitationIds } = params;

  // Re-checked here (not just in the preflight status the UI reads before
  // showing the Send button) since preflight could be stale by the time this
  // actually runs - without this, a second job for the same type would
  // independently re-target the same not-yet-sent recipients as the first,
  // risking the same message going out to the same person twice.
  const activeJob = await getActiveJobForType(supabase, eventId, jobType);
  if (activeJob) {
    return {
      ok: false,
      error: `A send of this message is already ${activeJob.status} for this event. Cancel or wait for it to finish before starting another.`,
    };
  }

  const result = await createSendJobCore(supabase, {
    tenantId: appUser.tenant_id,
    createdBy: appUser.id,
    eventId,
    jobType,
    paceProfile,
    excludeInvitationIds,
  });

  if (result.ok) revalidatePath(`/events/${eventId}`, 'layout');
  return result;
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
  // server, so simulate its core behavior right here - see
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

export interface MessagePreview {
  subject: string;
  htmlBody: string;
  recipientName: string;
  recipientEmail: string | null;
  fromEmail: string | null;
  isSampleRecipient: boolean;
  attachments: { name: string; url: string }[];
}

/** Exactly the same resolution pipeline createSendJobCore uses at actual
 * send time (same merge-field context, same calendar-link append, same
 * HTML conversion) - so what a Host previews here is a genuine replica of
 * what a recipient will receive, not an approximation. Uses a real,
 * currently-eligible recipient when one exists so names/links are real;
 * falls back to a generic placeholder person if the list is empty (nobody
 * to preview against yet shouldn't block seeing how the message reads). */
export async function getMessagePreviewAction(eventId: string, jobType: SendJobType): Promise<MessagePreview | null> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const [{ data: event }, { data: message }, { data: form }, tenantSettings, mailbox, candidates] = await Promise.all([
    supabase.from('events').select('public_title').eq('id', eventId).single(),
    supabase.from('messages').select('id, subject, body, attachment_urls').eq('event_id', eventId).eq('message_type', jobType).maybeSingle(),
    supabase.from('forms').select('public_token').eq('event_id', eventId).single(),
    getTenantSettings(appUser.tenant_id),
    getMailboxConnection(appUser.tenant_id),
    getRecipientCandidates(supabase, eventId, jobType),
  ]);

  if (!message?.body) return null;

  let sampleInvitation: {
    id: string;
    public_token: string;
    personalization_note: string | null;
    people:
      | { first_name: string; last_name: string; preferred_name: string | null; email: string | null }
      | { first_name: string; last_name: string; preferred_name: string | null; email: string | null }[]
      | null;
  } | null = null;

  const firstCandidate = candidates[0];
  if (firstCandidate) {
    const { data } = await supabase
      .from('invitations')
      .select('id, public_token, personalization_note, people(first_name, last_name, preferred_name, email)')
      .eq('id', firstCandidate.id)
      .single();
    sampleInvitation = data;
  }

  const person = sampleInvitation
    ? Array.isArray(sampleInvitation.people)
      ? sampleInvitation.people[0]
      : sampleInvitation.people
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const formLink =
    form && sampleInvitation ? `${appUrl}/r/${form.public_token}?i=${sampleInvitation.public_token}` : form ? `${appUrl}/r/${form.public_token}` : '';
  const calendarLink = form ? `${appUrl}/api/public/calendar/${form.public_token}` : null;

  const mergeCtx = {
    greetingName: person ? resolveGreetingName({ preferredName: person.preferred_name, firstName: person.first_name }) : 'Alex',
    eventPublicTitle: event?.public_title ?? '',
    formLink,
    calendarLink: calendarLink ?? '',
    hostDisplayName: tenantSettings?.host_display_name ?? '',
    hostSignature: tenantSettings?.host_signature ?? tenantSettings?.host_display_name ?? '',
    personalTouch: jobType === 'invitation' ? sampleInvitation?.personalization_note : null,
  };

  const resolvedBody = appendCalendarLinkIfRelevant(resolveMergeFields(message.body, mergeCtx), jobType, calendarLink);

  return {
    subject: resolveMergeFields(message.subject ?? '', mergeCtx),
    htmlBody: plainTextToHtml(resolvedBody),
    recipientName: person ? `${person.first_name} ${person.last_name}` : 'Alex Morgan',
    recipientEmail: person?.email ?? (sampleInvitation ? null : 'alex.morgan@example.com'),
    fromEmail: mailbox?.connected_email ?? null,
    isSampleRecipient: !sampleInvitation,
    attachments: (message.attachment_urls as { name: string; url: string }[] | null) ?? [],
  };
}
