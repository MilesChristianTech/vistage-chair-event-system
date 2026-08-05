'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveExceptionAction } from './actions';

export default function ExceptionRow({
  response,
  invitationOptions,
}: {
  response: { id: string; submitted_name: string | null; submitted_email: string | null; submitted_at: string; raw_answers: unknown };
  invitationOptions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium text-navy-900 text-sm">{response.submitted_name || 'Unknown name'}</p>
          <p className="text-navy-500 text-xs">{response.submitted_email || 'No email given'}</p>
        </div>
        <span className="text-navy-400 text-xs">{new Date(response.submitted_at).toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Match to a person…</option>
          {invitationOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          className="btn-primary shrink-0"
          disabled={!selected || isSaving}
          onClick={async () => {
            setIsSaving(true);
            setError(null);
            const result = await resolveExceptionAction(response.id, selected);
            if (!result.ok) {
              setError(result.error || 'Could not match this response.');
              setIsSaving(false);
              return;
            }
            router.refresh();
          }}
        >
          Match
        </button>
      </div>
      {error ? <p className="text-xs text-danger mt-2">{error}</p> : null}
    </div>
  );
}
