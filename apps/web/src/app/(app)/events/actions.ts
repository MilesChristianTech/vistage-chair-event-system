'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/tenant';
import { getRecipientCandidates, createSendJobCore } from '@/lib/send-job-core';
import { getPaceRecommendations } from '@/lib/pacing';
import type { Database } from '@/lib/database.types';

type EventStatus = Database['public']['Tables']['events']['Row']['status'];

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** A `datetime-local` input gives a plain wall-clock string with no
 * timezone ("2026-08-15T09:00") — `new Date(...)` on that would parse it in
 * whatever zone the *server* happens to run in, which is wrong for an event
 * the Host picked a specific time_zone for. Parse it explicitly as wall-clock
 * time in the event's own zone instead, then store the correct UTC instant. */
function parseInZone(raw: string, zone: string): string | null {
  if (!raw) return null;
  const parsed = DateTime.fromISO(raw, { zone });
  return parsed.isValid ? parsed.toUTC().toISO() : null;
}

function readEventFields(formData: FormData) {
  const startsAtRaw = String(formData.get('starts_at') || '');
  const rsvpDeadlineRaw = String(formData.get('rsvp_deadline') || '');
  const capacityRaw = String(formData.get('capacity') || '');
  const timeZone = String(formData.get('time_zone') || 'America/New_York');

  return {
    internal_name: String(formData.get('internal_name') || '').trim(),
    public_title: String(formData.get('public_title') || '').trim(),
    event_type_id: String(formData.get('event_type_id') || '') || null,
    purpose: String(formData.get('purpose') || '').trim() || null,
    audience_description: String(formData.get('audience_description') || '').trim() || null,
    value_proposition: String(formData.get('value_proposition') || '').trim() || null,
    speaker_details: String(formData.get('speaker_details') || '').trim() || null,
    starts_at: parseInZone(startsAtRaw, timeZone),
    time_zone: timeZone,
    is_virtual: formData.get('is_virtual') === 'on',
    venue_name: String(formData.get('venue_name') || '').trim() || null,
    venue_address: String(formData.get('venue_address') || '').trim() || null,
    parking_notes: String(formData.get('parking_notes') || '').trim() || null,
    virtual_link: String(formData.get('virtual_link') || '').trim() || null,
    capacity: capacityRaw ? Number(capacityRaw) : null,
    rsvp_deadline: parseInZone(rsvpDeadlineRaw, timeZone),
  };
}

export async function createEventAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const fields = readEventFields(formData);

  if (!fields.internal_name || !fields.public_title) {
    return { ok: false, error: 'Give the event an internal name and a public title.' };
  }

  const { data, error } = await supabase
    .from('events')
    .insert({ tenant_id: appUser.tenant_id, ...fields })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create the event.' };

  // Every event is born with its one form and its one canonical invitation
  // message (Part 3.3: "these are born attached to the event"), so the
  // Host never has to think about creating them separately.
  await supabase.from('forms').insert({ tenant_id: appUser.tenant_id, event_id: data.id });
  await supabase.from('messages').insert({ tenant_id: appUser.tenant_id, event_id: data.id, message_type: 'invitation', body: '' });

  redirect(`/events/${data.id}/setup`);
}

