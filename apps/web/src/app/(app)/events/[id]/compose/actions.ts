'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { formatEventDateTime, formatDeadline } from '@/lib/datetime';
import { requireCurrentUser, getTenantSettings } from '@/lib/tenant';
import {
  generateInvitationDraft,
  refineDraft,
  strengthenDraft,
  generateMessageSuite,
  generateVariants,
  generateHandwrittenTouch,
  type EventContext,
  type SuiteMessageKey,
} from '@/lib/coach';
import { AnthropicNotConfiguredError } from '@/lib/anthropic';
import type { Database, Json } from '@/lib/database.types';

type MessageType = Database['public']['Tables']['messages']['Row']['message_type'];

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function buildEventContext(eventId: string, tenantId: string): Promise<EventContext> {
  const supabase = await createClient();
  const [{ data: event }, tenantSettings, { data: form }] = await Promise.all([
    supabase.from('events').select('*, event_types(label)').eq('id', eventId).single(),
    getTenantSettings(tenantId),
    supabase.from('forms').select('public_token').eq('event_id', eventId).single(),
  ]);

  if (!event) throw new Error('Event not found.');

  const eventTypeLabel = Array.isArray(event.event_types)
    ? (event.event_types[0] as { label: string } | undefined)?.label
    : (event.event_types as { label: string } | null)?.label;

  const venueLine = event.is_virtual
    ? event.virtual_link
      ? `Virtual — ${event.virtual_link}`
      : 'Virtual (link to be added)'
    : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || null;

  return {
    publicTitle: event.public_title,
    eventTypeLabel: eventTypeLabel ?? 'Event',
    purpose: event.purpose,
    audienceDescription: event.audience_description,
    valueProposition: event.value_proposition,
    speakerDetails: event.speaker_details,
    startsAtFormatted: formatEventDateTime(event.starts_at, event.time_zone),
    venueLine,
    rsvpDeadlineFormatted: formatDeadline(event.rsvp_deadline, event.time_zone),
    hostDisplayName: tenantSettings?.host_display_name ?? null,
    hostSignature: tenantSettings?.host_signature ?? tenantSettings?.host_display_name ?? null,
    formLinkPlaceholder: form ? `{{form_link}}` : '[RSVP link]',
    voiceSamples: tenantSettings?.voice_samples ?? [],
  };
}

function friendlyAiError(err: unknown): string {
  if (err instanceof AnthropicNotConfiguredError) return err.message;
  // The message shown to the Host is intentionally generic (Anthropic's own
  // "Connection error." etc. isn't actionable for them) — log the full
  // error, including any underlying `cause`, so it's visible in Vercel's
  // Runtime Logs when diagnosing a real failure.
  console.error('[coach]', err, (err as { cause?: unknown } | undefined)?.cause ?? '');
  return err instanceof Error ? err.message : 'The writing assistant hit a snag. Please try again.';
}

export interface DraftResult extends ActionResult {
  subject?: string;
  body?: string;
}

