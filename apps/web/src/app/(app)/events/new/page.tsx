import { AppPageHeader, AppPageBody } from '@/components/page-header';
import { requireCurrentUser } from '@/lib/tenant';
import { createClient } from '@/lib/supabase/server';
import EventForm from '../event-form';
import { createEventAction } from '../actions';

export default async function NewEventPage() {
  const { appUser } = await requireCurrentUser();
  const supabase = await createClient();
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('id, label')
    .eq('tenant_id', appUser.tenant_id)
    .order('sort_order');

  return (
    <>
      <AppPageHeader title="New event" description="Start with the basics - you can fill in the rest later." />
      <AppPageBody>
        <EventForm action={createEventAction} eventTypes={eventTypes ?? []} submitLabel="Create event" />
      </AppPageBody>
    </>
  );
}
