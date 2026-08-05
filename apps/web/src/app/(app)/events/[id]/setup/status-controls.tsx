'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmAction from '@/components/confirm-action';
import { updateEventStatusAction, deleteEventAction, duplicateEventAction } from '../../actions';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'inviting', label: 'Inviting' },
  { value: 'closed', label: 'Closed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function EventStatusControls({ event }: { event: { id: string; status: string; public_title: string } }) {
  const router = useRouter();
  const [isDuplicating, startDuplicate] = useTransition();
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  return (
    <div className="card p-4 space-y-4">
      <div>
        <h3>Status</h3>
        <select
          className="input"
          defaultValue={event.status}
          onChange={async (e) => {
            setStatusError(null);
            const result = await updateEventStatusAction(event.id, e.target.value);
            if (result && !result.ok) {
              setStatusError(result.error || 'Could not update status.');
              return;
            }
            router.refresh();
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="field-hint">Status shapes what the app shows and suggests - it never blocks you from editing.</p>
        {statusError ? <p className="text-sm text-danger mt-2">{statusError}</p> : null}
      </div>

      <div className="pt-3 border-t border-navy-100">
        <button
          className="btn-secondary w-full justify-center"
          disabled={isDuplicating}
          onClick={() => {
            setDuplicateError(null);
            startDuplicate(async () => {
              const result = await duplicateEventAction(event.id);
              if (result && !result.ok) setDuplicateError(result.error || 'Could not duplicate this event.');
            });
          }}
        >
          {isDuplicating ? 'Duplicating…' : 'Duplicate this event'}
        </button>
        <p className="field-hint">
          Copies the event facts, form questions, and message drafts into a new draft event - a quick way to reuse a
          past event as a starting point. Date, invitees, and responses are never carried over.
        </p>
        {duplicateError ? <p className="text-sm text-danger mt-2">{duplicateError}</p> : null}
      </div>

      <div className="pt-3 border-t border-navy-100">
        <ConfirmAction
          triggerLabel="Delete event"
          triggerClassName="btn-danger w-full justify-center"
          consequence={`This permanently deletes "${event.public_title}", including all invitations, responses, and messages tied to it. This cannot be undone.`}
          confirmLabel="Delete permanently"
          onConfirm={async () => {
            const result = await deleteEventAction(event.id);
            return result;
          }}
        />
      </div>
    </div>
  );
}
