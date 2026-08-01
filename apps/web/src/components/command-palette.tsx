'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Users, CalendarDays, Settings, UserPlus, CalendarPlus, Upload, Search, type LucideIcon } from 'lucide-react';

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  action: () => void;
  keywords?: string[];
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  const navItems: Item[] = [
    { id: 'nav-home', label: 'Go to Home', icon: LayoutDashboard, action: () => go('/dashboard') },
    { id: 'nav-contacts', label: 'Go to Contacts', icon: Users, action: () => go('/contacts') },
    { id: 'nav-events', label: 'Go to Events', icon: CalendarDays, action: () => go('/events') },
    { id: 'nav-settings', label: 'Go to Settings', icon: Settings, action: () => go('/settings') },
  ];

  const actionItems: Item[] = [
    { id: 'action-new-event', label: 'Create a new event', icon: CalendarPlus, action: () => go('/events/new') },
    { id: 'action-add-person', label: 'Add a person', icon: UserPlus, action: () => go('/contacts/new') },
    { id: 'action-import', label: 'Import contacts', icon: Upload, action: () => go('/contacts/import') },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 rounded-md border border-navy-200 bg-white px-3 py-1.5 text-sm text-navy-500 shadow-xs hover:border-navy-300 hover:text-navy-700 transition-all duration-200 ease-premium"
      >
        <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
        Search or jump to…
        <kbd className="ml-2 rounded border border-navy-200 bg-navy-50 px-1.5 py-0.5 text-[10px] font-sans text-navy-500">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-navy-975/50 backdrop-blur-sm"
              onClick={close}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-1/2 top-[16vh] z-50 w-full max-w-lg -translate-x-1/2 px-4"
            >
              <Command
                className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-popover"
                shouldFilter
              >
                <div className="flex items-center gap-2 border-b border-navy-100 px-4">
                  <Search className="h-4 w-4 text-navy-400" strokeWidth={1.75} />
                  <Command.Input
                    autoFocus
                    placeholder="Search or jump to…"
                    className="w-full bg-transparent py-3.5 text-sm text-ink placeholder:text-navy-400 focus:outline-none"
                  />
                  <kbd className="rounded border border-navy-200 bg-navy-50 px-1.5 py-0.5 text-[10px] text-navy-400">
                    esc
                  </kbd>
                </div>
                <Command.List className="max-h-80 overflow-y-auto p-2">
                  <Command.Empty className="py-8 text-center text-sm text-navy-400">No matches.</Command.Empty>
                  <Command.Group heading="Navigate" className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-navy-400 [&_[cmdk-group-items]]:mt-1">
                    {navItems.map((item) => (
                      <PaletteItem key={item.id} item={item} />
                    ))}
                  </Command.Group>
                  <Command.Group heading="Quick actions" className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-navy-400 [&_[cmdk-group-items]]:mt-1">
                    {actionItems.map((item) => (
                      <PaletteItem key={item.id} item={item} />
                    ))}
                  </Command.Group>
                </Command.List>
              </Command>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function PaletteItem({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <Command.Item
      onSelect={item.action}
      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-navy-800 cursor-pointer
                 data-[selected=true]:bg-navy-50 data-[selected=true]:text-navy-950 transition-colors"
    >
      <Icon className="h-4 w-4 text-navy-500" strokeWidth={1.75} />
      {item.label}
    </Command.Item>
  );
}
