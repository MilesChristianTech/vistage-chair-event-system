'use client';

import { useState, useTransition } from 'react';

/**
 * The gate for every consequential action in the product (Part 6.2): a
 * calm, plain-language statement of what will actually happen, a clear
 * confirm and a clear cancel, never the default click. Used for sends,
 * publishing, and deletes alike — the wording is supplied by the caller so
 * it always states who/how many/when for that specific action.
 */
export default function ConfirmAction({
  triggerLabel,
  triggerClassName = 'btn-danger',
  consequence,
  confirmLabel = 'Yes, continue',
  onConfirm,
}: {
  triggerLabel: string;
  triggerClassName?: string;
  consequence: string;
  confirmLabel?: string;
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
    <div className="card p-4 bg-warn-bg border-warn/30 max-w-md">
      <p className="text-sm text-navy-900 mb-3">{consequence}</p>
      {error ? <p className="text-sm text-danger mb-3">{error}</p> : null}
      <div className="flex items-center gap-2">
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
    </div>
  );
}
