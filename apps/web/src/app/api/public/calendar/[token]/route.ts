import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { buildIcs } from '@/lib/ics';

/** Public "add to calendar" download, reachable via the same public form
 * token as the RSVP form itself — a published form's basic event facts
 * (title, time, location) are already effectively public via that page, so
 * this reuses the same token rather than introducing a new one. */
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data: form } = await supabase
    .from('forms')
    .select('id, event_id')
    .eq('public_token', params.token)
    .eq('is_published', true)
    .maybeSingle();

  if (!form) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('public_title, starts_at, ends_at, time_zone, is_virtual, venue_name, venue_address, virtual_link, purpose')
    .eq('id', form.event_id)
    .single();

  if (!event || !event.starts_at) {
    return NextResponse.json({ error: 'This event does not have a scheduled time yet.' }, { status: 404 });
  }

  const location = event.is_virtual ? event.virtual_link ?? 'Virtual' : [event.venue_name, event.venue_address].filter(Boolean).join(', ');

  const ics = buildIcs({
    uid: `${form.id}@chaireventsystem`,
    title: event.public_title,
    startsAtIso: event.starts_at,
    endsAtIso: event.ends_at,
    timeZone: event.time_zone,
    location: location || null,
    description: event.purpose ?? '',
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="event.ics"`,
    },
  });
}
