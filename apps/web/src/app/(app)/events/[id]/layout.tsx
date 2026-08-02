import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EventTabs from './event-tabs';

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id, public_title, status').eq('id', params.id).single();
  if (!event) notFound();

  return (
    <div>
      <div className="bg-white border-b border-navy-100 px-8 pt-5">
        <p className="text-xs text-navy-400 mb-1">
          <a href="/events" className="text-navy-400">
            Events
          </a>{' '}
          / {event.public_title}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="mb-3">{event.public_title}</h1>
        </div>
        <EventTabs eventId={event.id} />
      </div>
      {children}
    </div>
  );
}
