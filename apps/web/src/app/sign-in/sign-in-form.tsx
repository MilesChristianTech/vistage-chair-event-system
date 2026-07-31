'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { signInAction, type SignInState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export default function SignInForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState<SignInState, FormData>(signInAction, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next || '/dashboard'} />

      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-danger bg-danger-bg rounded px-3 py-2" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
