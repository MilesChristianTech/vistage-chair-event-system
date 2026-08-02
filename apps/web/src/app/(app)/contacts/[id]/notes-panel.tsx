'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { addPersonNoteFormAction, deletePersonNoteAction, type ActionResult } from '../actions';

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Adding…' : 'Add note'}
    </button>
  );
}

export default function NotesPanel({
  personId,
  notes,
}: {
  personId: string;
  notes: { id: string; body: string; created_at: string }[];
}) {
  const router = useRouter();
  const action = addPersonNoteFormAction.bind(null, personId);
  const [state, formAction] = useFormState<ActionResult, FormData>(action, { ok: true });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDelete(noteId: string) {
    setDeletingId(noteId);
    startTransition(async () => {
      await deletePersonNoteAction(noteId, personId);
      setDeletingId(null);
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <h3>Notes</h3>
      <p className="text-navy-500 text-xs mb-3">
        Private relationship context. Never used in a message unless you deliberately add it yourself.
      </p>

      <form action={formAction} className="flex items-start gap-2 mb-4">
        <textarea
          name="body"
          rows={2}
          required
          className="input flex-1"
          placeholder="e.g. Met at the Q1 breakfast, cares most about succession planning"
        />
        <AddButton />
      </form>
      {!state.ok && state.error ? <p className="text-sm text-danger mb-3">{state.error}</p> : null}

      {notes.length === 0 ? (
        <p className="text-sm text-navy-400">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="text-sm border-l-2 border-gold-300 pl-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-navy-800">{n.body}</p>
                <p className="text-navy-400 text-xs mt-0.5">
                  {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button
                className="btn-ghost text-xs text-danger shrink-0"
                disabled={deletingId === n.id}
                onClick={() => handleDelete(n.id)}
              >
                {deletingId === n.id ? 'Removing…' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