export async function updateEventAction(eventId: string, _prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const fields = readEventFields(formData);

  if (!fields.internal_name || !fields.public_title) {
    return { ok: false, error: 'Give the event an internal name and a public title.' };
  }

  // Part 6.3: editing event facts ripples forward automatically to
  // everywhere they're displayed (the form, dashboard, unsent emails) —
  // because it's all read live from this same row, that "ripple" requires
  // no special propagation code. It simply never reaches back to alter
  // content already frozen onto send_job_recipients rows (Part 6.4, 7.6).
  const { error } = await supabase.from('events').update(fields).eq('id', eventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${eventId}`, 'layout');
  return { ok: true };
}

export async function updateEventStatusAction(eventId: string, status: string): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from('events').update({ status: status as EventStatus }).eq('id', eventId);
  if (error) return { ok: false, error: error.message };

  // Unlike every other suite message (manual, or date-triggered by the
  // auto-schedule cron), cancellation has a real, immediate trigger already
  // available: the Host marking the event cancelled. Fires once — if a job
  // already exists (any status) for this event, it's not re-triggered.
  if (status === 'cancelled') {
    const { data: message } = await supabase
      .from('messages')
      .select('is_approved')
      .eq('event_id', eventId)
      .eq('message_type', 'cancellation')
      .maybeSingle();

    const { data: alreadyExists } = await supabase
      .from('send_jobs')
      .select('id')
      .eq('event_id', eventId)
      .eq('job_type', 'cancellation')
      .maybeSingle();

    if (message?.is_approved && !alreadyExists) {
      const candidates = await getRecipientCandidates(supabase, eventId, 'cancellation');
      if (candidates.length > 0) {
        const pace = getPaceRecommendations(candidates.length).find((r) => r.isRecommended)?.profile ?? 'fastest';
        await createSendJobCore(supabase, {
          tenantId: appUser.tenant_id,
          createdBy: appUser.id,
          eventId,
          jobType: 'cancellation',
          paceProfile: pace,
        });
      }
    }
  }

  revalidatePath(`/events/${eventId}`, 'layout');
  return { ok: true };
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) return { ok: false, error: error.message };
  redirect('/events');
}

/** "Templates" (Part request: reuse a past event's setup instead of
 * re-typing everything each time) — implemented as duplicating an existing
 * event rather than a separate template entity, so every real event
 * doubles as a reusable starting point. Copies the event's facts, its
 * form's structure/text/branding, and its message drafts. Deliberately does
 * NOT copy the date/time, RSVP deadline, invitees, responses, or send
 * history — those are specific to the original occurrence, and draft
 * messages are reset to unapproved since logistics will need review before
 * they're accurate for the new date. */
export async function duplicateEventAction(eventId: string): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: source } = await supabase.from('events').select('*').eq('id', eventId).eq('tenant_id', appUser.tenant_id).single();
  if (!source) return { ok: false, error: 'Event not found.' };

  const { data: newEvent, error: eventError } = await supabase
    .from('events')
    .insert({
      tenant_id: appUser.tenant_id,
      internal_name: `${source.internal_name} (copy)`,
      public_title: source.public_title,
      event_type_id: source.event_type_id,
      purpose: source.purpose,
      audience_description: source.audience_description,
      value_proposition: source.value_proposition,
      speaker_details: source.speaker_details,
      time_zone: source.time_zone,
      is_virtual: source.is_virtual,
      venue_name: source.venue_name,
      venue_address: source.venue_address,
      parking_notes: source.parking_notes,
      virtual_link: source.virtual_link,
      capacity: source.capacity,
      status: 'draft',
    })
    .select('id')
    .single();

  if (eventError || !newEvent) return { ok: false, error: eventError?.message ?? 'Could not duplicate the event.' };

  const { data: sourceForm } = await supabase.from('forms').select('*').eq('event_id', eventId).maybeSingle();

  const { data: newForm } = await supabase
    .from('forms')
    .insert({
      tenant_id: appUser.tenant_id,
      event_id: newEvent.id,
      intro_text: sourceForm?.intro_text ?? null,
      confirmation_text: sourceForm?.confirmation_text ?? null,
      theme: sourceForm?.theme ?? null,
    })
    .select('id')
    .single();

  if (sourceForm && newForm) {
    const { data: sourceQuestions } = await supabase
      .from('form_questions')
      .select('question_type, label, help_text, is_required, sort_order, options')
      .eq('form_id', sourceForm.id)
      .order('sort_order');

    if (sourceQuestions && sourceQuestions.length > 0) {
      await supabase.from('form_questions').insert(
        sourceQuestions.map((q) => ({
          tenant_id: appUser.tenant_id,
          form_id: newForm.id,
          ...q,
        }))
      );
    }
  }

  const { data: sourceMessages } = await supabase
    .from('messages')
    .select('message_type, subject, body')
    .eq('event_id', eventId);

  if (sourceMessages && sourceMessages.length > 0) {
    await supabase.from('messages').insert(
      sourceMessages.map((m) => ({
        tenant_id: appUser.tenant_id,
        event_id: newEvent.id,
        message_type: m.message_type,
        subject: m.subject,
        body: m.body,
        is_approved: false,
      }))
    );
  }

  redirect(`/events/${newEvent.id}/setup`);
}

// ---------------------------------------------------------------------------
// Invitees (Part 5.1 step 2, Part 3.4)
// ---------------------------------------------------------------------------

export interface PersonSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  company: string | null;
  contact_preference: string;
}

export async function searchPeopleForInviteAction(eventId: string, query: string): Promise<PersonSearchResult[]> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: existing } = await supabase.from('invitations').select('person_id').eq('event_id', eventId);
  const existingIds = new Set((existing ?? []).map((i) => i.person_id));

  // search_people matches name, company, title, email, relationship type
  // label, the summary note, and any custom field value — shared with the
  // Contacts list search, so "search by anything" is right in one place.
  const { data } = await supabase.rpc('search_people', {
    p_tenant_id: appUser.tenant_id,
    p_query: query.trim() || null,
    p_status: 'active',
  });

  return (data ?? [])
    .filter((p) => !existingIds.has(p.id))
    .slice(0, 25)
    .map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      company: p.company,
      contact_preference: p.contact_preference,
    }));
}

export interface AddInviteesResult extends ActionResult {
  addedCount?: number;
  skippedCount?: number;
}

export async function addInviteesAction(eventId: string, personIds: string[]): Promise<AddInviteesResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: existing } = await supabase.from('invitations').select('person_id').eq('event_id', eventId);
  const existingIds = new Set((existing ?? []).map((i) => i.person_id));

  const toInsert = personIds.filter((id) => !existingIds.has(id));
  const skipped = personIds.length - toInsert.length;

  if (toInsert.length > 0) {
    const { error } = await supabase.from('invitations').insert(
      toInsert.map((personId) => ({ tenant_id: appUser.tenant_id, event_id: eventId, person_id: personId }))
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/events/${eventId}`, 'layout');
  return { ok: true, addedCount: toInsert.length, skippedCount: skipped };
}

