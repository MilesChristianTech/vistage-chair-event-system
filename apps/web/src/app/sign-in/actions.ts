'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface SignInState {
  error: string | null;
}

/**
 * Part 2.5: sign-in is the only door in. Rate limiting and hashed-password
 * storage are handled by Supabase Auth itself (never plaintext, never
 * recoverable). This action just relays a friendly error rather than a raw
 * one, and never reveals whether an email exists (no user enumeration).
 */
export async function signInAction(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const next = String(formData.get('next') || '/dashboard');

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes('rate limit')) {
      return { error: 'Too many attempts. Please wait a minute and try again.' };
    }
    return { error: 'That email and password combination doesn’t match. Please try again.' };
  }

  redirect(next.startsWith('/') ? next : '/dashboard');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
