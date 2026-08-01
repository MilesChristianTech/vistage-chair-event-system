// PREVIEW_MODE only. There's no separate worker process running alongside
// `next dev` in a preview session, so without this, a send created in the
// UI would sit at "0 sent" forever — the queue would exist but nothing
// would ever drain it. This does the same core job the real worker does
// (apps/worker/src/index.ts) — claim due rows, mark them sent, update the
// job — just synchronously, triggered by the Send tab's own 4-second
// progress poll instead of a standing background loop. Never imported
// outside a PREVIEW_MODE code path.
import { getTable, setTable } from './store';

export function advanceSimulatedSendJob(jobId: string) {
  const jobs = getTable('send_jobs');
  const job = jobs.find((j) => j.id === jobId);
  if (!job || job.status !== 'running') return;

  const now = Date.now();
  const recipients = getTable('send_job_recipients');
  let sentDelta = 0;

  for (const row of recipients) {
    if (row.send_job_id !== jobId) continue;
    if (row.status !== 'queued') continue;
    if (new Date(row.scheduled_at).getTime() > now) continue;

    row.status = 'sent';
    row.sent_at = new Date().toISOString();
    sentDelta++;
  }

  if (sentDelta > 0) {
    setTable('send_job_recipients', recipients);
    job.sent_count += sentDelta;
    if (job.sent_count + job.failed_count >= job.total_recipients) {
      job.status = 'completed';
    }
    setTable('send_jobs', jobs);
  }
}
