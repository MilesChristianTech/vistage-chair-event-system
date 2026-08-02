import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import Avatar from '@/components/avatar';
import ProfileEditor from './profile-editor';
import NotesPanel from './notes-panel';
import PersonActions from './person-actions';

export const dynamic = 'force-dynamic';

export default async function PersonProfilePage({ params }: { params: { id: string } }) {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const { data: person } = await supabase.from('people').select('*').eq('id', params.id).single();
  if (!person) notFound();

  const [{ data: relationshipTypes }, { data: customFieldDefinitions }, { data: notes }, { data: invitations }] = await Promise.all([
    supabase.from('relationship_types').select('id, label').eq('tenant_id', appUser.tenant_id).order('sort_order'),
    supabase.from('custom_field_definitions').select('id, field_key, label').eq('tenant_id', appUser.tenant_id).order('sort_order'),
    supabase
      .from('notes')
      .select('id, body, created_at')
      .eq('person_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('invitations')
      .select(
        'id, rsvp_status, invite_status, attendance_status, rsvp_responded_at, created_at, personalization_note, events(id, public_title, starts_at)'
      )
      .eq('person_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  const relationshipTypeLabel =
    relationshipTypes?.find((t) => t.id === person.relationship_type_id)?.label ?? null;

  // Part 3.2: "assembled automatically from the person's history" — combine
  // event participation with notes into one chronological timeline.
  type TimelineEntry = { at: string; kind: 'invitation' | 'note'; content: React.ReactNode };
  const timeline: TimelineEntry[] = [];

  for (const inv of invitations ?? []) {
    const event = Array.isArray(inv.events) ? inv.events[0] : inv.events;
    if (!event) continue;
    timeline.push({
      at: inv.created_at,
      kind: 'invitation',
      content: (
        <>
          <Link href={`/events/${event.id}`} className="font-medium no-underline hover:underline">
            {event.public_title}
          </Link>
          <span className="text-navy-500">
            {' — '}
            <RsvpLabel status={inv.rsvp_status} /> · <AttendanceLabel status={inv.attendance_status} />
          </span>
          {inv.personalization_note ? (
            <p className="text-navy-400 text-xs mt-0.5">Personal touch: “{inv.personalization_note}”</p>
          ) : null}
        </>
      ),
    });
  }

  for (const note of notes ?? []) {
    timeline.push({ at: note.created_at, kind: 'note', content: <>Note added: {note.body}</> });
  }

  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <>
      <AppPageHeader
        icon={<Avatar firstName={person.first_name} lastName={person.last_name} />}
        title={`${person.first_name} ${person.last_name}`}
        description={person.company ? `${person.title ? `${person.title} at ` : ''}${person.company}` : undefined}
        actions={<PersonActions person={person} />}
      />
      <AppPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <ProfileEditor
              person={{ ...person, custom_fields: (person.custom_fields as Record<string, string>) ?? {} }}
              relationshipTypeLabel={relationshipTypeLabel}
              relationshipTypes={relationshipTypes ?? []}
              customFieldDefinitions={customFieldDefinitions ?? []}
            />
            <NotesPanel personId={person.id} notes={notes ?? []} />
          </div>

          <div className="lg:col-span-2">
            <div className="card p-5">
              <h3>Interaction timeline</h3>
              {timeline.length === 0 ? (
                <p className="text-sm text-navy-400">
                  No history yet — invite {person.first_name} to an event and it will show up here automatically.
                </p>
              ) : (
                <ol className="space-y-4">
                  {timeline.map((entry, idx) => (
                    <li key={idx} className="text-sm flex gap-4">
                      <span className="w-24 shrink-0 text-navy-400 text-xs pt-0.5">
                        {new Date(entry.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="text-navy-800">{entry.content}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </AppPageBody>
    </>
  );
}

function RsvpLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    no_response: 'no response yet',
    yes: 'said yes',
    no: 'declined',
    maybe: 'said maybe',
    waitlisted: 'waitlisted',
    cancelled: 'cancelled',
  };
  return <>{labels[status] ?? status}</>;
}

function AttendanceLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    unknown: 'attendance unknown',
    attended: 'attended',
    no_show: 'no-show',
    cancelled: 'cancelled',
  };
  return <>{labels[status] ?? status}</>;
}
