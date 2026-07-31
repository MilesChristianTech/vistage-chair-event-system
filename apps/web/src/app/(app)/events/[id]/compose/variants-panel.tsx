'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { regenerateVariantsAction, updateVariantAction } from './actions';

export interface VariantRow {
  id: string;
  variant_index: number;
  subject: string;
  body: string;
  is_active: boolean;
}

export default function VariantsPanel({
  eventId,
  variants,
  invitedCount,
  threshold,
  countMin,
  countMax,
}: {
  eventId: string;
  variants: VariantRow[];
  invitedCount: number;
  threshold: number;
  countMin: number;
  countMax: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string }>({ subject: '', body: '' });

  function regenerate() {
    setError(null);
    const count = Math.min(countMax, Math.max(countMin, Math.ceil(invitedCount / 80) + countMin));
    startTransition(async () => {
      const result = await regenerateVariantsAction(eventId, count);
      if (!result.ok) setError(result.error || 'Could not generate variants.');
      else router.refresh();
    });
  }

  function startEdit(v: VariantRow) {
    setEditingId(v.id);
    setDraft({ subject: v.subject, body: v.body });
  }

  function saveEdit() {
    if (!editingId) return;
    startTransition(async () => {
      await updateVariantAction(editingId, draft);
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3>Message variants</h3>
          <p className="text-navy-500 text-sm max-w-xl">
            For sends above {threshold} recipients, we generate a handful of differently-worded versions of your
            invitation and rotate them across the send so it never looks like one identical email photocopied
            hundreds of times. Every version means the same thing — only the wording differs — and you can read,
            edit, or regenerate any of them here before you send.
          </p>
        </div>
        <button className="btn-secondary shrink-0" onClick={regenerate} disabled={isPending}>
          {isPending ? 'Generating…' : variants.length > 0 ? 'Regenerate all' : 'Generate variants'}
        </button>
      </div>

      {invitedCount < threshold ? (
        <p className="text-navy-400 text-xs mb-4">
          This event currently has {invitedCount} invitees, under the {threshold}-recipient threshold — a single
          version is fine, but you're welcome to generate variants anyway.
        </p>
      ) : null}

      {error ? <p className="text-sm text-danger bg-danger-bg rounded px-3 py-2 mb-4">{error}</p> : null}

      {variants.length === 0 ? (
        <p className="text-navy-400 text-sm">No variants generated yet.</p>
      ) : (
        <div className="space-y-3">
          {variants.map((v) => (
            <div key={v.id} className="border border-navy-100 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-navy-500 uppercase tracking-wide">Variant {v.variant_index}</span>
                {editingId === v.id ? (
                  <div className="flex gap-2">
                    <button className="btn-ghost text-xs" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    <button className="btn-primary text-xs" onClick={saveEdit} disabled={isPending}>
                      Save
                    </button>
                  </div>
                ) : (
                  <button className="btn-ghost text-xs" onClick={() => startEdit(v)}>
                    Edit
                  </button>
                )}
              </div>
              {editingId === v.id ? (
                <>
                  <input
                    className="input mb-2"
                    value={draft.subject}
                    onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                  />
                  <textarea
                    className="input"
                    rows={8}
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  />
                </>
              ) : (
                <>
                  <p className="font-medium text-navy-900 text-sm mb-1">{v.subject}</p>
                  <p className="text-navy-600 text-sm whitespace-pre-wrap">{v.body}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
