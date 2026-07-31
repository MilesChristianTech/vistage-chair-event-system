import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

/** Server Component / Server Action Supabase client, scoped to the signed-in
 * Host's session (still subject to RLS — Part 2.3). Use this for anything
 * done "as the Host." For anything that must see across tenants (the send
 * worker's logic, public form routes), use lib/supabase/service.ts instead. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware refreshes the
            // session instead. Safe to ignore.
          }
        },
      },
    }
  );
}
