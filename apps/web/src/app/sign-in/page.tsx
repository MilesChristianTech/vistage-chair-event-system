import { Suspense } from 'react';
import SignInForm from './sign-in-form';
import SignInShell from './sign-in-shell';

// Part 2.5 / 10.4: "a single, clean, branded sign-in screen ... and nothing
// else. No marketing copy, no feature list, no pricing, no 'create account'
// option." This is deliberately the entire page.
export default function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <SignInShell>
      <Suspense fallback={null}>
        <SignInForm next={searchParams?.next} />
      </Suspense>
    </SignInShell>
  );
}
