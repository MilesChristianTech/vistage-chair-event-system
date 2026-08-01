'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { changePasswordAction, type ActionResult } from './actions';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Updating…' : 'Update password'}
    </button>
  );
}

export default function ChangePasswordForm() {
  const [state, formAction] = useFormState<ActionResult, FormData>(changePasswordAction, { ok: true });
  const formRef = useRef<HTMLFormElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (state.ok) {
      toast.success('Password updated.');
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 max-w-sm">
      <div>
        <label className="field-label">New password</label>
        <input name="new_password" type="password" required minLength={8} className="input" />
      </div>
      <div>
        <label className="field-label">Confirm new password</label>
        <input name="confirm_password" type="password" required minLength={8} className="input" />
      </div>
      {!state.ok && state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SaveButton />
    </form>
  );
}
