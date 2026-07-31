'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateHostProfileAction, type ActionResult } from './actions';
import type { Database } from '@/lib/database.types';

type Settings = Database['public']['Tables']['tenant_settings']['Row'] | null | undefined;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export default function HostProfileForm({ initial }: { initial: Settings }) {
  const [state, formAction] = useFormState<ActionResult, FormData>(updateHostProfileAction, { ok: true });

  return (
    <form action={formAction} className="space-y-3 max-w-md">
      <div>
        <label className="field-label">Your name</label>
        <input name="host_display_name" defaultValue={initial?.host_display_name ?? ''} className="input" />
      </div>
      <div>
        <label className="field-label">Email sign-off</label>
        <textarea name="host_signature" rows={2} defaultValue={initial?.host_signature ?? ''} className="input" placeholder="e.g. Warmly,\nCindy" />
      </div>
      {!state.ok && state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SaveButton />
    </form>
  );
}
