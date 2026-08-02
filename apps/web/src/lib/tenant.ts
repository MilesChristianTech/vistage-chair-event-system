import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Resolves the signed-in Host's app_user + tenant context for use in Server
 * Components and Server Actions. Middleware already guarantees a session
 * exists for any non-public path (Part 2.5); this just fetches the profile
 * row that RLS scopes to that same session.
 */
export async function requireCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { data: appUser, error } = await supabase
    .from('app_users')
    .select('id, tenant_id, display_name, role')
    .eq('id', user.id)
    .single();

  if (error || !appUser) {
    // A Supabase auth user exists but has no app_users row - this means the
    // operator hasn't finished provisioning them (see scripts/provision-tenant.ts).
    redirect('/sign-in?error=account_not_provisioned');
  }

  return { authUser: user, appUser };
}

export async function getTenantSettings(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).single();
  return data;
}

export async function getMailboxConnection(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('mailbox_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data;
}
