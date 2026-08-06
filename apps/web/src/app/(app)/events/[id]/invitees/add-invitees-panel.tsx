'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAllPeopleForInviteAction, addInviteesAction, type PersonSearchResult } from '../../actions';

export default function AddInviteesPanel({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [allPeople, setAllPeople] = useState<PersonSearchResult[] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllPeopleForInviteAction(eventId).then(setAllPeople);
  }, [eventId]);

  const filtered = useMemo(() => {
    if (!allPeople) return [];
    const q = query.trim().toLowerCase();
    if (!q) return allPeople;
    return allPeople.filter((p) => `${p.first_name} ${p.last_name} ${p.company ?? ''} ${p.email ?? ''}`.toLowerCase().includes(q));
  }, [allPeople, query]);

  const allSelected = allPeople !== null && allPeople.length > 0 && selected.size === allPeople.length;

  function toggleAll() {
    if (!allPeople) return;
    setSelected(allSelected ? new Set() : new Set(allPeople.map((p) => p.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setError(null);
    setIsSaving(true);
    const result = await addInviteesAction(eventId, ids);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error || 'Could not add those invitees.');
      return;
    }
    setMessage(`Added ${result.addedCount}.${result.skippedCount ? ` (${result.skippedCount} already invited, skipped.)` : ''}`);
    setSelected(new Set());
    setAllPeople((prev) => prev?.filter((p) => !ids.includes(p.id)) ?? null);
    router.refresh();
  }

  return (
    <div className="card p-4">
      <h3>Add invitees</h3>
      <p className="text-navy-500 text-xs mb-3">
        Everyone in your contact database who isn’t already on this event is listed below. Select all and uncheck
        anyone you don’t want to invite, or search to narrow the list first.
      </p>

      <input
        className="input mb-3"
        placeholder="Search by name, company, or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {allPeople === null ? (
        <p className="text-navy-400 text-sm mb-3">Loading your contacts…</p>
      ) : allPeople.length === 0 ? (
        <p className="text-navy-400 text-sm mb-3">Everyone in your contact database is already invited to this event.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm px-1 py-1.5 border-b border-navy-100 mb-1 cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-navy-800" />
            <span className="font-medium text-navy-900">
              Select all - {selected.size} of {allPeople.length} selected
            </span>
          </label>
          <ul className="max-h-80 overflow-y-auto border border-navy-100 rounded divide-y divide-navy-100 mb-3">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-navy-400">No matches.</li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-navy-50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="accent-navy-800" />
                    <span className="flex-1">
                      <span className="font-medium text-navy-900">
                        {p.first_name} {p.last_name}
                      </span>
                      {p.company ? <span className="text-navy-500"> · {p.company}</span> : null}
                      {!p.email ? <span className="text-danger text-xs ml-2">No email</span> : null}
                      {p.contact_preference === 'do_not_contact' ? (
                        <span className="text-danger text-xs ml-2">Do not contact</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </>
      )}

      {message ? <p className="text-sm text-success mb-3">{message}</p> : null}
      {error ? <p className="text-sm text-danger mb-3">{error}</p> : null}

      <button className="btn-primary" disabled={selected.size === 0 || isSaving} onClick={addSelected}>
        {isSaving ? 'Adding…' : `Add ${selected.size > 0 ? selected.size : ''} to this event`}
      </button>
    </div>
  );
}
