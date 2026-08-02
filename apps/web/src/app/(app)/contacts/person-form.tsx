'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createCustomFieldDefinitionAction, type ActionResult, type CustomFieldDefinition } from './actions';
import { useSuccessToast } from '@/lib/use-success-toast';

type RelationshipType = { id: string; label: string };

export interface PersonFormValues {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  company?: string | null;
  title?: string | null;
  relationship_type_id?: string | null;
  contact_preference?: string | null;
  summary_note?: string | null;
  custom_fields?: Record<string, string> | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export default function PersonForm({
  action,
  relationshipTypes,
  customFieldDefinitions,
  initial,
  submitLabel,
  onSuccess,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  relationshipTypes: RelationshipType[];
  customFieldDefinitions: CustomFieldDefinition[];
  initial?: PersonFormValues;
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useFormState(action, { ok: true });
  useSuccessToast(state, 'Saved.');

  const [fields, setFields] = useState(customFieldDefinitions);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [addingField, setAddingField] = useState(false);
  const [addFieldError, setAddFieldError] = useState<string | null>(null);

  async function addField() {
    if (!newFieldLabel.trim()) return;
    setAddingField(true);
    setAddFieldError(null);
    const result = await createCustomFieldDefinitionAction(newFieldLabel);
    setAddingField(false);
    if (!result.ok || !result.field) {
      setAddFieldError(result.error || 'Could not add that field.');
      return;
    }
    setFields((current) => (current.some((f) => f.field_key === result.field!.field_key) ? current : [...current, result.field!]));
    setNewFieldLabel('');
  }

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (state.ok) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="first_name">
            First name *
          </label>
          <input id="first_name" name="first_name" required defaultValue={initial?.first_name ?? ''} className="input" />
        </div>
        <div>
          <label className="field-label" htmlFor="last_name">
            Last name *
          </label>
          <input id="last_name" name="last_name" required defaultValue={initial?.last_name ?? ''} className="input" />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="preferred_name">
          Preferred / greeting name
        </label>
        <input
          id="preferred_name"
          name="preferred_name"
          defaultValue={initial?.preferred_name ?? ''}
          className="input"
          placeholder="e.g. Bill, if their first name is William"
        />
        <p className="field-hint">Used in email greetings when it’s set; falls back to first name otherwise.</p>
      </div>

      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" defaultValue={initial?.email ?? ''} className="input" />
        <p className="field-hint">
          Optional - a person can exist without one, but you won’t be able to email them until it’s added.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="company">
            Company
          </label>
          <input id="company" name="company" defaultValue={initial?.company ?? ''} className="input" />
        </div>
        <div>
          <label className="field-label" htmlFor="title">
            Title
          </label>
          <input id="title" name="title" defaultValue={initial?.title ?? ''} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="relationship_type_id">
            Relationship type
          </label>
          <select
            id="relationship_type_id"
            name="relationship_type_id"
            defaultValue={initial?.relationship_type_id ?? ''}
            className="input"
          >
            <option value="">Not set</option>
            {relationshipTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="contact_preference">
            Contact preference
          </label>
          <select
            id="contact_preference"
            name="contact_preference"
            defaultValue={initial?.contact_preference ?? 'email_ok'}
            className="input"
          >
            <option value="email_ok">Email is fine</option>
            <option value="phone_only">Phone only</option>
            <option value="do_not_contact">Do not contact</option>
          </select>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="summary_note">
          Quick-glance note
        </label>
        <textarea
          id="summary_note"
          name="summary_note"
          rows={2}
          defaultValue={initial?.summary_note ?? ''}
          className="input"
          placeholder="Durable relationship context, e.g. “prefers early-morning events”"
        />
      </div>

      {fields.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.field_key}>
              <label className="field-label" htmlFor={`custom_field__${f.field_key}`}>
                {f.label}
              </label>
              <input
                id={`custom_field__${f.field_key}`}
                name={`custom_field__${f.field_key}`}
                defaultValue={initial?.custom_fields?.[f.field_key] ?? ''}
                className="input"
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="border-t border-navy-100 pt-4">
        <label className="field-label">Add a custom field</label>
        <p className="field-hint mb-2">
          Any classifier you want to track - “Prospect status”, “Chapter”, anything - becomes available on every
          contact going forward.
        </p>
        <div className="flex gap-2">
          <input
            className="input max-w-xs"
            placeholder="e.g. Prospect status"
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
          />
          <button type="button" className="btn-secondary shrink-0" disabled={addingField || !newFieldLabel.trim()} onClick={addField}>
            {addingField ? 'Adding…' : 'Add field'}
          </button>
        </div>
        {addFieldError ? <p className="text-sm text-danger mt-2">{addFieldError}</p> : null}
      </div>

      {!state.ok && state.error ? (
        <p className="text-sm text-danger bg-danger-bg rounded px-3 py-2">{state.error}</p>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
