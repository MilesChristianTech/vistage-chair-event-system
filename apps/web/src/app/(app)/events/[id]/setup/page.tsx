import { notFound } from 'next/navigation';
import { AppPageBody } from '@/components/page-header';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import EventForm from '../../event-form';
import { updateEventAction } from '../../actions';
import EventStatusControls from './status-controls';

export default async function EventSetupPage({ params }: { params: { id: string } }) {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();

  const [{ data: event }, { data: eventTypes }] = await Promise.all([
    supabase.from('events').select('*').eq('id', params.id).single(),
    supabase.from('event_types').select('id, label').eq('tenant_id', appUser.tenant_id).order('sort_order'),
  ]);

  if (!event) notFound();

  const missing: string[] = [];
  if (!event.starts_at) missing.push('Date & time');
  if (!event.is_virtual && !event.venue_name) missing.push('Venue');
  if (event.is_virtual && !event.virtual_link) missing.push('Virtual link');
  if (!event.rsvp_deadline) missing.push('RSVP deadline');
  if (!event.value_proposition) missing.push('Value proposition');

  return (
    <AppPageBody>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EventForm
            action={updateEventAction.bind(null, event.id)}
            eventTypes={eventTypes ?? []}
            initial={event}
            submitLabel="Save changes"
          />
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <h3>Ready to invite?</h3>
            {missing.length === 0 ? (
              <p className="text-sm text-success">Everything needed is filled in.</p>
            ) : (
              <>
                <p className="text-sm text-navy-500 mb-2">Still needed before inviting people out:</p>
                <ul className="text-sm text-warn space-y-1">
                  {missing.map((m) => (
                    <li key={m}>• {m}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <EventStatusControls event={event} />
        </div>
      </div>
    </AppPageBody>
  );
}
