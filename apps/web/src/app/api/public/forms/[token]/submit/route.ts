import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Public RSVP submission (Part 3.6, 3.10). No auth — reachable by anyone
 * with the link, which is exactly the point of a hosted RSVP form. Every
 * write here goes through the service-role client with its own narrow
 * checks (is this form actually published?) rather than relying on RLS,
 * per the note in supabase/migrations/0004_rls_policies.sql.
 *
 * Two things happen, deliberately kept separate (3.10):
 *   1. The raw submission is written to form_responses, untouched, forever.
 *   2. A best-effort attempt matches it to an invitation and updates that
 *      invitation's parsed RSVP fields — but if that matching is wrong or
 *      the Host fixes it later, the raw row above is never altered.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data: form } = await supabase
    .from('forms')
    .select('id, tenant_id, event_id')
    .eq('public_token', params.token)
    .eq('is_published', true)
    .maybeSingle();

  if (!form) {
    return NextResponse.json({ error: 'This form is not accepting responses right now.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Malformed submission.' }, { status: 400 });
  }

  const { answers, invitationId, submittedName, submittedEmail } = body as {
    answers: Record<string, unknown>;
    invitationId?: string;
    submittedName?: string;
    submittedEmail?: string;
  };

  const { data: questions } = await supabase
    .from('form_questions')
    .select('id, question_type')
    .eq('form_id', form.id);

  const typeById = new Map((questions ?? []).map((q) => [q.id, q.question_type]));

  // Resolve which invitation this belongs to, without ever touching the
  // raw payload we're about to store.
  let resolvedInvitationId: string | null = null;
  let matchStatus: 'matched' | 'needs_review' = 'needs_review';

  if (invitationId) {
    const { data: invitation } = await supabase
      .from('invitations')
      .select('id')
      .eq('id', invitationId)
      .eq('event_id', form.event_id)
      .maybeSingle();
    if (invitation) {
      resolvedInvitationId = invitation.id;
      matchStatus = 'matched';
    }
  }

  if (!resolvedInvitationId && submittedEmail) {
    const normalized = submittedEmail.toLowerCase().trim();
    const { data: match } = await supabase
      .from('invitations')
      .select('id, people!inner(email_normalized)')
      .eq('event_id', form.event_id)
      .eq('people.email_normalized', normalized)
      .maybeSingle();
    if (match) {
      resolvedInvitationId = match.id;
      matchStatus = 'matched';
    }
  }

  const { data: response, error: insertError } = await supabase
    .from('form_responses')
    .insert({
      tenant_id: form.tenant_id,
      form_id: form.id,
      invitation_id: resolvedInvitationId,
      raw_answers: answers,
      submitted_email: submittedEmail ?? null,
      submitted_name: submittedName ?? null,
      match_status: matchStatus,
      resolved_invitation_id: resolvedInvitationId,
      resolved_at: resolvedInvitationId ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Something went wrong saving your response. Please try again.' }, { status: 500 });
  }

  if (resolvedInvitationId) {
    const patch: Record<string, unknown> = {};

    for (const [questionId, value] of Object.entries(answers)) {
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
      await supabase.from('invitations').update(patch).eq('id', resolvedInvitationId);
    }

    await supabase.from('engagement_signals').insert({
      tenant_id: form.tenant_id,
      invitation_id: resolvedInvitationId,
      signal_type: 'form_submitted',
      meta: { response_id: response.id },
    });
  }

  return NextResponse.json({ ok: true, matched: matchStatus === 'matched' });
}
