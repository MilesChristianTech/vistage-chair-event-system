'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateAdvancedSettingsAction, type ActionResult } from './actions';
import { useSuccessToast } from '@/lib/use-success-toast';
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

export default function AdvancedSettingsForm({ initial }: { initial: Settings }) {
  const [state, formAction] = useFormState<ActionResult, FormData>(updateAdvancedSettingsAction, { ok: true });
  useSuccessToast(state, 'Saved.');

  return (
    <form action={formAction} className="space-y-3 max-w-md">
      <p className="text-navy-500 text-xs -mt-1 mb-2">
        Controls the message-variation feature (Part 7.5). The defaults are sensible for almost everyone - change
        these only if you know what you’re doing.
      </p>
      <div>
        <label className="field-label">Variant threshold (recipients)</label>
        <input name="variant_threshold" type="number" min={1} defaultValue={initial?.variant_threshold ?? 60} className="input max-w-[140px]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Min variants</label>
          <input name="variant_count_min" type="number" min={2} defaultValue={initial?.variant_count_min ?? 5} className="input" />
        </div>
        <div>
          <label className="field-label">Max variants</label>
          <input name="variant_count_max" type="number" min={2} defaultValue={initial?.variant_count_max ?? 8} className="input" />
        </div>
      </div>
      {!state.ok && state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SaveButton />
    </form>
  );
}
