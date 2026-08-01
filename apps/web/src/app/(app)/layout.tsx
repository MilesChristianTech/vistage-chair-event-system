import { LogOut } from 'lucide-react';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import { signOutAction } from '@/app/sign-in/actions';
import NavLinks from './nav-links';
import CommandPalette from '@/components/command-palette';
import BrandMark from '@/components/brand-mark';
import { Toaster } from 'sonner';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { data: tenant } = await supabase.from('tenants').select('name, is_demo').eq('id', appUser.tenant_id).single();

  const initials = appUser.display_name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-paper">
      <Toaster position="bottom-right" toastOptions={{ className: 'font-sans text-sm' }} />

      <aside className="relative w-60 shrink-0 flex flex-col bg-gradient-to-b from-navy-950 to-navy-975">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/0 via-white/10 to-white/0" />

        <div className="px-5 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-white font-serif text-base leading-tight">Chair Event System</span>
          </div>
          {tenant?.is_demo ? (
            <span className="badge-warn mt-3 inline-flex bg-gold-400/15 text-gold-200 border border-gold-400/20">
              Demo tenant
            </span>
          ) : null}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks />
        </nav>

        <div className="px-3 py-4 border-t border-white/[0.07]">
          <div className="flex items-center gap-2.5 px-1 mb-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy-600 to-navy-800 text-[11px] font-semibold text-white ring-1 ring-white/10">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate leading-tight">{appUser.display_name}</p>
              <p className="text-navy-400 text-xs truncate">{tenant?.name}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="nav-link w-full justify-start">
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-end border-b border-navy-100 bg-white/80 backdrop-blur px-6 py-2.5">
          <CommandPalette />
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
