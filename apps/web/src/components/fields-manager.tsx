'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmAction from '@/components/confirm-action';
import {
  createCustomFieldDefinitionAction,
  renameCustomFieldDefinitionAction,
  deleteCustomFieldDefinitionAction,
  type CustomFieldDefinition,
} from '@/app/(app)/contacts/actions';

const CORE_FIELDS = ['First Name', 'Last Name', 'Company', 'Title', 'Email'];

const SUGGESTIONS = ['Work Phone', 'Mobile', 'Revenue', 'LinkedIn URL', 'Birthday', 'Assistant Name'];

export default function FieldsManager({ initialFields }: { initialFields: CustomFieldDefinition[] }) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [newLabel, setNewLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = SUGGESTIONS.filter(
    (s) => !fields.some((f) => f.label.trim().toLowerCase() === s.toLowerCase())
  );

  async function addField(label: string) {
    if (!label.trim()) return;
    setIsAdding(true);
    setError(null);
    const result = await createCustomFieldDefinitionAction(label);
    setIsAdding(false);
    if (!result.ok || !result.field) {
      setError(result.error || 'Could not add that field.');
      return;
    }
    setFields((current) => (current.some((f) => f.field_key === result.field!.field_key) ? current : [...current, result.field!]));
    setNewLabel('');
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <p className="field-label mb-1.5">Always included</p>
        <div className="flex flex-wrap gap-1.5">
          {CORE_FIELDS.map((f) => (
            <span key={f} className="badge-neutral">
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="field-label mb-1.5">Your fields</p>
        {fields.length === 0 ? (
          <p className="text-navy-400 text-sm">No custom fields yet - add whatever else matters to you below.</p>
        ) : (
          <ul className="space-y-1.5">
            {fields.map((f) => (
              <FieldRow
                key={f.id}
                field={f}
                onRenamed={(label) => setFields((current) => current.map((c) => (c.id === f.id ? { ...c, label } : c)))}
                onDeleted={() => setFields((current) => current.filter((c) => c.id !== f.id))}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="Field name, e.g. Work Phone"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addField(newLabel);
            }}
          />
          <button type="button" className="btn-secondary shrink-0" disabled={isAdding || !newLabel.trim()} onClick={() => addField(newLabel)}>
            {isAdding ? 'Adding…' : 'Add field'}
          </button>
        </div>
        {error ? <p className="text-xs text-danger mt-1.5">{error}</p> : null}
      </div>

      {suggestions.length > 0 ? (
        <div>
          <p className="text-xs text-navy-400 mb-1.5">Quick add</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} type="button" className="btn-ghost text-xs border border-navy-100" disabled={isAdding} onClick={() => addField(s)}>
                + {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldRow({
  field,
  onRenamed,
  onDeleted,
}: {
  field: CustomFieldDefinition;
  onRenamed: (label: string) => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!label.trim() || label === field.label) {
      setEditing(false);
      setLabel(field.label);
      return;
    }
    setIsSaving(true);
    setError(null);
    const result = await renameCustomFieldDefinitionAction(field.id, label);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error || 'Could not rename that field.');
      return;
    }
    onRenamed(label.trim());
    setEditing(false);
    router.refresh();
  }

  return (
    <li className="flex items-center gap-2 border border-navy-100 rounded px-3 py-1.5">
      {editing ? (
        <input
          autoFocus
          className="input py-1 text-sm flex-1"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setLabel(field.label);
              setEditing(false);
            }
          }}
          disabled={isSaving}
        />
      ) : (
        <button type="button" className="flex-1 text-left text-sm text-navy-800 hover:text-navy-950" onClick={() => setEditing(true)}>
          {field.label}
        </button>
      )}
      <ConfirmAction
        triggerLabel="Delete"
        triggerClassName="btn-ghost text-xs text-danger shrink-0"
        consequence={`This removes "${field.label}" as a field. Values already saved under it aren't deleted, they just won't show anywhere until you re-add a field with the same name.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          const result = await deleteCustomFieldDefinitionAction(field.id);
          if (result.ok) {
            onDeleted();
            router.refresh();
          }
          return result;
        }}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </li>
  );
}
