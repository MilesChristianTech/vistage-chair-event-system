import { DateTime } from 'luxon';

/**
 * Every event date is stored as a UTC instant plus the IANA zone the Host
 * picked for it. Formatting it with the platform's `Intl`/`Date` defaults
 * (browser-local or, on the server, whatever zone the process happens to
 * run in — UTC on Vercel) silently shows the wrong wall-clock time to
 * whoever's looking, including real invitees on the RSVP page. Always
 * format through the event's own zone instead.
 */

export function formatEventDate(iso: string | null, zone: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone || 'America/New_York');
  return dt.isValid ? dt.toFormat('LLLL d, yyyy') : null;
}

export function formatEventDateTime(iso: string | null, zone: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone || 'America/New_York');
  return dt.isValid ? dt.toFormat("cccc, LLLL d, yyyy 'at' h:mm a ZZZZ") : null;
}

export function formatDeadline(iso: string | null, zone: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone || 'America/New_York');
  return dt.isValid ? dt.toFormat('LLLL d') : null;
}
