'use client';

import { useEffect, useState } from 'react';
import ConfirmAction from '@/components/confirm-action';
import { getSendJobProgressAction } from './actions';

export interface JobSummary {
  id: string;
  job_type: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  running: 'Sending',
  paused: 'Paused',
  completed: 'Complete',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

export default function JobProgress({
  job,
  label,
  onPause,
  onResume,
  onCancel,
}: {
  job: JobSummary;
  label: string;
  onPause: () => Promise<unknown>;
  onResume: () => Promise<unknown>;
  onCancel: () => Promise<unknown>;
}) {
  const [current, setCurrent] = useState(job);

  useEffect(() => {
    if (current.status !== 'running') return;

    const interval = setInterval(async () => {
      const progress = await getSendJobProgressAction(current.id);
      if (progress) {
        setCurrent((prev) => ({
          ...prev,
          status: progress.status,
          sent_count: progress.sentCount,
          failed_count: progress.failedCount,
          total_recipients: progress.totalRecipients,
        }));
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [current.status, current.id]);

  const percent = current.total_recipients > 0 ? Math.round(((current.sent_count + current.failed_count) / current.total_recipients) * 100) : 0;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="font-medium text-navy-900 text-sm">{label}</p>
        <span className="badge-neutral">{STATUS_LABELS[current.status] ?? current.status}</span>
      </div>
      <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden mb-2">
        <div className="h-full bg-navy-900 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-navy-500 mb-3">
        {current.sent_count} of {current.total_recipients} sent
        {current.failed_count > 0 ? ` · ${current.failed_count} failed` : ''}
      </p>

      {current.status === 'running' ? (
        <>
          <p className="text-xs text-navy-400 mb-2">You can close this window safely — sending continues on the server.</p>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-xs"
              onClick={async () => {
                await onPause();
                setCurrent((prev) => ({ ...prev, status: 'paused' }));
              }}
            >
              Pause
            </button>
            <ConfirmAction
              triggerLabel="Cancel remaining"
              triggerClassName="btn-danger text-xs"
              consequence={`This stops the rest of this send. ${current.sent_count} people have already received it and that can't be undone — everyone still queued (${current.total_recipients - current.sent_count - current.failed_count} people) simply won't receive it.`}
              confirmLabel="Cancel remaining"
              onConfirm={async () => {
                await onCancel();
                setCurrent((prev) => ({ ...prev, status: 'cancelled' }));
              }}
            />
          </div>
        </>
      ) : current.status === 'paused' ? (
        <button
          className="btn-primary text-xs"
          onClick={async () => {
            await onResume();
            setCurrent((prev) => ({ ...prev, status: 'running' }));
          }}
        >
          Resume
        </button>
      ) : null}
    </div>
  );
}