export async function removeInviteeAction(eventId: string, invitationId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: invitation } = await supabase
    .from('invitations')
    .select('invite_status')
    .eq('id', invitationId)
    .single();

  if (invitation?.invite_status === 'sent') {
    return {
      ok: false,
      error: 'This person already received an email for this event, so removing them here would hide real history. Mark them "withdrawn" instead.',
    };
  }

  const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${eventId}`, 'layout');
  return { ok: true };
}

export async function updateInvitationAction(
  invitationId: string,
  fields: {
    audience_segment?: string;
    personalization_note?: string | null;
    invite_status?: string;
    rsvp_status?: string;
    host_override_status?: string | null;
    guest_count?: number;
    attendance_status?: string;
  }
): Promise<ActionResult> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { ...fields };
  if (fields.host_override_status !== undefined) {
    patch.next_action_overridden_by_host = true;
  }
  if (fields.rsvp_status) {
    patch.rsvp_responded_at = new Date().toISOString();
  }

  const { data: invitation, error: fetchError } = await supabase
    .from('invitations')
    .select('event_id')
    .eq('id', invitationId)
    .single();
  if (fetchError || !invitation) return { ok: false, error: 'Invitation not found.' };

  const { error } = await supabase
    .from('invitations')
    .update(patch as Database['public']['Tables']['invitations']['Update'])
    .eq('id', invitationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${invitation.event_id}`, 'layout');
  return { ok: true };
}
