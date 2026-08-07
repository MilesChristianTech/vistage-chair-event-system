'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/avatar';
import { updatePersonFieldAction, updatePersonCustomFieldAction, type CustomFieldDefinition } from './actions';

export interface ContactRowData {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  is_active: boolean;
  contact_preference: string;
  custom_fields: Record<string, string> | null;
}

export default function ContactRow({ person, customFields }: { person: ContactRowData; customFields: CustomFieldDefinition[] }) {
  return (
    <tr className="hover:bg-navy-50 transition-colors duration-150">
      <td className="pl-4 pr-1 py-1.5">
        <Link href={`/contacts/${person.id}`}>
          <Avatar firstName={person.first_name} lastName={person.last_name} size="sm" />
        </Link>
      </td>
      <EditableCell value={person.first_name} onSave={(v) => updatePersonFieldAction(person.id, 'first_name', v)} />
      <EditableCell value={person.last_name} onSave={(v) => updatePersonFieldAction(person.id, 'last_name', v)} />
      <EditableCell value={person.company ?? ''} onSave={(v) => updatePersonFieldAction(person.id, 'company', v)} />
      <EditableCell value={person.title ?? ''} onSave={(v) => updatePersonFieldAction(person.id, 'title', v)} />
      <EditableCell
        value={person.email ?? ''}
        placeholder="No email on file"
        placeholderClassName="text-danger text-xs"
        onSave={(v) => updatePersonFieldAction(person.id, 'email', v)}
        suffix={
          person.contact_preference === 'do_not_contact' ? (
            <span className="badge-danger ml-1.5 shrink-0">Do not contact</span>
          ) : person.contact_preference === 'phone_only' ? (
            <span className="badge-warn ml-1.5 shrink-0">Phone only</span>
          ) : null
        }
      />
      {customFields.map((f) => (
        <EditableCell
          key={f.id}
          value={person.custom_fields?.[f.field_key] ?? ''}
          onSave={(v) => updatePersonCustomFieldAction(person.id, f.field_key, v)}
        />
      ))}
      {!person.is_active ? (
        <td className="px-2 py-1.5">
          <span className="badge-neutral">Inactive</span>
        </td>
      ) : (
        <td className="px-2 py-1.5" />
      )}
    </tr>
  );
}

function EditableCell({
  value,
  onSave,
  placeholder,
  placeholderClassName,
  suffix,
}: {
  value: string;
  onSave: (value: string) => Promise<{ ok: boolean; error?: string }>;
  placeholder?: string;
  placeholderClassName?: string;
  suffix?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setIsSaving(true);
    setError(null);
    const result = await onSave(draft);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error || 'Could not save.');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <td className="px-2 py-1">
        <input
          autoFocus
          className="input py-1 text-sm w-full min-w-[120px]"
          value={draft}
          disabled={isSaving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setDraft(value);
              setEditing(false);
            }
          }}
        />
        {error ? <p className="text-xs text-danger mt-0.5">{error}</p> : null}
      </td>
    );
  }

  return (
    <td className="px-2 py-1.5">
      <button
        type="button"
        className="flex items-center w-full text-left px-1.5 py-1 rounded hover:bg-navy-100 text-sm text-navy-700"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value ? (
          <span className="truncate">{value}</span>
        ) : (
          <span className={placeholderClassName ?? 'text-navy-300'}>{placeholder ?? '-'}</span>
        )}
        {suffix}
      </button>
    </td>
  );
}
