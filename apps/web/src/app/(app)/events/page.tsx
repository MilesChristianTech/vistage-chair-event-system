import Link from 'next/link';
import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  inviting: 'Inviting',
  closed: 'Closed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral',
  inviting: 'badge-success',
  closed: 'badge-warn',
  completed: 'badge-neutral',
  cancelled: 'badge-danger',
};

export default async function EventsPage() {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from('events')
    .select('id, public_title, internal_name, status, starts_at')
    .eq('tenant_id', appUser.tenant_id)
    .order('starts_at', { ascending: false, nullsFirst: true });

  return (
    <>
      <AppPageHeader
        title="Events"
        description="Every gathering you've organized, past and upcoming."
        actions={
          <Link href="/events/new" className="btn-primary">
            + New event
          </Link>
        }
      />
      <AppPageBody>
        {!events || events.length === 0 ? (
          <div className="card p-10 text-center">
            <h2 className="text-navy-900">No events yet</h2>
            <p className="text-navy-500 text-sm mt-2 mb-5">Create your first event to start inviting people.</p>
            <Link href="/events/new" className="btn-primary">
              Create an event
            </Link>
          </div>
        ) : (
          <div className="card divide-y divide-navy-100">
            {events.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-navy-50 block">
                <div>
                  <p className="font-medium text-navy-900">{event.public_title}</p>
                  <p className="text-xs text-navy-500 mt-0.5">
                    {event.starts_at
                      ? new Date(event.starts_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
                      : 'Date not yet set'}
                  </p>
                </div>
                <span className={STATUS_BADGE[event.status] ?? 'badge-neutral'}>{STATUS_LABELS[event.status] ?? event.status}</span>
              </Link>
            ))}
          </div>
        )}
      </AppPageBody>
    </>
  );
}
