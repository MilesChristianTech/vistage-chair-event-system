import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Send,
  TrendingUp,
  CheckCircle2,
  UsersRound,
  HelpCircle,
  MailQuestion,
  Gauge,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { AppPageBody } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import { getEventMetrics, buildNextActions } from '@/lib/metrics';
import EngagementNote from '@/components/engagement-note';

export const dynamic = 'force-dynamic';

const FILTERS: Record<string, { label: string; apply: (q: any) => any }> = {
  priority_no_response: {
    label: 'Priority invitees, no response',
    apply: (q) => q.eq('audience_segment', 'priority').eq('rsvp_status', 'no_response').eq('invite_status', 'sent'),
  },
  maybe: { label: '"Maybe" responses', apply: (q) => q.eq('rsvp_status', 'maybe') },
  yes: { label: 'Confirmed yes', apply: (q) => q.eq('rsvp_status', 'yes') },
  no_response: { label: 'No response yet', apply: (q) => q.eq('rsvp_status', 'no_response').eq('invite_status', 'sent') },
};

export default async function EventDashboardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { filter?: string };
}) {
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id, public_title, capacity').eq('id', params.id).single();
  if (!event) notFound();

  const metrics = await getEventMetrics(supabase, event.id, event.capacity);
  const nextActions = buildNextActions(event.id, metrics);

  const activeFilter = searchParams.filter && FILTERS[searchParams.filter] ? searchParams.filter : null;
  let filteredRows: { id: string; rsvp_status: string; audience_segment: string; people: { first_name: string; last_name: string; email: string | null } | { first_name: string; last_name: string; email: string | null }[] | null }[] = [];

  if (activeFilter) {
    let q = supabase
      .from('invitations')
      .select('id, rsvp_status, audience_segment, people(first_name, last_name, email)')
      .eq('event_id', event.id);
    q = FILTERS[activeFilter]!.apply(q);
    const { data } = await q;
    filteredRows = data ?? [];
  }

  return (
    <AppPageBody>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Invited" value={metrics.invited} icon={Send} index={0} />
        <MetricCard label="Response rate" value={formatPct(metrics.responseRate)} icon={TrendingUp} index={1} />
        <MetricCard label="Yes" value={metrics.yes} icon={CheckCircle2} accent="success" index={2} />
        <MetricCard label="Expected headcount" value={metrics.expectedHeadcount} icon={UsersRound} index={3} />
        <MetricCard label="Maybe" value={metrics.maybe} icon={HelpCircle} accent="warn" index={4} />
        <MetricCard label="No response" value={metrics.noResponse} icon={MailQuestion} index={5} />
        <MetricCard
          label="Capacity"
          value={metrics.capacity != null ? `${metrics.expectedHeadcount}/${metrics.capacity}` : '—'}
          icon={Gauge}
          accent={metrics.isOverCapacity ? 'danger' : undefined}
          index={6}
        />
        <MetricCard
          label="Exceptions"
          value={metrics.exceptions}
          icon={AlertTriangle}
          accent={metrics.exceptions > 0 ? 'danger' : undefined}
          index={7}
        />
      </div>

      <EngagementNote />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <h3 className="mb-2">Next actions</h3>
          {nextActions.length === 0 ? (
            <div className="card p-4 text-sm text-navy-500">Nothing urgent — you're caught up.</div>
          ) : (
            <div className="card divide-y divide-navy-100 overflow-hidden">
              {nextActions.map((action, i) => (
                <Link
                  key={action.id}
                  href={action.href}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="animate-fade-up block px-4 py-3 text-sm hover:bg-navy-50 transition-colors duration-200"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Link href={`/events/${event.id}/responses`} className="text-sm underline">
              View responses & exceptions →
            </Link>
          </div>
        </div>

        <div className="lg:col-span-2">
          {activeFilter ? (
            <>
              <h3 className="mb-2">{FILTERS[activeFilter]!.label} ({filteredRows.length})</h3>
              {filteredRows.length === 0 ? (
                <div className="card p-6 text-sm text-navy-400">No one matches this filter right now.</div>
              ) : (
                <div className="card divide-y divide-navy-100">
                  {filteredRows.map((row) => {
                    const person = Array.isArray(row.people) ? row.people[0] : row.people;
                    return (
                      <div key={row.id} className="px-4 py-2.5 text-sm flex items-center justify-between">
                        <span className="text-navy-900">
                          {person?.first_name} {person?.last_name}
                        </span>
                        <span className="text-navy-500">{person?.email}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="card p-6 text-sm text-navy-400">Pick a next action on the left to see the people behind it.</div>
          )}
        </div>
      </div>
    </AppPageBody>
  );
}

function formatPct(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  index = 0,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'success' | 'warn' | 'danger';
  index?: number;
}) {
  const valueColor = accent ? { success: 'text-success', warn: 'text-warn', danger: 'text-danger' }[accent] : 'text-navy-950';
  const iconBg = accent
    ? { success: 'from-emerald-400 to-success', warn: 'from-amber-300 to-warn', danger: 'from-rose-400 to-danger' }[accent]
    : 'from-navy-600 to-navy-800';

  return (
    <div
      style={{ animationDelay: `${index * 50}ms` }}
      className="card-interactive animate-fade-up p-4"
    >
      <div className={`mb-2.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br ${iconBg} text-white`}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <p className={`text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      <p className="text-xs text-navy-500 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}
