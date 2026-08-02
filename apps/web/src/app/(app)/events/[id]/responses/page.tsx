import { notFound } from 'next/navigation';
import { AppPageBody } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import ExceptionRow from './exception-row';
import ManualEntryPanel from './manual-entry-panel';

export const dynamic = 'force-dynamic';

export default async function ResponsesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id, public_title').eq('id', params.id).single();
  if (!event) notFound();

  const { data: form } = await supabase.from('forms').select('id').eq('event_id', params.id).single();

  const { data: allResponses } = form
    ? await supabase
        .from('form_responses')
        .select('id, submitted_name, submitted_email, match_status, submitted_at, raw_answers')
        .eq('form_id', form.id)
        .order('submitted_at', { ascending: false })
    : { data: [] };

  const exceptions = (allResponses ?? []).filter((r) => r.match_status === 'needs_review');

  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, people(first_name, last_name, email)')
    .eq('event_id', params.id);

  const invitationOptions = (invitations ?? []).map((inv) => {
    const person = Array.isArray(inv.people) ? inv.people[0] : inv.people;
    return { id: inv.id, label: person ? `${person.first_name} ${person.last_name} (${person.email ?? 'no email'})` : inv.id };
  });

  const activeTab = searchParams.tab === 'exceptions' ? 'exceptions' : searchParams.tab === 'manual' ? 'manual' : 'all';

  return (
    <AppPageBody>
      <div className="flex gap-1 mb-5">
        <TabLink eventId={params.id} tab="all" active={activeTab === 'all'} label={`All responses (${allResponses?.length ?? 0})`} />
        <TabLink eventId={params.id} tab="exceptions" active={activeTab === 'exceptions'} label={`Needs matching (${exceptions.length})`} />
        <TabLink eventId={params.id} tab="manual" active={activeTab === 'manual'} label="Record a response manually" />
      </div>

      {activeTab === 'manual' ? (
        <ManualEntryPanel eventId={params.id} invitationOptions={invitationOptions} />
      ) : activeTab === 'exceptions' ? (
        exceptions.length === 0 ? (
          <div className="card p-6 text-sm text-navy-400">Nothing needs matching right now.</div>
        ) : (
          <div className="space-y-3">
            {exceptions.map((r) => (
              <ExceptionRow key={r.id} response={r} invitationOptions={invitationOptions} />
            ))}
          </div>
        )
      ) : (allResponses ?? []).length === 0 ? (
        <div className="card p-6 text-sm text-navy-400">No responses yet.</div>
      ) : (
        <div className="card divide-y divide-navy-100">
          {(allResponses ?? []).map((r) => (
            <div key={r.id} className="px-4 py-3 text-sm flex items-center justify-between">
              <span>
                <span className="font-medium text-navy-900">{r.submitted_name || 'Unknown'}</span>
                <span className="text-navy-500 ml-2">{r.submitted_email}</span>
              </span>
              <span className="text-navy-400 text-xs">{new Date(r.submitted_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </AppPageBody>
  );
}

function TabLink({ eventId, tab, active, label }: { eventId: string; tab: string; active: boolean; label: string }) {
  return (
    <a
      href={`/events/${eventId}/responses?tab=${tab}`}
      className={`px-3 py-1.5 rounded text-sm ${active ? 'bg-navy-900 text-white' : 'bg-navy-50 text-navy-700 hover:bg-navy-100'}`}
    >
      {label}
    </a>
  );
}
