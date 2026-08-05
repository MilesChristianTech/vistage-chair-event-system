import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/**
 * Rolls invitations up into the four questions the Host actually cares
 * about (Part 8.1): who's coming, who's a maybe, who to nudge, and are we
 * at capacity. Kept as plain aggregation over `invitations` rather than a
 * materialized view - volumes here (thousands of invitations per tenant,
 * per Part 12) are small enough that a direct query stays fast, and a
 * plain query is far easier for a solo operator to reason about than a
 * refresh-triggered view.
 */
export interface EventMetrics {
  invited: number;
  responded: number;
  responseRate: number | null;
  yes: number;
  positiveRate: number | null;
  maybe: number;
  no: number;
  noResponse: number;
  expectedHeadcount: number;
  capacity: number | null;
  remainingSeats: number | null;
  isOverCapacity: boolean;
  priorityNonResponders: number;
  attendanceYield: number | null;
  exceptions: number;
}

export async function getEventMetrics(
  supabase: SupabaseClient<Database>,
  eventId: string,
  capacity: number | null
): Promise<EventMetrics> {
  const { data: invitations } = await supabase
    .from('invitations')
    .select('invite_status, rsvp_status, guest_count, audience_segment, attendance_status')
    .eq('event_id', eventId);

  const rows = invitations ?? [];
  const invited = rows.filter((r) => r.invite_status === 'sent').length;
  const yes = rows.filter((r) => r.rsvp_status === 'yes').length;
  const no = rows.filter((r) => r.rsvp_status === 'no').length;
  const maybe = rows.filter((r) => r.rsvp_status === 'maybe').length;
  const noResponse = rows.filter((r) => r.rsvp_status === 'no_response' && r.invite_status === 'sent').length;
  const responded = rows.filter((r) => r.rsvp_status !== 'no_response').length;

  const guestTotal = rows
    .filter((r) => r.rsvp_status === 'yes')
    .reduce((sum, r) => sum + (r.guest_count || 0), 0);
  const expectedHeadcount = yes + guestTotal;

  const priorityNonResponders = rows.filter(
    (r) => r.audience_segment === 'priority' && r.rsvp_status === 'no_response' && r.invite_status === 'sent'
  ).length;

  const attended = rows.filter((r) => r.attendance_status === 'attended').length;
  const attendanceYield = invited > 0 ? attended / invited : null;

  const { data: form } = await supabase.from('forms').select('id').eq('event_id', eventId).maybeSingle();
  const { count: exceptions } = form
    ? await supabase
        .from('form_responses')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', form.id)
        .eq('match_status', 'needs_review')
    : { count: 0 };

  return {
    invited,
    responded,
    responseRate: invited > 0 ? responded / invited : null,
    yes,
    positiveRate: invited > 0 ? yes / invited : null,
    maybe,
    no,
    noResponse,
    expectedHeadcount,
    capacity,
    remainingSeats: capacity != null ? capacity - expectedHeadcount : null,
    isOverCapacity: capacity != null ? expectedHeadcount > capacity : false,
    priorityNonResponders,
    attendanceYield,
    exceptions: exceptions ?? 0,
  };
}

export interface NextAction {
  id: string;
  label: string;
  href: string;
  count: number;
}

/** Part 8.4: "a small ordered set of recommended next steps ... leading
 * directly to the relevant filtered list of people." */
export function buildNextActions(eventId: string, metrics: EventMetrics): NextAction[] {
  const actions: NextAction[] = [];

  if (metrics.priorityNonResponders > 0) {
    actions.push({
      id: 'nudge-priority',
      label: `Nudge ${metrics.priorityNonResponders} priority ${metrics.priorityNonResponders === 1 ? 'invitee' : 'invitees'} who haven't responded`,
      href: `/events/${eventId}/dashboard?filter=priority_no_response`,
      count: metrics.priorityNonResponders,
    });
  }

  if (metrics.maybe > 0) {
    actions.push({
      id: 'follow-up-maybe',
      label: `Follow up with ${metrics.maybe} "maybe" ${metrics.maybe === 1 ? 'response' : 'responses'}`,
      href: `/events/${eventId}/dashboard?filter=maybe`,
      count: metrics.maybe,
    });
  }

  if (metrics.isOverCapacity && metrics.remainingSeats != null) {
    actions.push({
      id: 'over-capacity',
      label: `You're ${Math.abs(metrics.remainingSeats)} over capacity - review the waitlist`,
      href: `/events/${eventId}/dashboard?filter=yes`,
      count: Math.abs(metrics.remainingSeats),
    });
  }

  if (metrics.exceptions > 0) {
    actions.push({
      id: 'exceptions',
      label: `${metrics.exceptions} ${metrics.exceptions === 1 ? 'response needs' : 'responses need'} matching`,
      href: `/events/${eventId}/responses?tab=exceptions`,
      count: metrics.exceptions,
    });
  }

  if (metrics.noResponse > 0 && metrics.priorityNonResponders === 0) {
    actions.push({
      id: 'no-response',
      label: `${metrics.noResponse} invitees haven't responded yet`,
      href: `/events/${eventId}/dashboard?filter=no_response`,
      count: metrics.noResponse,
    });
  }

  return actions;
}
