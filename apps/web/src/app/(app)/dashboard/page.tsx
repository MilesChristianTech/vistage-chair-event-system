import Link from 'next/link';
import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser, getMailboxConnection } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import { getEventMetrics, buildNextActions } from '@/lib/metrics';
import ConnectionBanner from '@/components/connection-banner';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const [{ data: events }, mailbox] = await Promise.all([
    supabase
      .from('events')
      .select('id, public_title, internal_name, status, starts_at, capacity, rsvp_deadline')
      .in('status', ['draft', 'inviting', 'closed'])
      .order('starts_at', { ascending: true }),
    getMailboxConnection(appUser.tenant_id),
  ]);

  const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const activeEvents = events ?? [];

  const eventsWithMetrics = await Promise.all(
    activeEvents.map(async (event) => ({
      event,
      metrics: await getEventMetrics(supabase, event.id, event.capacity),
    }))
  );

  const allNextActions = eventsWithMetrics.flatMap(({ event, metrics }) =>
    buildNextActions(event.id, metrics).map((action) => ({ ...action, eventTitle: event.public_title }))
  );

  return (
    <>
      <AppPageHeader
        title={`Welcome back${appUser.display_name ? `, ${appUser.display_name.split(' ')[0]}` : ''}`}
        description="Here's what needs your attention."
        actions={
          <Link href="/events/new" className="btn-primary">
            + New event
          </Link>
        }
      />
      <AppPageBody>
        <ConnectionBanner mailbox={mailbox} anthropicConfigured={anthropicConfigured} />

        {activeEvents.length === 0 ? (
          <div className="card p-10 text-center max-w-xl mx-auto mt-8">
            <h2 className="text-navy-900">No events yet</h2>
            <p className="text-navy-500 text-sm mt-2 mb-5">
              Create your first event to start inviting people. If you haven't imported your contacts yet, start
              there instead.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/contacts/import" className="btn-secondary">
                Import contacts
              </Link>
              <Link href="/events/new" className="btn-primary">
                Create an event
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-base font-semibold text-navy-800">Your events</h2>
              {eventsWithMetrics.map(({ event, metrics }) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="card p-5 flex items-center justify-between block hover:border-navy-300 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-navy-900">{event.public_title}</p>
                    <p className="text-xs text-navy-500 mt-0.5">
                      {event.starts_at
                        ? new Date(event.starts_at).toLocaleDateString(undefined, {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Date not yet set'}
                      {' · '}
                      <StatusLabel status={event.status} />
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm shrink-0">
                    <Metric label="Invited" value={metrics.invited} />
                    <Metric label="Yes" value={metrics.yes} />
                    <Metric label="Maybe" value={metrics.maybe} />
                    {metrics.capacity != null ? (
                      <Metric
                        label="Capacity"
                        value={`${metrics.expectedHeadcount}/${metrics.capacity}`}
                        warn={metrics.isOverCapacity}
                      />
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>

            <div>
              <h2 className="text-base font-semibold text-navy-800 mb-4">Next actions</h2>
              {allNextActions.length === 0 ? (
                <div className="card p-5 text-sm text-navy-500">Nothing urgent right now — you're caught up.</div>
              ) : (
                <div className="card divide-y divide-navy-100">
                  {allNextActions.slice(0, 8).map((action) => (
                    <Link key={`${action.id}-${action.eventTitle}`} href={action.href} className="block px-4 py-3 hover:bg-navy-50">
                      <p className="text-sm text-navy-900">{action.label}</p>
                      <p className="text-xs text-navy-500 mt-0.5">{action.eventTitle}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AppPageBody>
    </>
  );
}

function Metric({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className="text-right">
      <p className={`text-base font-semibold ${warn ? 'text-danger' : 'text-navy-900'}`}>{value}</p>
      <p className="text-[11px] text-navy-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function StatusLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: 'Draft',
    inviting: 'Inviting',
    closed: 'Closed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return <span>{labels[status] ?? status}</span>;
}
