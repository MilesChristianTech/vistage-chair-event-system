'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { segment: 'setup', label: 'Setup' },
  { segment: 'invitees', label: 'Invitees' },
  { segment: 'compose', label: 'Compose' },
  { segment: 'form', label: 'Form' },
  { segment: 'send', label: 'Send' },
  { segment: 'dashboard', label: 'Dashboard' },
];

export default function EventTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 -mb-px">
      {TABS.map((tab) => {
        const href = `/events/${eventId}/${tab.segment}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.segment}
            href={href}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${
              isActive ? 'border-navy-900 text-navy-900' : 'border-transparent text-navy-500 hover:text-navy-800'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
