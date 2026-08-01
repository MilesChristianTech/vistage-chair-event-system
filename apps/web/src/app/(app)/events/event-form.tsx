'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { DateTime } from 'luxon';
import type { ActionResult } from './actions';
import { useSuccessToast } from '@/lib/use-success-toast';

type EventType = { id: string; label: string };

export interface EventFormValues {
  internal_name?: string | null;
  public_title?: string | null;
  event_type_id?: string | null;
  purpose?: string | null;
  audience_description?: string | null;
  value_proposition?: string | null;
  speaker_details?: string | null;
  starts_at?: string | null;
  time_zone?: string | null;
  is_virtual?: boolean | null;
  venue_name?: string | null;
  venue_address?: string | null;
  parking_notes?: string | null;
  virtual_link?: string | null;
  capacity?: number | null;
  rsvp_deadline?: string | null;
}

// A `datetime-local` input needs a plain wall-clock string with no
// timezone. The value is stored as a UTC instant, so it must be rendered
// back in the *event's own* time_zone — not the browser's — or editing an
// event from a different timezone than the one it was created in would
// silently show (and then resave) the wrong wall-clock time.
function toLocalInputValue(iso?: string | null, zone?: string | null): string {
  if (!iso) return '';
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone || 'America/New_York');
  return dt.isValid ? dt.toFormat("yyyy-LL-dd'T'HH:mm") : '';
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export default function EventForm({
  action,
  eventTypes,
  initial,
  submitLabel,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  eventTypes: EventType[];
  initial?: EventFormValues;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, { ok: true });
  useSuccessToast(state, 'Saved.');

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <section className="space-y-4">
        <h3>The basics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="internal_name">
              Internal name *
            </label>
            <input id="internal_name" name="internal_name" required defaultValue={initial?.internal_name ?? ''} className="input" />
            <p className="field-hint">For your own reference — never shown to invitees.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="public_title">
              Public title *
            </label>
            <input id="public_title" name="public_title" required defaultValue={initial?.public_title ?? ''} className="input" />
            <p className="field-hint">What invitees will see.</p>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="event_type_id">
            Event type
          </label>
          <select id="event_type_id" name="event_type_id" defaultValue={initial?.event_type_id ?? ''} className="input max-w-xs">
            <option value="">Not set</option>
            {eventTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-4">
        <h3>What it’s about</h3>
        <div>
          <label className="field-label" htmlFor="purpose">
            Purpose
          </label>
          <textarea id="purpose" name="purpose" rows={2} defaultValue={initial?.purpose ?? ''} className="input" />
        </div>
        <div>
          <label className="field-label" htmlFor="audience_description">
            Intended audience
          </label>
          <textarea id="audience_description" name="audience_description" rows={2} defaultValue={initial?.audience_description ?? ''} className="input" />
        </div>
        <div>
          <label className="field-label" htmlFor="value_proposition">
            Value proposition
          </label>
          <textarea id="value_proposition" name="value_proposition" rows={2} defaultValue={initial?.value_proposition ?? ''} className="input" />
          <p className="field-hint">Why should a busy executive spend their time on this? The Coach will lean on this heavily.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="speaker_details">
            Speaker / facilitator details
          </label>
          <textarea id="speaker_details" name="speaker_details" rows={2} defaultValue={initial?.speaker_details ?? ''} className="input" />
        </div>
      </section>

      <section className="space-y-4">
        <h3>Date, time, and place</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="starts_at">
              Date &amp; time
            </label>
            <input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              defaultValue={toLocalInputValue(initial?.starts_at, initial?.time_zone)}
              className="input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="time_zone">
              Time zone
            </label>
            <select id="time_zone" name="time_zone" defaultValue={initial?.time_zone ?? 'America/New_York'} className="input">
              <option value="America/New_York">Eastern</option>
              <option value="America/Chicago">Central</option>
              <option value="America/Denver">Mountain</option>
              <option value="America/Los_Angeles">Pacific</option>
              <option value="America/Anchorage">Alaska</option>
              <option value="Pacific/Honolulu">Hawaii</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-navy-800">
          <input type="checkbox" name="is_virtual" defaultChecked={Boolean(initial?.is_virtual)} className="accent-navy-800" />
          This is a virtual event
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="venue_name">
              Venue name
            </label>
            <input id="venue_name" name="venue_name" defaultValue={initial?.venue_name ?? ''} className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="venue_address">
              Address
            </label>
            <input id="venue_address" name="venue_address" defaultValue={initial?.venue_address ?? ''} className="input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="parking_notes">
              Parking notes
            </label>
            <input id="parking_notes" name="parking_notes" defaultValue={initial?.parking_notes ?? ''} className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="virtual_link">
              Virtual link
            </label>
            <input id="virtual_link" name="virtual_link" defaultValue={initial?.virtual_link ?? ''} className="input" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3>Capacity and deadline</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="capacity">
              Capacity
            </label>
            <input id="capacity" name="capacity" type="number" min={0} defaultValue={initial?.capacity ?? ''} className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="rsvp_deadline">
              RSVP deadline
            </label>
            <input
              id="rsvp_deadline"
              name="rsvp_deadline"
              type="datetime-local"
              defaultValue={toLocalInputValue(initial?.rsvp_deadline, initial?.time_zone)}
              className="input"
            />
          </div>
        </div>
      </section>

      {!state.ok && state.error ? <p className="text-sm text-danger bg-danger-bg rounded px-3 py-2">{state.error}</p> : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
