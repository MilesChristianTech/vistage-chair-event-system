import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPaceRecommendations } from '@/lib/pacing';
import { getRecipientCandidates, getActiveJobForType, createSendJobCore, type SendJobType } from '@/lib/send-job-core';

export const maxDuration = 60;

/**
 * Auto-fires the date-based suite messages a Host has approved but never
 * had to remember to click Send for — reminder/priority_follow_up (relative
 * to the RSVP deadline) and final_details/post_event_follow_up (relative to
 * the event date). Runs once a day (see vercel.json), which is plenty of
 * granularity for "partway to the deadline" / "a few days before" timing.
 *
 * Deliberately NOT handled here:
 *  - rsvp_confirmation: already fires immediately on a "yes" RSVP
 *    (lib/auto-confirmation.ts), not date-based.
 *  - cancellation: fires immediately when a Host sets the event to
 *    cancelled (see events/actions.ts updateEventStatusAction), not
 *    date-based.
 *  - waitlist: would need to fire when capacity is crossed, which nothing
 *    currently detects — left as a manual send until that exists.
 *  - thank_you: targets attendance_status = 'attended', which nothing
 *    currently sets automatically (no check-in feature) — left manual.
 *
 * A message type only ever auto-fires once per event: if any send_job of
 * that type already exists (regardless of status — including one the Host
 * started manually, paused, or cancelled), it's skipped rather than
 * re-triggered. A Host can always send manually afterward regardless.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

interface Trigger {
  jobType: SendJobType;
  isDue: (event: { starts_at: string | null; rsvp_deadline: string | null }) => boolean;
}

const TRIGGERS: Trigger[] = [
  {
    jobType: 'reminder',
    isDue: (e) => Boolean(e.rsvp_deadline) && Date.now() >= new Date(e.rsvp_deadline!).getTime() - 5 * DAY_MS,
  },
  {
    jobType: 'priority_follow_up',
    isDue: (e) => Boolean(e.rsvp_deadline) && Date.now() >= new Date(e.rsvp_deadline!).getTime() - 2 * DAY_MS,
  },
  {
    jobType: 'final_details',
    isDue: (e) => Boolean(e.starts_at) && Date.now() >= new Date(e.starts_at!).getTime() - 2 * DAY_MS,
  },
  {
    jobType: 'post_event_follow_up',
    isDue: (e) => Boolean(e.starts_at) && Date.now() >= new Date(e.starts_at!).getTime() + 1 * DAY_MS,
  },
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results: { eventId: string; jobType: string; outcome: string }[] = [];

  const { data: events } = await supabase
    .from('events')
    .select('id, tenant_id, starts_at, rsvp_deadline, status')
    .in('status', ['inviting', 'closed']);

  for (const event of events ?? []) {
    for (const trigger of TRIGGERS) {
      if (!trigger.isDue(event)) continue;

      const alreadyExists = await supabase
        .from('send_jobs')
        .select('id')
        .eq('event_id', event.id)
        .eq('job_type', trigger.jobType)
        .maybeSingle();
      if (alreadyExists.data) continue;

      const { data: message } = await supabase
        .from('messages')
        .select('is_approved')
        .eq('event_id', event.id)
        .eq('message_type', trigger.jobType)
        .maybeSingle();
      if (!message?.is_approved) continue;

      const existingJob = await getActiveJobForType(supabase, event.id, trigger.jobType);
      if (existingJob) continue;

      // Candidate count decides pacing the same way the Host's own Send
      // page would recommend it for a list this size.
      const candidates = await getRecipientCandidates(supabase, event.id, trigger.jobType);
      if (candidates.length === 0) continue;
      const recommended = getPaceRecommendations(candidates.length).find((r) => r.isRecommended)?.profile ?? 'fastest';

      const result = await createSendJobCore(supabase, {
        tenantId: event.tenant_id,
        createdBy: null,
        eventId: event.id,
        jobType: trigger.jobType,
        paceProfile: recommended,
      });

      results.push({ eventId: event.id, jobType: trigger.jobType, outcome: result.ok ? `created job ${result.jobId}` : result.error! });
    }
  }

  return NextResponse.json({ ok: true, checked: events?.length ?? 0, actions: results });
}
