'use client';

import { useRouter } from 'next/navigation';
import ConfirmAction from '@/components/confirm-action';
import { disconnectMailboxAction } from './actions';
import type { Database } from '@/lib/database.types';

type Mailbox = Database['public']['Tables']['mailbox_connections']['Row'] | null | undefined;

export default function MailboxCard({ mailbox }: { mailbox: Mailbox }) {
  const router = useRouter();

  if (!mailbox || mailbox.status === 'disconnected') {
    return (
      <a href="/api/auth/microsoft/connect" className="btn-primary inline-flex">
        Connect your Microsoft account
      </a>
    );
  }

  const statusView = {
    connected: { dot: 'bg-success', text: `Connected as ${mailbox.connected_email}` },
    needs_reconnect: { dot: 'bg-warn', text: 'Needs reconnecting' },
    throttled: { dot: 'bg-warn', text: 'Temporarily throttled by Microsoft - will recover automatically' },
  }[mailbox.status as 'connected' | 'needs_reconnect' | 'throttled'] ?? { dot: 'bg-navy-300', text: mailbox.status };

  return (
    <div>
      <p className="flex items-center gap-2 text-sm text-navy-800 mb-3">
        <span className={`status-dot ${statusView.dot}`} />
        {statusView.text}
      </p>
      <div className="flex gap-2">
        {mailbox.status !== 'connected' ? (
          <a href="/api/auth/microsoft/connect" className="btn-primary">
            Reconnect
          </a>
        ) : null}
        <ConfirmAction
          triggerLabel="Disconnect"
          triggerClassName="btn-secondary"
          consequence="This stops all future sends for your account until you reconnect. Anything already sent is unaffected."
          confirmLabel="Disconnect"
          successMessage="Your Microsoft account has been disconnected."
          onConfirm={async () => {
            const result = await disconnectMailboxAction();
            router.refresh();
            return result;
          }}
        />
      </div>
    </div>
  );
}
