'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { signInAction, type SignInState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full group" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing in…
        </>
      ) : (
        <>
          Sign in
          <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-premium group-hover:translate-x-0.5" />
        </>
      )}
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
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
          <input id="email" name="email" type="email" autoComplete="email" required className="input pl-9" />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input pl-9"
          />
        </div>
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
