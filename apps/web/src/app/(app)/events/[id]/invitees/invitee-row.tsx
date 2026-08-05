'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateInvitationAction, removeInviteeAction } from '../../actions';

const SEGMENTS = ['priority', 'member', 'prospect', 'guest', 'referral', 'other'];
const RSVP_STATUSES = ['no_response', 'yes', 'maybe', 'no', 'waitlisted', 'cancelled'];
const RSVP_LABELS: Record<string, string> = {
  no_response: 'No response',
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
  waitlisted: 'Waitlisted',
  cancelled: 'Cancelled',
};

export interface InviteeRowData {
  id: string;
  audience_segment: string;
  invite_status: string;
  rsvp_status: string;
  person: { id: string; first_name: string; last_name: string; email: string | null } | null;
}

export default function InviteeRow({ eventId, invitee }: { eventId: string; invitee: InviteeRowData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <tr className="hover:bg-navy-50 align-top">
      <td className="px-4 py-2.5">
        {invitee.person ? (
          <a href={`/contacts/${invitee.person.id}`} className="font-medium text-navy-900">
            {invitee.person.first_name} {invitee.person.last_name}
          </a>
        ) : (
          <span className="text-navy-300">Unknown</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-navy-500">{invitee.person?.email || <span className="text-danger text-xs">No email</span>}</td>
      <td className="px-4 py-2.5">
        <select
          className="input py-1"
          defaultValue={invitee.audience_segment}
          onChange={async (e) => {
            setError(null);
            const result = await updateInvitationAction(invitee.id, { audience_segment: e.target.value });
            if (!result.ok) {
              setError(result.error || 'Could not update segment.');
              return;
            }
            router.refresh();
          }}
        >
          {SEGMENTS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={invitee.invite_status} />
      </td>
      <td className="px-4 py-2.5">
        <select
          className="input py-1"
          defaultValue={invitee.rsvp_status}
          onChange={async (e) => {
            setError(null);
            const result = await updateInvitationAction(invitee.id, { rsvp_status: e.target.value });
            if (!result.ok) {
              setError(result.error || 'Could not update RSVP status.');
              return;
            }
            router.refresh();
          }}
        >
          {RSVP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RSVP_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5 text-right">
        <button
          className="btn-ghost text-danger"
          onClick={async () => {
            setError(null);
            const result = await removeInviteeAction(eventId, invitee.id);
            if (!result.ok && result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          }}
        >
          Remove
        </button>
        {error ? <p className="text-danger text-xs mt-1 max-w-[220px] text-right">{error}</p> : null}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    planned: 'badge-neutral',
    ready: 'badge-neutral',
    sent: 'badge-success',
    held: 'badge-warn',
    bounced: 'badge-danger',
    withdrawn: 'badge-neutral',
  };
  return <span className={map[status] ?? 'badge-neutral'}>{status}</span>;
}
