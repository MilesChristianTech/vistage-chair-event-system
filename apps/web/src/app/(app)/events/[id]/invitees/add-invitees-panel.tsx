'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { searchPeopleForInviteAction, addInviteesAction, type PersonSearchResult } from '../../actions';

export default function AddInviteesPanel({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [selected, setSelected] = useState<Map<string, PersonSearchResult>>(new Map());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runSearch(q: string) {
    setQuery(q);
    startTransition(async () => {
      const data = await searchPeopleForInviteAction(eventId, q);
      setResults(data);
    });
  }

  function toggle(person: PersonSearchResult) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(person.id)) next.delete(person.id);
      else next.set(person.id, person);
      return next;
    });
  }

  async function addSelected() {
    const ids = Array.from(selected.keys());
    if (ids.length === 0) return;
    setError(null);
    const result = await addInviteesAction(eventId, ids);
    if (!result.ok) {
      setError(result.error || 'Could not add those invitees.');
      return;
    }
    setMessage(
      `Added ${result.addedCount}.${result.skippedCount ? ` (${result.skippedCount} already invited, skipped.)` : ''}`
    );
    setSelected(new Map());
    setResults([]);
    setQuery('');
    router.refresh();
  }

  return (
    <div className="card p-4">
      <h3>Add invitees</h3>
      <input
        className="input mb-3"
        placeholder="Search your contacts by name, company, or email"
        value={query}
        onChange={(e) => runSearch(e.target.value)}
        onFocus={() => query === '' && runSearch('')}
      />

      {results.length > 0 ? (
        <ul className="max-h-64 overflow-y-auto border border-navy-100 rounded divide-y divide-navy-100 mb-3">
          {results.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-navy-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p)} className="accent-navy-800" />
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
          ))}
        </ul>
      ) : isPending ? (
        <p className="text-navy-400 text-sm mb-3">Searching…</p>
      ) : query ? (
        <p className="text-navy-400 text-sm mb-3">No matches (or everyone matching is already invited).</p>
      ) : null}

      {message ? <p className="text-sm text-success mb-3">{message}</p> : null}
      {error ? <p className="text-sm text-danger mb-3">{error}</p> : null}

      <button className="btn-primary" disabled={selected.size === 0} onClick={addSelected}>
        Add {selected.size > 0 ? selected.size : ''} to this event
      </button>
    </div>
  );
}
