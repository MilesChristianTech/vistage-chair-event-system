import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chair Event System',
  description: 'Executive-event invitation, RSVP, and relationship management.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
