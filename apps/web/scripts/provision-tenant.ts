/**
 * Provisions a new Host (Part 2.5, 11.3): "Accounts are created by the
 * operator directly on the backend." There is no in-app signup in V1 — this
 * script IS the signup flow, run by the operator.
 *
 * Usage:
 *   npm run provision:tenant -- --email host@example.com --password "TempPass123!" --name "Cindy Smith" --tenant "Cindy Smith Coaching"
 *
 * Requires .env.local (or real env vars) with NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY set — see docs/OWNER_SETUP_CHECKLIST.md.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key?.startsWith('--')) {
      const name = key.slice(2);
      const value = argv[i + 1];
      args[name] = value ?? '';
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const email = args.email;
  const password = args.password;
  const displayName = args.name || email?.split('@')[0] || 'Host';
  const tenantName = args.tenant || displayName;

  if (!email || !password) {
    console.error('Usage: npm run provision:tenant -- --email you@example.com --password "..." --name "Full Name" --tenant "Org Name"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log(`Creating tenant "${tenantName}"...`);
  const { data: tenant, error: tenantError } = await supabase.from('tenants').insert({ name: tenantName }).select('id').single();
  if (tenantError || !tenant) {
    console.error('Failed to create tenant:', tenantError?.message);
    process.exit(1);
  }

  console.log(`Creating auth user ${email}...`);
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    console.error('Failed to create auth user:', authError?.message);
    process.exit(1);
  }

  const { error: appUserError } = await supabase.from('app_users').insert({
    id: authUser.user.id,
    tenant_id: tenant.id,
    display_name: displayName,
    role: 'host',
  });
  if (appUserError) {
    console.error('Failed to create app_users row:', appUserError.message);
    process.exit(1);
  }

  console.log('\nDone. Give the Host these sign-in details:');
  console.log(`  URL:      ${process.env.NEXT_PUBLIC_APP_URL || '(your app URL)'}/sign-in`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('\nTell them to change their password in Settings after first sign-in.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
