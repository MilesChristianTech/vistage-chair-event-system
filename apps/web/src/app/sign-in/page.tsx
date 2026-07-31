import { Suspense } from 'react';
import SignInForm from './sign-in-form';

// Part 2.5 / 10.4: "a single, clean, branded sign-in screen ... and nothing
// else. No marketing copy, no feature list, no pricing, no 'create account'
// option." This is deliberately the entire page.
export default function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <main className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold-400/90 text-navy-950 font-serif text-xl mb-4">
            C
          </div>
          <h1 className="text-white font-serif text-2xl">Chair Event System</h1>
          <p className="text-navy-300 text-sm mt-1">Sign in to continue</p>
        </div>

        <div className="card bg-white p-6">
          <Suspense fallback={null}>
            <SignInForm next={searchParams?.next} />
          </Suspense>
        </div>

        <p className="text-center text-navy-400 text-xs mt-6">
          Access is by invitation only. Contact your administrator if you need an account.
        </p>
      </div>
    </main>
  );
}
