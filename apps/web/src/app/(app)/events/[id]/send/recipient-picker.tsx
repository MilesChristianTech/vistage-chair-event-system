'use client';

import { useMemo, useState } from 'react';
import type { RecipientPreview } from './actions';

export default function RecipientPicker({
  recipients,
  excluded,
  onToggleExclude,
  onToggleAll,
}: {
  recipients: RecipientPreview[];
  excluded: Set<string>;
  onToggleExclude: (invitationId: string) => void;
  onToggleAll: (exclude: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const includedCount = recipients.length - excluded.size;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => `${r.name} ${r.email ?? ''}`.toLowerCase().includes(q));
  }, [recipients, query]);

  return (
    <div className="mb-4">
      <button type="button" className="flex items-center justify-between w-full text-left" onClick={() => setExpanded((e) => !e)}>
        <span className="field-label mb-0">
          Recipients - {includedCount} of {recipients.length} will get this
        </span>
        <span className="text-navy-400 text-xs">{expanded ? 'Hide list' : 'Review list'}</span>
      </button>
      <p className="field-hint">
        This is narrower than the event’s full invitee list - only who’s actually eligible for this specific message.
        Uncheck anyone here who doesn’t need it right now.
      </p>

      {expanded ? (
        <div className="mt-2 border border-navy-100 rounded">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-navy-100 bg-navy-50">
            <input
              className="input py-1 text-sm max-w-xs"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex gap-2 shrink-0">
              <button type="button" className="btn-ghost text-xs" onClick={() => onToggleAll(false)}>
                Select all
              </button>
              <button type="button" className="btn-ghost text-xs" onClick={() => onToggleAll(true)}>
                Deselect all
              </button>
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto divide-y divide-navy-100">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-navy-400">No matches.</li>
            ) : (
              filtered.map((r) => (
                <li key={r.invitationId}>
                  <label className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-navy-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!excluded.has(r.invitationId)}
                      onChange={() => onToggleExclude(r.invitationId)}
                      className="accent-navy-800"
                    />
                    <span className="flex-1">
                      <span className="font-medium text-navy-900">{r.name}</span>
                      {r.email ? <span className="text-navy-500"> · {r.email}</span> : null}
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
