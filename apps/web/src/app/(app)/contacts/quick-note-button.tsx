'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addPersonNoteAction } from './actions';

/** Lets a Host jot a note on someone right from the Contacts list, without
 * navigating to their full profile — the detail page's Notes panel remains
 * the place to read/manage the full history. */
export default function QuickNoteButton({ personId }: { personId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button className="btn-ghost text-xs" onClick={() => setOpen(true)}>
        + Note
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        className="input text-xs h-8 w-40"
        placeholder="Quick note…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <button
        className="btn-secondary text-xs h-8 px-2"
        disabled={isPending || !body.trim()}
        onClick={() => {
          startTransition(async () => {
            const result = await addPersonNoteAction(personId, body);
            if (result.ok) {
              toast.success('Note added.');
              setBody('');
              setOpen(false);
              router.refresh();
            } else {
              toast.error(result.error || 'Could not save the note.');
            }
          });
        }}
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
      <button className="btn-ghost text-xs h-8 px-2" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
