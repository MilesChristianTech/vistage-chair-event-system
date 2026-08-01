'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, PauseCircle, XCircle, Clock } from 'lucide-react';
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

const STATUS_META: Record<string, { label: string; icon: typeof Loader2; className: string }> = {
  queued: { label: 'Queued', icon: Clock, className: 'bg-navy-100 text-navy-700' },
  running: { label: 'Sending', icon: Loader2, className: 'bg-gold-50 text-gold-700' },
  paused: { label: 'Paused', icon: PauseCircle, className: 'bg-warn-bg text-warn' },
  completed: { label: 'Complete', icon: CheckCircle2, className: 'bg-success-bg text-success' },
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'bg-navy-100 text-navy-500' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-danger-bg text-danger' },
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

  const percent = current.total_recipients > 0 ? ((current.sent_count + current.failed_count) / current.total_recipients) * 100 : 0;
  const meta = STATUS_META[current.status] ?? STATUS_META.queued!;
  const StatusIcon = meta.icon;
  const isRunning = current.status === 'running';

  return (
    <div className="card-interactive p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-navy-900 text-sm">{label}</p>
        <span className={`badge ${meta.className}`}>
          <StatusIcon className={`h-3 w-3 ${isRunning ? 'animate-spin' : ''}`} strokeWidth={2} />
          {meta.label}
        </span>
      </div>

      <div className="relative h-2 bg-navy-100 rounded-full overflow-hidden mb-2">
        <motion.div
          className="relative h-full rounded-full bg-gradient-to-r from-navy-700 via-navy-800 to-navy-950"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {isRunning ? (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent bg-[length:200%_100%] animate-shimmer" />
          ) : null}
        </motion.div>
      </div>
      <p className="text-xs text-navy-500 mb-3 tabular-nums">
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
