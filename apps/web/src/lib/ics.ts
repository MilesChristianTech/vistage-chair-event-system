import { DateTime } from 'luxon';

/** Builds a minimal, standards-compliant .ics calendar file for one event.
 * Opens directly in Outlook, Apple Calendar, and Google Calendar's import
 * flow - no per-provider link variants needed. */
export function buildIcs(params: {
  uid: string;
  title: string;
  startsAtIso: string;
  endsAtIso: string | null;
  timeZone: string;
  location: string | null;
  description: string;
}): string {
  const start = DateTime.fromISO(params.startsAtIso, { zone: 'utc' });
  const end = params.endsAtIso
    ? DateTime.fromISO(params.endsAtIso, { zone: 'utc' })
    : start.plus({ hours: 2 });

  const escape = (text: string) =>
    text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const fold = (line: string) => {
    // RFC 5545: lines over 75 octets must be folded with a leading space.
    const chunks: string[] = [];
    let rest = line;
    while (rest.length > 74) {
      chunks.push(rest.slice(0, 74));
      rest = ' ' + rest.slice(74);
    }
    chunks.push(rest);
    return chunks.join('\r\n');
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chair Event System//RSVP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${DateTime.utc().toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `DTSTART:${start.toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `DTEND:${end.toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `SUMMARY:${escape(params.title)}`,
    ...(params.location ? [`LOCATION:${escape(params.location)}`] : []),
    `DESCRIPTION:${escape(params.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(fold).join('\r\n') + '\r\n';
}
