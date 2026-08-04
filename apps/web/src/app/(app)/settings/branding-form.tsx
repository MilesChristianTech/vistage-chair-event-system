'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateBrandingAction, type ActionResult } from './actions';
import { useSuccessToast } from '@/lib/use-success-toast';
import ImageUploadField from '@/components/image-upload-field';

interface Branding {
  logoUrl?: string;
  accentColor?: string;
  primaryColor?: string;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export default function BrandingForm({ initial }: { initial: Branding | null }) {
  const [state, formAction] = useFormState<ActionResult, FormData>(updateBrandingAction, { ok: true });
  useSuccessToast(state, 'Branding saved.');

  return (
    <form action={formAction} className="space-y-3 max-w-md">
      <ImageUploadField name="logo_url" label="Logo" value={initial?.logoUrl ?? ''} />
      <p className="field-hint -mt-2">Shown centered at the top of your RSVP form, sized to fit automatically.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Primary color</label>
          <input name="primary_color" type="color" defaultValue={initial?.primaryColor ?? '#0f1f3d'} className="input h-10" />
        </div>
        <div>
          <label className="field-label">Accent color</label>
          <input name="accent_color" type="color" defaultValue={initial?.accentColor ?? '#b08d57'} className="input h-10" />
        </div>
      </div>
      {!state.ok && state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SaveButton />
    </form>
  );
}
