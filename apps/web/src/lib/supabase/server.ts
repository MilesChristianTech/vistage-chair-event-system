import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';
import { createMockClient } from '@/lib/preview/mock-client';

/** Server Component / Server Action Supabase client, scoped to the signed-in
 * Host's session (still subject to RLS - Part 2.3). Use this for anything
 * done "as the Host." For anything that must see across tenants (the send
 * worker's logic, public form routes), use lib/supabase/service.ts instead. */
export async function createClient() {
  // PREVIEW_MODE: no real Supabase project configured yet. Swap in the
  // in-memory mock so the whole app can be clicked through against
  // realistic sample data. Never set in a real deployment - see
  // lib/preview/mock-client.ts and docs/OWNER_SETUP_CHECKLIST.md.
  if (process.env.PREVIEW_MODE === 'true') {
    return createMockClient() as unknown as ReturnType<typeof createServerClient<Database>>;
  }

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
            // Called from a Server Component - middleware refreshes the
            // session instead. Safe to ignore.
          }
        },
      },
    }
  );
}
