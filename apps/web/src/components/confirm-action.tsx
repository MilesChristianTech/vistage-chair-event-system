'use client';

import { useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * The gate for every consequential action in the product (Part 6.2): a
 * calm, plain-language statement of what will actually happen, a clear
 * confirm and a clear cancel, never the default click. Used for sends,
 * publishing, and deletes alike - the wording is supplied by the caller so
 * it always states who/how many/when for that specific action.
 */
export default function ConfirmAction({
  triggerLabel,
  triggerClassName = 'btn-danger',
  consequence,
  confirmLabel = 'Yes, continue',
  successMessage,
  onConfirm,
}: {
  triggerLabel: string;
  triggerClassName?: string;
  consequence: string;
  confirmLabel?: string;
  successMessage?: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-lg border border-warn/25 bg-warn-bg/70 backdrop-blur-sm p-4 max-w-md shadow-xs"
      >
        <div className="flex gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warn" strokeWidth={1.75} />
          <p className="text-sm text-navy-900">{consequence}</p>
        </div>
        {error ? <p className="text-sm text-danger mt-3">{error}</p> : null}
        <div className="flex items-center gap-2 mt-3">
          <button
            className="btn-danger"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await onConfirm();
                if (result && !result.ok) {
                  setError(result.error || 'Something went wrong. Please try again.');
                  return;
                }
                if (successMessage) toast.success(successMessage);
                setOpen(false);
              });
            }}
          >
            {isPending ? 'Working…' : confirmLabel}
          </button>
          <button className="btn-ghost" disabled={isPending} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
