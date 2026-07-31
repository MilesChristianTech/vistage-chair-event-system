'use client';

import { useRouter } from 'next/navigation';
import ConfirmAction from '@/components/confirm-action';
import { updateEventStatusAction, deleteEventAction } from '../../actions';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'inviting', label: 'Inviting' },
  { value: 'closed', label: 'Closed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function EventStatusControls({ event }: { event: { id: string; status: string; public_title: string } }) {
  const router = useRouter();

  return (
    <div className="card p-4 space-y-4">
      <div>
        <h3>Status</h3>
        <select
          className="input"
          defaultValue={event.status}
          onChange={async (e) => {
            await updateEventStatusAction(event.id, e.target.value);
            router.refresh();
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="field-hint">Status shapes what the app shows and suggests — it never blocks you from editing.</p>
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
