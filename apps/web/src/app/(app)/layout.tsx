import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import { signOutAction } from '@/app/sign-in/actions';
import NavLinks from './nav-links';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { data: tenant } = await supabase.from('tenants').select('name, is_demo').eq('id', appUser.tenant_id).single();

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="w-60 shrink-0 bg-navy-900 flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold-400 text-navy-950 font-serif text-sm">
              C
            </span>
            <span className="text-white font-serif text-base leading-tight">Chair Event System</span>
          </div>
          {tenant?.is_demo ? (
            <span className="badge-warn mt-3 inline-flex bg-gold-400/20 text-gold-200">Demo tenant</span>
          ) : null}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks />
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 mb-2">
            <p className="text-white text-sm font-medium truncate">{appUser.display_name}</p>
            <p className="text-navy-300 text-xs truncate">{tenant?.name}</p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="nav-link w-full justify-start">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
