import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { createMockClient } from '@/lib/preview/mock-client';

/**
 * Service-role Supabase client. Bypasses RLS entirely — Supabase's service
 * key always does. This is intentional and necessary for exactly three
 * things in this app:
 *
 *   1. Public form routes (apps/web/src/app/api/public/**) — an anonymous
 *      invitee has no tenant session, so the server itself must apply the
 *      narrow, purpose-built checks (is this form published? does this
 *      token resolve?) instead of relying on RLS.
 *   2. The send worker (apps/worker) — which must see the shared queue
 *      across ALL tenants at once (Part 7.6).
 *   3. Operator scripts (provisioning tenants, seeding/resetting the demo
 *      tenant) — Part 2.5, 11.3.
 *
 * NEVER import this file from a Client Component, and never let this key
 * reach the browser (12: "nothing sensitive exposed to the browser").
 */
export function createServiceClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createServiceClient() must never be called in the browser.');
  }

  // PREVIEW_MODE: see lib/supabase/server.ts for the rationale.
  if (process.env.PREVIEW_MODE === 'true') {
    return createMockClient() as unknown as ReturnType<typeof createSupabaseClient<Database>>;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL. See docs/OWNER_SETUP_CHECKLIST.md.'
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
