import Link from 'next/link';
import type { Database } from '@/lib/database.types';

type MailboxConnection = Database['public']['Tables']['mailbox_connections']['Row'] | null | undefined;

/**
 * Part 11.5: "The app must never fail cryptically because a connection is
 * absent." Surfaced once, plainly, on the home dashboard, with a fix (or,
 * for an owner-level gap like a missing AI key, a note that it's on the
 * operator rather than the Host).
 */
export default function ConnectionBanner({
  mailbox,
  anthropicConfigured,
}: {
  mailbox: MailboxConnection;
  anthropicConfigured: boolean;
}) {
  const notices: React.ReactNode[] = [];

  if (!mailbox || mailbox.status === 'disconnected') {
    notices.push(
      <Banner key="mailbox" tone="warn">
        Your email isn't connected yet, so invitations can't be sent. {' '}
        <Link href="/settings" className="underline font-medium">
          Connect your Microsoft account in Settings
        </Link>{' '}
        — everything else in the app works fine in the meantime.
      </Banner>
    );
  } else if (mailbox.status === 'needs_reconnect') {
    notices.push(
      <Banner key="mailbox-reconnect" tone="warn">
        Your email connection needs to be refreshed before your next send. {' '}
        <Link href="/settings" className="underline font-medium">
          Reconnect in Settings
        </Link>
        .
      </Banner>
    );
  } else if (mailbox.status === 'throttled') {
    notices.push(
      <Banner key="mailbox-throttled" tone="danger">
        Microsoft has temporarily throttled your mailbox. Sending is paused automatically and will resume — no
        action needed unless this persists for more than a few hours.
      </Banner>
    );
  }

  if (!anthropicConfigured) {
    notices.push(
      <Banner key="anthropic" tone="neutral">
        The writing assistant isn't connected yet — this is a one-time setup step for the operator, not something
        you need to fix. You can still write and send invitations by hand in the meantime.
      </Banner>
    );
  }

  if (notices.length === 0) return null;

  return <div className="space-y-3 mb-6">{notices}</div>;
}

function Banner({ tone, children }: { tone: 'warn' | 'danger' | 'neutral'; children: React.ReactNode }) {
  const toneClasses = {
    warn: 'bg-warn-bg text-warn border-warn/20',
    danger: 'bg-danger-bg text-danger border-danger/20',
    neutral: 'bg-navy-50 text-navy-700 border-navy-200',
  }[tone];

  return <div className={`rounded border px-4 py-3 text-sm ${toneClasses}`}>{children}</div>;
}
