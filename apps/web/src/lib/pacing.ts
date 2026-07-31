/**
 * Send pacing (Part 7.2, 7.3). A human working through their outbox does not
 * send one email exactly every N seconds — gaps are randomized, and large
 * sends are recommended to spread across hours or days for deliverability.
 */

export type PaceProfile = 'fastest' | 'one_day' | 'two_day' | 'custom';

export interface PaceRecommendation {
  profile: PaceProfile;
  label: string;
  description: string;
  isRecommended: boolean;
  totalSpanMs: number;
}

/** Part 7.3 — the app recommends based on recipient count, Host chooses. */
export function getPaceRecommendations(recipientCount: number): PaceRecommendation[] {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (recipientCount <= 60) {
    return [
      { profile: 'fastest', label: 'Send over about an hour', description: 'Recommended for this size list.', isRecommended: true, totalSpanMs: hour },
      { profile: 'one_day', label: 'Spread over 1 day', description: 'Extra-gentle pacing, if you prefer.', isRecommended: false, totalSpanMs: day },
    ];
  }

  if (recipientCount <= 150) {
    return [
      { profile: 'fastest', label: 'Send over a few hours', description: 'Fastest option, slightly higher spam risk at this size.', isRecommended: false, totalSpanMs: 3 * hour },
      { profile: 'one_day', label: 'Spread over 1 day', description: 'Recommended balance of speed and inbox delivery.', isRecommended: true, totalSpanMs: day },
      { profile: 'two_day', label: 'Spread over 2 days', description: 'Best inbox delivery, slower.', isRecommended: false, totalSpanMs: 2 * day },
    ];
  }

  return [
    { profile: 'fastest', label: 'Send over a few hours', description: 'Fastest, slightly higher spam risk.', isRecommended: false, totalSpanMs: 4 * hour },
    { profile: 'one_day', label: 'Spread over 1 day', description: 'Faster than 2 days, still paced sensibly.', isRecommended: false, totalSpanMs: day },
    { profile: 'two_day', label: 'Spread over 2 days', description: 'Recommended for best inbox delivery at this volume.', isRecommended: true, totalSpanMs: 2 * day },
  ];
}

export function getPaceSpanMs(profile: PaceProfile, recipientCount: number, customSpanMs?: number): number {
  if (profile === 'custom') return customSpanMs ?? recipientCount * 60_000;
  const rec = getPaceRecommendations(recipientCount).find((r) => r.profile === profile);
  return rec?.totalSpanMs ?? recipientCount * 60_000;
}

/**
 * Builds one scheduled_at timestamp per recipient, spread across the chosen
 * span with randomized (not fixed) gaps, and comfortably under Microsoft
 * 365's per-minute sending ceiling regardless of span chosen (Part 7.1, 7.2).
 */
export function buildSendSchedule(params: {
  recipientCount: number;
  spanMs: number;
  startAt?: Date;
}): Date[] {
  const { recipientCount, spanMs, startAt = new Date() } = params;
  if (recipientCount <= 0) return [];
  if (recipientCount === 1) return [startAt];

  // Evenly divide the span into recipientCount slots, then jitter each
  // send time within its slot by up to +/-40% of the slot width so gaps
  // read as organic rather than metronomic, while never drifting outside
  // the overall requested span.
  const slotWidth = spanMs / recipientCount;
  const schedule: Date[] = [];

  for (let i = 0; i < recipientCount; i++) {
    const slotStart = i * slotWidth;
    const jitter = (Math.random() - 0.5) * 2 * (slotWidth * 0.4);
    const offset = Math.max(0, Math.min(spanMs, slotStart + jitter));
    schedule.push(new Date(startAt.getTime() + offset));
  }

  // Guarantee strictly increasing times (jitter could otherwise reorder
  // neighbors, which is fine for pacing but would be confusing in a
  // progress list sorted by scheduled_at).
  schedule.sort((a, b) => a.getTime() - b.getTime());
  return schedule;
}

export function formatEta(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
