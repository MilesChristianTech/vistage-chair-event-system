'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/tenant';
import type { Database } from '@/lib/database.types';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Part 3.10: "a clear one-click way for the Host to match them" — resolving
// an exception never touches the raw form_responses row, it only records
// the resolution and updates the invitation.
export async function resolveExceptionAction(responseId: string, invitationId: string): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: response } = await supabase
    .from('form_responses')
    .select('raw_answers, form_id')
    .eq('id', responseId)
    .single();

  const { error } = await supabase
    .from('form_responses')
    .update({
      match_status: 'matched',
      resolved_invitation_id: invitationId,
      resolved_at: new Date().toISOString(),
      resolved_by: appUser.id,
    })
    .eq('id', responseId);

  if (error) return { ok: false, error: error.message };

  // Apply the same answer -> field interpretation the live form uses, now
  // that we know which invitation this belongs to (3.10: matching happens
  // in this layer, never by mutating the raw response itself).
  if (response?.raw_answers && typeof response.raw_answers === 'object') {
    const { data: questions } = await supabase
      .from('form_questions')
      .select('id, question_type')
      .eq('form_id', response.form_id);
    const typeById = new Map((questions ?? []).map((q) => [q.id, q.question_type]));

    const patch: Record<string, unknown> = {};
    for (const [questionId, value] of Object.entries(response.raw_answers as Record<string, unknown>)) {
      const type = typeById.get(questionId);
      if (type === 'attendance') {
        const normalized = String(value).toLowerCase();
        if (normalized.includes('yes')) patch.rsvp_status = 'yes';
        else if (normalized.includes('not') || normalized.includes('maybe') || normalized.includes('certain')) patch.rsvp_status = 'maybe';
        else if (normalized.includes('cannot') || normalized.includes('no')) patch.rsvp_status = 'no';
      }
      if (type === 'guest_count') {
        const n = Number(value);
        if (!Number.isNaN(n)) patch.guest_count = Math.max(0, Math.floor(n));
      }
      if (type === 'guest_names') patch.guest_names = String(value ?? '');
      if (type === 'dietary_accessibility') patch.dietary_accessibility_notes = String(value ?? '');
    }
    if (Object.keys(patch).length > 0) {
      patch.rsvp_responded_at = new Date().toISOString();
      await supabase
        .from('invitations')
        .update(patch as Database['public']['Tables']['invitations']['Update'])
        .eq('id', invitationId);
    }
  }

  revalidatePath(`/events`, 'layout');
  return { ok: true };
}

// Part 3.10: "Always allow manual entry of a response the Host received by
// email, phone, or in person, and never let that manual entry corrupt the
// raw form data." — recorded as its own form_responses row with
// match_status='manual_entry', kept just as immutable as a web submission.
export async function recordManualResponseAction(params: {
  eventId: string;
  invitationId: string;
  rsvpStatus: 'yes' | 'no' | 'maybe';
  guestCount?: number;
  note?: string;
}): Promise<ActionResult> {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: form } = await supabase.from('forms').select('id').eq('event_id', params.eventId).single();
  if (!form) return { ok: false, error: 'This event has no form record — that should never happen.' };

  await supabase.from('form_responses').insert({
    tenant_id: appUser.tenant_id,
    form_id: form.id,
    invitation_id: params.invitationId,
    raw_answers: { source: 'manual_entry', note: params.note ?? null, rsvp_status: params.rsvpStatus },
    match_status: 'manual_entry',
    resolved_invitation_id: params.invitationId,
    resolved_at: new Date().toISOString(),
    resolved_by: appUser.id,
  });

  const { error } = await supabase
    .from('invitations')
    .update({
      rsvp_status: params.rsvpStatus,
      guest_count: params.guestCount ?? 0,
      rsvp_responded_at: new Date().toISOString(),
    })
    .eq('id', params.invitationId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events`, 'layout');
  return { ok: true };
}
