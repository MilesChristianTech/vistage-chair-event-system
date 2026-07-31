'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordManualResponseAction } from './actions';

export default function ManualEntryPanel({
  eventId,
  invitationOptions,
}: {
  eventId: string;
  invitationOptions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [invitationId, setInvitationId] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'yes' | 'no' | 'maybe'>('yes');
  const [guestCount, setGuestCount] = useState(0);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="card p-5 max-w-lg">
      <h3>Record a response you received another way</h3>
      <p className="text-navy-500 text-sm mb-4">
        For a reply that came by phone, email, or in person — this never touches the hosted form's own records.
      </p>

      <div className="mb-3">
        <label className="field-label">Who?</label>
        <select className="input" value={invitationId} onChange={(e) => setInvitationId(e.target.value)}>
          <option value="">Select a person…</option>
          {invitationOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="field-label">Response</label>
        <select className="input" value={rsvpStatus} onChange={(e) => setRsvpStatus(e.target.value as 'yes' | 'no' | 'maybe')}>
          <option value="yes">Yes, attending</option>
          <option value="maybe">Not certain yet</option>
          <option value="no">Cannot attend</option>
        </select>
      </div>

      {rsvpStatus === 'yes' ? (
        <div className="mb-3">
          <label className="field-label">Guest count</label>
          <input type="number" min={0} className="input max-w-[120px]" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} />
        </div>
      ) : null}

      <div className="mb-4">
        <label className="field-label">Note (optional)</label>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {saved ? <p className="text-sm text-success mb-3">Recorded.</p> : null}

      <button
        className="btn-primary"
        disabled={!invitationId || isSaving}
        onClick={async () => {
          setIsSaving(true);
          const result = await recordManualResponseAction({ eventId, invitationId, rsvpStatus, guestCount, note });
          setIsSaving(false);
          if (result.ok) {
            setSaved(true);
            router.refresh();
          }
        }}
      >
        Save response
      </button>
    </div>
  );
}
