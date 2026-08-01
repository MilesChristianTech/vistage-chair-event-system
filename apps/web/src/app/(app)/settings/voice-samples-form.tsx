'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateVoiceSamplesAction, type ActionResult } from './actions';
import { useSuccessToast } from '@/lib/use-success-toast';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export default function VoiceSamplesForm({ initial }: { initial: string[] }) {
  const [state, formAction] = useFormState<ActionResult, FormData>(updateVoiceSamplesAction, { ok: true });
  useSuccessToast(state, 'Saved.');

  return (
    <form action={formAction} className="space-y-3 max-w-2xl">
      <p className="text-navy-500 text-sm -mt-1 mb-2">
        Paste in one to three real invitation or event emails you’ve actually sent before. The Coach reads these to
        match how you naturally write — your phrasing, formality, and format — instead of writing generically.
        Optional, but drafts get noticeably more accurate with even one example.
      </p>
      {[1, 2, 3].map((n) => (
        <div key={n}>
          <label className="field-label">Example email {n}</label>
          <textarea name={`sample_${n}`} rows={5} defaultValue={initial[n - 1] ?? ''} className="input font-sans" />
        </div>
      ))}
      {!state.ok && state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SaveButton />
    </form>
  );
}
