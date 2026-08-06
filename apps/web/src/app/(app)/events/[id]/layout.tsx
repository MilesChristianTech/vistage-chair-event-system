import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
        <Link href="/events" className="inline-flex items-center gap-1.5 text-navy-400 hover:text-navy-700 text-sm mb-2.5 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Events
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="mb-3">{event.public_title}</h1>
        </div>
        <EventTabs eventId={event.id} />
      </div>
      {children}
    </div>
  );
}
