'use client';

import { useState } from 'react';
import PersonForm, { type PersonFormValues } from '../person-form';
import { updatePersonFormAction } from '../actions';

export default function ProfileEditor({
  person,
  relationshipTypeLabel,
  relationshipTypes,
}: {
  person: PersonFormValues & { id: string };
  relationshipTypeLabel: string | null;
  relationshipTypes: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="mb-0">Edit details</h3>
          <button className="btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        <PersonForm
          action={updatePersonFormAction.bind(null, person.id)}
          relationshipTypes={relationshipTypes}
          initial={person}
          submitLabel="Save changes"
        />
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="mb-0">Details</h3>
        <button className="btn-ghost" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
      <dl className="space-y-3 text-sm">
        <Row label="Preferred name" value={person.preferred_name} />
        <Row label="Email" value={person.email} empty="No email on file" />
        <Row label="Company" value={person.company} />
        <Row label="Title" value={person.title} />
        <Row label="Relationship type" value={relationshipTypeLabel} />
        <Row
          label="Contact preference"
          value={
            person.contact_preference === 'do_not_contact'
              ? 'Do not contact'
              : person.contact_preference === 'phone_only'
                ? 'Phone only'
                : 'Email is fine'
          }
        />
        <Row label="Note" value={person.summary_note} />
      </dl>
    </div>
  );
}

function Row({ label, value, empty }: { label: string; value?: string | null; empty?: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-40 shrink-0 text-navy-500">{label}</dt>
      <dd className="text-navy-900">{value || <span className="text-navy-300">{empty || '—'}</span>}</dd>
    </div>
  );
}
