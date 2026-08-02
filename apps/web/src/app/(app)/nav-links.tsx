'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, CalendarDays, Settings } from 'lucide-react';

// Part 10.4: "Consistent, predictable navigation. The same things live in
// the same places." Five destinations, matching the four movements of the
// product (1.1) plus Settings. Icons are a visual accent alongside the
// label (10.3) - never a substitute for the word, per the accessibility
// requirement.
const ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={isActive ? 'nav-link-active' : 'nav-link'}>
            {isActive ? (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-gradient-to-b from-gold-300 to-gold-500 shadow-glow" />
            ) : null}
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
