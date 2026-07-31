'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Part 10.4: "Consistent, predictable navigation. The same things live in
// the same places." Five destinations, matching the four movements of the
// product (1.1) plus Settings.
const ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/events', label: 'Events' },
  { href: '/settings', label: 'Settings' },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={isActive ? 'nav-link-active' : 'nav-link'}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