export async function generateDraftAction(eventId: string, messageType: string): Promise<DraftResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  try {
    const ctx = await buildEventContext(eventId, appUser.tenant_id);
    const draft = await generateInvitationDraft(ctx);

    const { error } = await supabase
      .from('messages')
      .update({ subject: draft.subject, body: draft.body, is_approved: false })
      .eq('event_id', eventId)
      .eq('message_type', messageType as MessageType);

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/events/${eventId}/compose`);
    return { ok: true, ...draft };
  } catch (err) {
    return { ok: false, error: friendlyAiError(err) };
  }
}

export interface AttachmentRef {
  name: string;
  url: string;
}

export async function saveMessageAction(
  messageId: string,
  fields: { subject?: string; body?: string; attachment_urls?: AttachmentRef[] }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('messages')
    .update({ ...fields, attachment_urls: fields.attachment_urls as unknown as Json, is_approved: false })
    .eq('id', messageId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function refineDraftAction(params: {
  eventId: string;
  currentSubject: string;
  currentBody: string;
  instruction: string;
  selectedPassage?: string;
}): Promise<DraftResult> {
  const { appUser } = await requireCurrentUser();
  try {
    const ctx = await buildEventContext(params.eventId, appUser.tenant_id);
    const draft = await refineDraft({ ctx, ...params });
    return { ok: true, ...draft };
  } catch (err) {
    return { ok: false, error: friendlyAiError(err) };
  }
}

export interface StrengthenResult extends DraftResult {
  improvements?: string[];
}

export async function strengthenDraftAction(params: {
  eventId: string;
  currentSubject: string;
  currentBody: string;
}): Promise<StrengthenResult> {
  const { appUser } = await requireCurrentUser();
  try {
    const ctx = await buildEventContext(params.eventId, appUser.tenant_id);
    const result = await strengthenDraft({ ctx, ...params });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: friendlyAiError(err) };
  }
}

export async function approveMessageAction(messageId: string, approved: boolean): Promise<ActionResult> {
  try {
    const { appUser } = await requireCurrentUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from('messages')
      .update({
        is_approved: approved,
        approved_at: approved ? new Date().toISOString() : null,
        approved_by: approved ? appUser.id : null,
      })
      .eq('id', messageId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    console.error('[approve-message]', err);
    return { ok: false, error: 'Could not update approval status. Please try again.' };
  }
}

export async function generateSuiteAction(eventId: string): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: invitationMessage } = await supabase
    .from('messages')
    .select('subject, body')
    .eq('event_id', eventId)
    .eq('message_type', 'invitation')
    .single();

  if (!invitationMessage?.body) {
    return { ok: false, error: 'Write and save the initial invitation first — the rest of the suite builds on it.' };
  }

  try {
    const ctx = await buildEventContext(eventId, appUser.tenant_id);
    const suite = await generateMessageSuite(ctx, {
      subject: invitationMessage.subject ?? '',
      body: invitationMessage.body,
    });

    for (const [messageType, draft] of Object.entries(suite) as [SuiteMessageKey, { subject: string; body: string }][]) {
      await supabase.from('messages').upsert(
        {
          tenant_id: appUser.tenant_id,
          event_id: eventId,
          message_type: messageType,
          subject: draft.subject,
          body: draft.body,
          is_approved: false,
        },
        { onConflict: 'event_id,message_type' }
      );
    }

    revalidatePath(`/events/${eventId}/compose`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyAiError(err) };
  }
}

export interface VariantDraft {
  subject: string;
  body: string;
}

export async function regenerateVariantsAction(eventId: string, count: number): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: message } = await supabase
    .from('messages')
    .select('id, subject, body')
    .eq('event_id', eventId)
    .eq('message_type', 'invitation')
    .single();

  if (!message?.body) return { ok: false, error: 'Write and save the invitation first.' };

  try {
    const ctx = await buildEventContext(eventId, appUser.tenant_id);
    const { variants } = await generateVariants({
      ctx,
      canonicalSubject: message.subject ?? '',
      canonicalBody: message.body,
      count,
    });

    await supabase.from('message_variants').delete().eq('message_id', message.id);
    await supabase.from('message_variants').insert(
      variants.map((v, idx) => ({
        tenant_id: appUser.tenant_id,
        message_id: message.id,
        variant_index: idx + 1,
        subject: v.subject,
        body: v.body,
        generated_by_ai: true,
      }))
    );

    revalidatePath(`/events/${eventId}/compose`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyAiError(err) };
  }
}

export async function updateVariantAction(variantId: string, fields: { subject?: string; body?: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('message_variants').update(fields).eq('id', variantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function saveHandwrittenTouchAction(invitationId: string, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('invitations')
    .update({ personalization_note: note.trim() || null })
    .eq('id', invitationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function suggestHandwrittenTouchAction(params: {
  eventId: string;
  personFirstName: string;
  personContext: string;
}): Promise<DraftResult & { sentence?: string }> {
  const { appUser } = await requireCurrentUser();
  try {
    const ctx = await buildEventContext(params.eventId, appUser.tenant_id);
    const { sentence } = await generateHandwrittenTouch({
      ctx,
      personFirstName: params.personFirstName,
      personContext: params.personContext,
    });
    return { ok: true, sentence };
  } catch (err) {
    return { ok: false, error: friendlyAiError(err) };
  }
}
