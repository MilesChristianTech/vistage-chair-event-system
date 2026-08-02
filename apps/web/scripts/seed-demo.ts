/**
 * Creates (or resets) the operator's demo tenant (Part 2.5): a normal
 * tenant, fully isolated by the same row-level rules as any real Host, pre-
 * populated with obviously fictional sample data so the operator can show
 * the whole product without touching a real Host's data. Sending from this
 * tenant is always simulated (see send_jobs.is_simulated and the send
 * worker) - a real email can never leave the demo account.
 *
 * Usage: npm run seed:demo   (first time - also creates the demo login)
 *        npm run reset:demo  (same script - wipes and reseeds sample data,
 *                             safe to re-run any time before a demo)
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const DEMO_EMAIL = process.env.DEMO_ACCOUNT_EMAIL || 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || 'ChangeMe123!Demo';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let { data: tenant } = await supabase.from('tenants').select('id').eq('is_demo', true).maybeSingle();

  if (!tenant) {
    console.log('No demo tenant found - creating one.');
    const { data: newTenant, error } = await supabase
      .from('tenants')
      .insert({ name: 'Demo Organization', is_demo: true })
      .select('id')
      .single();
    if (error || !newTenant) throw new Error(`Could not create demo tenant: ${error?.message}`);
    tenant = newTenant;

    const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
    const existing = existingAuthUsers.users.find((u) => u.email === DEMO_EMAIL);

    const authUser =
      existing ??
      (
        await supabase.auth.admin.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true })
      ).data.user;

    if (!authUser) throw new Error('Could not create demo auth user.');

    await supabase.from('app_users').upsert(
      { id: authUser.id, tenant_id: tenant.id, display_name: 'Demo Host', role: 'operator' },
      { onConflict: 'id' }
    );

    console.log(`Demo login created: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (change via DEMO_ACCOUNT_PASSWORD env var)`);
  }

  const tenantId = tenant.id;
  console.log(`Reseeding demo tenant ${tenantId}...`);

  // Wipe existing demo data (cascades handle children).
  await supabase.from('events').delete().eq('tenant_id', tenantId);
  await supabase.from('people').delete().eq('tenant_id', tenantId);

  const { data: relTypes } = await supabase.from('relationship_types').select('id, label').eq('tenant_id', tenantId);
  const memberType = relTypes?.find((t) => t.label === 'Member')?.id;
  const prospectType = relTypes?.find((t) => t.label === 'Prospect')?.id;

  const { data: eventTypes } = await supabase.from('event_types').select('id, label').eq('tenant_id', tenantId);
  const roundtableType = eventTypes?.find((t) => t.label === 'Executive Roundtable')?.id;

  const samplePeople = [
    { first_name: 'Jordan', last_name: 'Reyes', email: 'jordan.reyes@example.com', company: 'Meridian Manufacturing', title: 'CEO', relationship_type_id: memberType },
    { first_name: 'Priya', last_name: 'Natarajan', email: 'priya.natarajan@example.com', company: 'Northwind Health Group', title: 'President', relationship_type_id: memberType },
    { first_name: 'Marcus', last_name: 'Bell', email: 'marcus.bell@example.com', company: 'Bell Logistics', title: 'Founder & CEO', relationship_type_id: memberType },
    { first_name: 'Elena', last_name: 'Vasquez', email: 'elena.vasquez@example.com', company: 'Vasquez Capital Partners', title: 'Managing Partner', relationship_type_id: prospectType },
    { first_name: 'David', last_name: 'Okafor', email: 'david.okafor@example.com', company: 'Okafor Industrial', title: 'President', relationship_type_id: memberType },
    { first_name: 'Susan', last_name: 'Whitfield', email: 'susan.whitfield@example.com', company: 'Whitfield & Co.', title: 'CEO', relationship_type_id: prospectType },
    { first_name: 'Tom', last_name: 'Larsen', email: 'tom.larsen@example.com', company: 'Larsen Precision Tooling', title: 'Owner', relationship_type_id: memberType },
    { first_name: 'Angela', last_name: 'Kim', email: 'angela.kim@example.com', company: 'Kim Biotech Ventures', title: 'CEO', relationship_type_id: memberType },
    { first_name: 'Robert', last_name: 'Chen', email: 'robert.chen@example.com', company: 'Chen Family Office', title: 'Principal', relationship_type_id: prospectType },
    { first_name: 'Nicole', last_name: 'Franklin', email: 'nicole.franklin@example.com', company: 'Franklin Retail Group', title: 'President', relationship_type_id: memberType },
  ];

  const { data: insertedPeople, error: peopleError } = await supabase
    .from('people')
    .insert(samplePeople.map((p) => ({ ...p, tenant_id: tenantId })))
    .select('id, first_name, last_name');
  if (peopleError || !insertedPeople) throw new Error(`Could not seed people: ${peopleError?.message}`);

  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 21);
  startsAt.setHours(8, 0, 0, 0);
  const rsvpDeadline = new Date(startsAt);
  rsvpDeadline.setDate(rsvpDeadline.getDate() - 5);

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      tenant_id: tenantId,
      internal_name: 'Q3 Roundtable (demo)',
      public_title: 'Executive Roundtable: Navigating Rising Input Costs',
      event_type_id: roundtableType,
      purpose: 'A candid peer discussion on managing margin pressure without sacrificing growth.',
      audience_description: 'CEOs and Presidents of $10M-$150M companies',
      value_proposition: 'Walk away with two or three specific tactics your peers are using right now, not theory.',
      speaker_details: 'Facilitated discussion - no outside speaker, peer-led.',
      starts_at: startsAt.toISOString(),
      time_zone: 'America/New_York',
      is_virtual: false,
      venue_name: 'The Wharton Club (sample venue)',
      venue_address: '123 Market Street, Suite 400',
      parking_notes: 'Valet available at the front entrance.',
      capacity: 20,
      rsvp_deadline: rsvpDeadline.toISOString(),
      status: 'inviting',
    })
    .select('id')
    .single();
  if (eventError || !event) throw new Error(`Could not seed event: ${eventError?.message}`);

  const { data: message } = await supabase
    .from('messages')
    .insert({
      tenant_id: tenantId,
      event_id: event.id,
      message_type: 'invitation',
      subject: 'A candid peer conversation on input costs',
      body:
        "{{greeting_name}} -\n\nI'm putting together a small roundtable for a handful of CEOs I respect to compare notes on managing rising input costs without giving up margin. No outside speaker, no pitch - just a candid peer conversation.\n\nDetails:\nDate: [event date]\nLocation: The Wharton Club\nRSVP by: [deadline]\n\nIf this sounds useful, I'd love to have you there: {{form_link}}\n\n{{host_signature}}",
      is_approved: true,
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  const { data: form } = await supabase
    .from('forms')
    .insert({
      tenant_id: tenantId,
      event_id: event.id,
      intro_text: "We'd love to know if you can join us - it takes less than a minute.",
      confirmation_text: 'Thank you - we look forward to seeing you there.',
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (form) {
    await supabase.from('form_questions').insert([
      { tenant_id: tenantId, form_id: form.id, question_type: 'attendance', label: 'Will you be able to attend?', is_required: true, sort_order: 0 },
      { tenant_id: tenantId, form_id: form.id, question_type: 'guest_count', label: 'How many guests will you bring?', sort_order: 1 },
      { tenant_id: tenantId, form_id: form.id, question_type: 'dietary_accessibility', label: 'Any dietary or accessibility needs?', sort_order: 2 },
      { tenant_id: tenantId, form_id: form.id, question_type: 'open_text', label: 'What would make this especially valuable to you?', sort_order: 3 },
    ]);
  }

  const rsvpPattern: Array<{ rsvp_status: string; invite_status: string; segment: string }> = [
    { rsvp_status: 'yes', invite_status: 'sent', segment: 'priority' },
    { rsvp_status: 'yes', invite_status: 'sent', segment: 'member' },
    { rsvp_status: 'maybe', invite_status: 'sent', segment: 'member' },
    { rsvp_status: 'no_response', invite_status: 'sent', segment: 'priority' },
    { rsvp_status: 'no', invite_status: 'sent', segment: 'prospect' },
    { rsvp_status: 'yes', invite_status: 'sent', segment: 'member' },
    { rsvp_status: 'no_response', invite_status: 'sent', segment: 'member' },
    { rsvp_status: 'yes', invite_status: 'sent', segment: 'prospect' },
    { rsvp_status: 'no_response', invite_status: 'sent', segment: 'prospect' },
    { rsvp_status: 'no_response', invite_status: 'planned', segment: 'guest' },
  ];

  await supabase.from('invitations').insert(
    insertedPeople.map((person, idx) => ({
      tenant_id: tenantId,
      event_id: event.id,
      person_id: person.id,
      audience_segment: rsvpPattern[idx]?.segment ?? 'guest',
      invite_status: rsvpPattern[idx]?.invite_status ?? 'planned',
      rsvp_status: rsvpPattern[idx]?.rsvp_status ?? 'no_response',
      rsvp_responded_at: rsvpPattern[idx]?.rsvp_status !== 'no_response' ? new Date().toISOString() : null,
      guest_count: rsvpPattern[idx]?.rsvp_status === 'yes' && idx % 2 === 0 ? 1 : 0,
    }))
  );

  console.log('Demo tenant seeded successfully.');
  console.log(`  Tenant ID: ${tenantId}`);
  console.log(`  Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
