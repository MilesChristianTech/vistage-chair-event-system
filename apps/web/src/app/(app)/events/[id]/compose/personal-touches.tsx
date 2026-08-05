'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveHandwrittenTouchAction, suggestHandwrittenTouchAction } from './actions';

export interface InviteeForTouch {
  id: string;
  personalization_note: string | null;
  person: { id: string; first_name: string; last_name: string; summary_note: string | null } | null;
}

export default function PersonalTouches({ eventId, invitations }: { eventId: string; invitations: InviteeForTouch[] }) {
  const withNote = invitations.filter((i) => i.personalization_note);

  return (
    <div className="card p-5">
      <h3>Personal touches</h3>
      <p className="text-navy-500 text-sm mb-1 max-w-xl">
        Fast and entirely optional. Add one genuine sentence to anyone who warrants it and skip the rest - most
        invitations won’t have one, and that’s fine. Where you add a line, it appears naturally in their email.
      </p>
      <p className="text-navy-400 text-xs mb-4">{withNote.length} of {invitations.length} have a personal touch so far.</p>

      {invitations.length === 0 ? (
        <p className="text-navy-400 text-sm">Add invitees on the Invitees tab first.</p>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => (
            <TouchRow key={inv.id} eventId={eventId} invitation={inv} />
          ))}
        </div>
      )}
    </div>
  );
}

function TouchRow({ eventId, invitation }: { eventId: string; invitation: InviteeForTouch }) {
  const router = useRouter();
  const [note, setNote] = useState(invitation.personalization_note ?? '');
  const [context, setContext] = useState(invitation.person?.summary_note ?? '');
  const [showContextInput, setShowContextInput] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveHandwrittenTouchAction(invitation.id, note);
      if (!result.ok) {
        setError(result.error || 'Could not save that note.');
        return;
      }
      setDirty(false);
      router.refresh();
    });
  }

  function suggest() {
    if (!invitation.person) return;
    setError(null);
    startTransition(async () => {
      const result = await suggestHandwrittenTouchAction({
        eventId,
        personFirstName: invitation.person!.first_name,
        personContext: context || 'No specific context provided - keep it simple and warm.',
      });
      if (result.ok && result.sentence) {
        setNote(result.sentence);
        setDirty(true);
      } else {
        setError(result.error || 'Could not suggest a line. Please try again.');
      }
    });
  }

  if (!invitation.person) return null;

  return (
    <div className="border border-navy-100 rounded p-3">
      <p className="font-medium text-navy-900 text-sm mb-2">
        {invitation.person.first_name} {invitation.person.last_name}
      </p>
      <textarea
        className="input mb-2"
        rows={2}
        placeholder="No personal touch - leave blank to skip"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setDirty(true);
        }}
      />
      {showContextInput ? (
        <textarea
          className="input mb-2 text-xs"
          rows={2}
          placeholder="Optional context to help the Coach write a good line (e.g. from their notes)"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      ) : null}
      {error ? <p className="text-sm text-danger bg-danger-bg rounded px-3 py-2 mb-2">{error}</p> : null}
      <div className="flex items-center gap-2">
        <button className="btn-secondary text-xs" onClick={() => setShowContextInput((s) => !s)}>
          {showContextInput ? 'Hide context' : 'Add context'}
        </button>
        <button className="btn-secondary text-xs" onClick={suggest} disabled={isPending}>
          {isPending ? 'Thinking…' : 'Ask the Coach'}
        </button>
        <button className="btn-primary text-xs" onClick={save} disabled={isPending || !dirty}>
          Save
        </button>
      </div>
    </div>
  );
}
