import { createServiceClient } from '@/lib/supabase/service';
import { formatEventDateTime, formatDeadline } from '@/lib/datetime';
import type { Json } from '@/lib/database.types';

/**
 * Everything the public, unauthenticated hosted RSVP form needs, resolved
 * server-side through the service-role client (Part 3.6, and the RLS note
 * in supabase/migrations/0004_rls_policies.sql). The only thing standing
 * between "unlisted" and "open" is the unguessable public_token — every
 * function here requires one and returns nothing if it doesn't match a
 * *published* form, so an unpublished or mistyped link reveals nothing.
 */

export interface FormBranding {
  logoUrl: string | null;
  headerImageUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
}

export interface PublicFormData {
  formId: string;
  tenantId: string;
  eventId: string;
  introText: string | null;
  confirmationText: string | null;
  theme: Record<string, unknown> | null;
  branding: FormBranding;
  questions: Array<{
    id: string;
    question_type: string;
    label: string;
    help_text: string | null;
    is_required: boolean;
    options: Json;
  }>;
  event: {
    publicTitle: string;
    startsAtFormatted: string | null;
    venueLine: string | null;
    rsvpDeadlineFormatted: string | null;
    capacity: number | null;
    status: string;
  };
  prefill: { firstName: string; lastName: string; email: string | null; invitationId: string } | null;
}

export async function getPublicFormData(formToken: string, invitationToken?: string | null): Promise<PublicFormData | null> {
  const supabase = createServiceClient();

  const { data: form } = await supabase.from('forms').select('*').eq('public_token', formToken).eq('is_published', true).maybeSingle();
  if (!form) return null;

  const { data: event } = await supabase.from('events').select('*').eq('id', form.event_id).maybeSingle();
  if (!event) return null;

  const { data: tenantSettings } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', form.tenant_id)
    .maybeSingle();

  // The event's own theme override wins field-by-field over the tenant's
  // default branding — set a logo tenant-wide once, or override it (or the
  // colors) for just this one event.
  const tenantBranding = (tenantSettings?.branding as Record<string, unknown>) ?? {};
  const eventTheme = (form.theme as Record<string, unknown>) ?? {};
  const branding: FormBranding = {
    logoUrl: (eventTheme.logoUrl as string) ?? (tenantBranding.logoUrl as string) ?? null,
    headerImageUrl: (eventTheme.headerImageUrl as string) ?? (tenantBranding.headerImageUrl as string) ?? null,
    primaryColor: (eventTheme.primaryColor as string) ?? (tenantBranding.primaryColor as string) ?? null,
    accentColor: (eventTheme.accentColor as string) ?? (tenantBranding.accentColor as string) ?? null,
  };

  const { data: questions } = await supabase
    .from('form_questions')
    .select('id, question_type, label, help_text, is_required, options')
    .eq('form_id', form.id)
    .order('sort_order');

  let prefill: PublicFormData['prefill'] = null;
  if (invitationToken) {
    const { data: invitation } = await supabase
      .from('invitations')
      .select('id, people(first_name, last_name, email)')
      .eq('public_token', invitationToken)
      .eq('event_id', event.id)
      .maybeSingle();

    if (invitation) {
      const person = Array.isArray(invitation.people) ? invitation.people[0] : invitation.people;
      if (person) {
        prefill = {
          firstName: person.first_name,
          lastName: person.last_name,
          email: person.email,
          invitationId: invitation.id,
        };
      }
    }
  }

  const venueLine = event.is_virtual
    ? event.virtual_link
      ? 'Virtual event — link provided after you RSVP yes'
      : 'Virtual event'
    : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || null;

  return {
    formId: form.id,
    tenantId: form.tenant_id,
    eventId: event.id,
    introText: form.intro_text,
    confirmationText: form.confirmation_text,
    theme: (form.theme as Record<string, unknown>) ?? null,
    branding,
    questions: questions ?? [],
    event: {
      publicTitle: event.public_title,
      startsAtFormatted: formatEventDateTime(event.starts_at, event.time_zone),
      venueLine,
      rsvpDeadlineFormatted: formatDeadline(event.rsvp_deadline, event.time_zone),
      capacity: event.capacity,
      status: event.status,
    },
    prefill,
  };
}
