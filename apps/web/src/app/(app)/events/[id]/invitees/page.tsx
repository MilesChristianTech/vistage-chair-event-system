import { notFound } from 'next/navigation';
import { AppPageBody } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import AddInviteesPanel from './add-invitees-panel';
import InviteeRow, { type InviteeRowData } from './invitee-row';

export const dynamic = 'force-dynamic';

export default async function InviteesPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: event } = await supabase.from('events').select('id, capacity').eq('id', params.id).single();
  if (!event) notFound();

  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, audience_segment, invite_status, rsvp_status, people(id, first_name, last_name, email)')
    .eq('event_id', params.id)
    .order('created_at', { ascending: false });

  const rows: InviteeRowData[] = (invitations ?? []).map((inv) => ({
    id: inv.id,
    audience_segment: inv.audience_segment,
    invite_status: inv.invite_status,
    rsvp_status: inv.rsvp_status,
    person: Array.isArray(inv.people) ? inv.people[0] ?? null : inv.people,
  }));

  return (
    <AppPageBody>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="mb-0">
              Invitees ({rows.length}
              {event.capacity ? ` / ${event.capacity} capacity` : ''})
            </h3>
          </div>
          {rows.length === 0 ? (
            <div className="card p-8 text-center text-navy-500 text-sm">
              No one added yet - search your contacts on the right to get started.
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-navy-50 text-navy-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium">Email</th>
                    <th className="text-left px-4 py-2.5 font-medium">Segment</th>
                    <th className="text-left px-4 py-2.5 font-medium">Invite</th>
                    <th className="text-left px-4 py-2.5 font-medium">RSVP</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {rows.map((row) => (
                    <InviteeRow key={row.id} eventId={params.id} invitee={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <AddInviteesPanel eventId={params.id} />
        </div>
      </div>
    </AppPageBody>
  );
}
