// Fixture data for PREVIEW_MODE (local look-around only - never used when a
// real Supabase project is configured). See lib/preview/store.ts.
//
// Deliberately fictional, matching the same spirit as scripts/seed-demo.ts.

export const TENANT_ID = 'preview-tenant';
export const USER_ID = 'preview-user';
export const EVENT_ID = 'preview-event-roundtable';
export const EVENT_ID_DRAFT = 'preview-event-draft';
export const FORM_ID = 'preview-form-roundtable';
export const FORM_TOKEN = 'preview-form-token-abc123';

const now = () => new Date().toISOString();

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function buildSeedData(): Record<string, any[]> {
  counter = 0;

  const relationshipTypes = [
    { id: 'rt-member', tenant_id: TENANT_ID, label: 'Member', sort_order: 1, is_system: true, created_at: now() },
    { id: 'rt-prospect', tenant_id: TENANT_ID, label: 'Prospect', sort_order: 2, is_system: true, created_at: now() },
    { id: 'rt-alumnus', tenant_id: TENANT_ID, label: 'Alumnus', sort_order: 3, is_system: true, created_at: now() },
    { id: 'rt-referral', tenant_id: TENANT_ID, label: 'Referral Partner', sort_order: 4, is_system: true, created_at: now() },
    { id: 'rt-speaker', tenant_id: TENANT_ID, label: 'Speaker', sort_order: 5, is_system: true, created_at: now() },
    { id: 'rt-guest', tenant_id: TENANT_ID, label: 'Guest', sort_order: 6, is_system: true, created_at: now() },
    { id: 'rt-spouse', tenant_id: TENANT_ID, label: 'Spouse', sort_order: 7, is_system: true, created_at: now() },
    { id: 'rt-other', tenant_id: TENANT_ID, label: 'Other', sort_order: 8, is_system: true, created_at: now() },
  ];

  const eventTypes = [
    { id: 'et-roundtable', tenant_id: TENANT_ID, label: 'Executive Roundtable', sort_order: 1, is_system: true, created_at: now() },
    { id: 'et-dinner', tenant_id: TENANT_ID, label: 'Speaker Dinner', sort_order: 2, is_system: true, created_at: now() },
    { id: 'et-member-guest', tenant_id: TENANT_ID, label: 'Member/Guest Event', sort_order: 3, is_system: true, created_at: now() },
    { id: 'et-social', tenant_id: TENANT_ID, label: 'Social / Spouse Event', sort_order: 4, is_system: true, created_at: now() },
    { id: 'et-workshop', tenant_id: TENANT_ID, label: 'Workshop', sort_order: 5, is_system: true, created_at: now() },
    { id: 'et-other', tenant_id: TENANT_ID, label: 'Other', sort_order: 6, is_system: true, created_at: now() },
  ];

  const peopleSpecs: Array<[string, string, string, string | null, string, string, string]> = [
    ['p-jordan', 'Jordan', 'Reyes', 'jordan.reyes@example.com', 'Meridian Manufacturing', 'CEO', 'rt-member'],
    ['p-priya', 'Priya', 'Natarajan', 'priya.natarajan@example.com', 'Northwind Health Group', 'President', 'rt-member'],
    ['p-marcus', 'Marcus', 'Bell', 'marcus.bell@example.com', 'Bell Logistics', 'Founder & CEO', 'rt-member'],
    ['p-elena', 'Elena', 'Vasquez', 'elena.vasquez@example.com', 'Vasquez Capital Partners', 'Managing Partner', 'rt-prospect'],
    ['p-david', 'David', 'Okafor', 'david.okafor@example.com', 'Okafor Industrial', 'President', 'rt-member'],
    ['p-susan', 'Susan', 'Whitfield', 'susan.whitfield@example.com', 'Whitfield & Co.', 'CEO', 'rt-prospect'],
    ['p-tom', 'Tom', 'Larsen', 'tom.larsen@example.com', 'Larsen Precision Tooling', 'Owner', 'rt-member'],
    ['p-angela', 'Angela', 'Kim', 'angela.kim@example.com', 'Kim Biotech Ventures', 'CEO', 'rt-member'],
    ['p-robert', 'Robert', 'Chen', 'robert.chen@example.com', 'Chen Family Office', 'Principal', 'rt-prospect'],
    ['p-nicole', 'Nicole', 'Franklin', 'nicole.franklin@example.com', 'Franklin Retail Group', 'President', 'rt-member'],
    ['p-hank', 'Hank', 'Osei', 'hank.osei@example.com', 'Osei Freight & Rail', 'CEO', 'rt-alumnus'],
    ['p-maria', 'Maria', 'Gutierrez', null, 'Gutierrez & Sons', 'Owner', 'rt-guest'],
  ];

  const people = peopleSpecs.map(([pid, first, last, email, company, title, relType]) => ({
    id: pid,
    tenant_id: TENANT_ID,
    first_name: first,
    last_name: last,
    preferred_name: null,
    email,
    email_normalized: email ? email.toLowerCase().trim() : null,
    company,
    title,
    relationship_type_id: relType,
    contact_preference: pid === 'p-robert' ? 'do_not_contact' : 'email_ok',
    is_active: pid !== 'p-hank',
    summary_note: pid === 'p-jordan' ? 'Met at the Q1 breakfast - cares most about succession planning.' : null,
    created_at: daysFromNow(-120),
    updated_at: daysFromNow(-10),
  }));

  const events = [
    {
      id: EVENT_ID,
      tenant_id: TENANT_ID,
      internal_name: 'Q3 Roundtable',
      public_title: 'Executive Roundtable: Navigating Rising Input Costs',
      event_type_id: 'et-roundtable',
      purpose: 'A candid peer discussion on managing margin pressure without sacrificing growth.',
      audience_description: 'CEOs and Presidents of $10M-$150M companies',
      value_proposition: 'Walk away with two or three specific tactics your peers are using right now, not theory.',
      speaker_details: 'Facilitated discussion - no outside speaker, peer-led.',
      starts_at: daysFromNow(21),
      ends_at: null,
      time_zone: 'America/New_York',
      is_virtual: false,
      venue_name: 'The Wharton Club',
      venue_address: '123 Market Street, Suite 400',
      parking_notes: 'Valet available at the front entrance.',
      virtual_link: null,
      capacity: 20,
      rsvp_deadline: daysFromNow(16),
      status: 'inviting',
      created_at: daysFromNow(-14),
      updated_at: daysFromNow(-1),
    },
    {
      id: EVENT_ID_DRAFT,
      tenant_id: TENANT_ID,
      internal_name: 'Fall Member Social (planning)',
      public_title: 'Fall Member & Guest Social',
      event_type_id: 'et-social',
      purpose: null,
      audience_description: null,
      value_proposition: null,
      speaker_details: null,
      starts_at: null,
      ends_at: null,
      time_zone: 'America/New_York',
      is_virtual: false,
      venue_name: null,
      venue_address: null,
      parking_notes: null,
      virtual_link: null,
      capacity: null,
      rsvp_deadline: null,
      status: 'draft',
      created_at: daysFromNow(-2),
      updated_at: daysFromNow(-2),
    },
  ];

  // A realistic mix of statuses so the dashboard, invitees list, and send
  // flow all have something interesting to show.
  const invitationSpecs: Array<[string, string, string, string, number]> = [
    ['p-jordan', 'priority', 'sent', 'yes', 1],
    ['p-priya', 'member', 'sent', 'yes', 0],
    ['p-marcus', 'member', 'sent', 'maybe', 0],
    ['p-elena', 'priority', 'sent', 'no_response', 0],
    ['p-david', 'member', 'sent', 'no_response', 0],
    ['p-susan', 'prospect', 'sent', 'no', 0],
    ['p-tom', 'member', 'sent', 'yes', 1],
    ['p-angela', 'prospect', 'sent', 'no_response', 0],
    ['p-nicole', 'member', 'planned', 'no_response', 0],
    ['p-maria', 'guest', 'planned', 'no_response', 0],
  ];

  const invitations = invitationSpecs.map(([personId, segment, inviteStatus, rsvpStatus, guestCount]) => ({
    id: id('inv'),
    tenant_id: TENANT_ID,
    event_id: EVENT_ID,
    person_id: personId,
    public_token: id('token'),
    audience_segment: segment,
    personalization_note: personId === 'p-jordan' ? 'This is exactly the succession conversation we discussed in the spring.' : null,
    invite_status: inviteStatus,
    rsvp_status: rsvpStatus,
    rsvp_responded_at: rsvpStatus !== 'no_response' ? daysFromNow(-2) : null,
    guest_count: guestCount,
    guest_names: null,
    dietary_accessibility_notes: null,
    attendance_status: 'unknown',
    reminders_sent: {},
    calculated_next_action: null,
    next_action_overridden_by_host: false,
    host_override_status: null,
    created_at: daysFromNow(-13),
    updated_at: daysFromNow(-1),
  }));

  const notes = [
    {
      id: id('note'),
      tenant_id: TENANT_ID,
      person_id: 'p-jordan',
      event_id: null,
      invitation_id: null,
      body: 'Met at the Q1 breakfast, cares most about succession planning.',
      created_by: USER_ID,
      created_at: daysFromNow(-60),
    },
    {
      id: id('note'),
      tenant_id: TENANT_ID,
      person_id: 'p-susan',
      event_id: null,
      invitation_id: null,
      body: 'Said last year the timing didn’t work - worth a personal follow-up before writing off.',
      created_by: USER_ID,
      created_at: daysFromNow(-30),
    },
  ];

  const invitationMessageBody =
    "{{greeting_name}} -\n\nI'm putting together a small roundtable for a handful of CEOs I respect to compare notes on managing rising input costs without giving up margin. No outside speaker, no pitch - just a candid peer conversation.\n\nA few of the people joining are wrestling with exactly the same pressure points you've mentioned to me before, and I think an hour with them would be genuinely useful.\n\nDetails:\nDate: Thursday the 21st, 8:00 AM\nLocation: The Wharton Club, 123 Market Street\nPlease RSVP by the 16th\n\nIf this sounds worthwhile, I'd love to have you there: {{form_link}}\n\n{{host_signature}}";

  const messages = [
    {
      id: 'msg-invitation',
      tenant_id: TENANT_ID,
      event_id: EVENT_ID,
      message_type: 'invitation',
      subject: 'A candid peer conversation on input costs',
      body: invitationMessageBody,
      is_approved: true,
      approved_at: daysFromNow(-13),
      approved_by: USER_ID,
      created_at: daysFromNow(-14),
      updated_at: daysFromNow(-13),
    },
    ...[
      'reminder',
      'priority_follow_up',
      'rsvp_confirmation',
      'final_details',
      'waitlist',
      'cancellation',
      'thank_you',
      'post_event_follow_up',
      'form_intro',
      'form_confirmation',
    ].map((type) => ({
      id: `msg-${type}`,
      tenant_id: TENANT_ID,
      event_id: EVENT_ID,
      message_type: type,
      subject: null,
      body: '',
      is_approved: false,
      approved_at: null,
      approved_by: null,
      created_at: daysFromNow(-14),
      updated_at: daysFromNow(-14),
    })),
  ];

  const messageVariants = [
    {
      id: id('variant'),
      tenant_id: TENANT_ID,
      message_id: 'msg-invitation',
      variant_index: 1,
      subject: 'A candid conversation on input costs',
      body: invitationMessageBody,
      is_active: true,
      generated_by_ai: true,
      created_at: daysFromNow(-13),
      updated_at: daysFromNow(-13),
    },
    {
      id: id('variant'),
      tenant_id: TENANT_ID,
      message_id: 'msg-invitation',
      variant_index: 2,
      subject: 'Comparing notes on rising input costs',
      body: invitationMessageBody.replace("I'm putting together", "I've been putting together"),
      is_active: true,
      generated_by_ai: true,
      created_at: daysFromNow(-13),
      updated_at: daysFromNow(-13),
    },
    {
      id: id('variant'),
      tenant_id: TENANT_ID,
      message_id: 'msg-invitation',
      variant_index: 3,
      subject: 'A small peer roundtable on margin pressure',
      body: invitationMessageBody.replace('candid peer conversation', 'candid, off-the-record conversation'),
      is_active: true,
      generated_by_ai: true,
      created_at: daysFromNow(-13),
      updated_at: daysFromNow(-13),
    },
  ];

  const forms = [
    {
      id: FORM_ID,
      tenant_id: TENANT_ID,
      event_id: EVENT_ID,
      public_token: FORM_TOKEN,
      intro_text: "We'd love to know if you can join us - it takes less than a minute.",
      confirmation_text: 'Thank you - we look forward to seeing you there.',
      is_published: true,
      published_at: daysFromNow(-13),
      theme: null,
      created_at: daysFromNow(-14),
      updated_at: daysFromNow(-13),
    },
    {
      id: 'preview-form-draft',
      tenant_id: TENANT_ID,
      event_id: EVENT_ID_DRAFT,
      public_token: 'preview-form-token-draft',
      intro_text: null,
      confirmation_text: null,
      is_published: false,
      published_at: null,
      theme: null,
      created_at: daysFromNow(-2),
      updated_at: daysFromNow(-2),
    },
  ];

  const formQuestions = [
    { id: id('q'), tenant_id: TENANT_ID, form_id: FORM_ID, question_type: 'attendance', label: 'Will you be able to attend?', help_text: null, is_required: true, sort_order: 0, options: {}, created_at: now(), updated_at: now() },
    { id: id('q'), tenant_id: TENANT_ID, form_id: FORM_ID, question_type: 'guest_count', label: 'How many guests will you bring?', help_text: null, is_required: false, sort_order: 1, options: {}, created_at: now(), updated_at: now() },
    { id: id('q'), tenant_id: TENANT_ID, form_id: FORM_ID, question_type: 'dietary_accessibility', label: 'Any dietary or accessibility needs?', help_text: "So we can make sure you're comfortable.", is_required: false, sort_order: 2, options: {}, created_at: now(), updated_at: now() },
    { id: id('q'), tenant_id: TENANT_ID, form_id: FORM_ID, question_type: 'open_text', label: 'What would make this event especially valuable to you?', help_text: null, is_required: false, sort_order: 3, options: {}, created_at: now(), updated_at: now() },
  ];

  const formResponses = [
    {
      id: id('resp'),
      tenant_id: TENANT_ID,
      form_id: FORM_ID,
      invitation_id: invitations[0]!.id,
      raw_answers: { [formQuestions[0]!.id]: 'Yes, I plan to attend' },
      submitted_email: 'jordan.reyes@example.com',
      submitted_name: 'Jordan Reyes',
      submitted_at: daysFromNow(-2),
      ip_hash: null,
      match_status: 'matched',
      resolved_invitation_id: invitations[0]!.id,
      resolved_at: daysFromNow(-2),
      resolved_by: null,
      created_at: daysFromNow(-2),
    },
    {
      id: id('resp'),
      tenant_id: TENANT_ID,
      form_id: FORM_ID,
      invitation_id: null,
      raw_answers: { [formQuestions[0]!.id]: 'Yes, I plan to attend' },
      submitted_email: 'unknown.exec@example.com',
      submitted_name: 'Pat Somebody',
      submitted_at: daysFromNow(-1),
      ip_hash: null,
      match_status: 'needs_review',
      resolved_invitation_id: null,
      resolved_at: null,
      resolved_by: null,
      created_at: daysFromNow(-1),
    },
  ];

  const mailboxConnections = [
    {
      id: id('mailbox'),
      tenant_id: TENANT_ID,
      provider: 'microsoft',
      connected_email: 'cindy@cindysmithcoaching.com',
      encrypted_refresh_token: 'preview-not-real',
      access_token_expires_at: daysFromNow(1),
      status: 'connected',
      last_error: null,
      last_checked_at: now(),
      created_at: daysFromNow(-90),
      updated_at: daysFromNow(-1),
    },
  ];

  const tenantSettings = [
    {
      tenant_id: TENANT_ID,
      variant_threshold: 60,
      variant_count_min: 5,
      variant_count_max: 8,
      branding: { logoUrl: null, headerImageUrl: null, accentColor: '#b08d57', primaryColor: '#0f1f3d' },
      host_display_name: 'Cindy Smith',
      host_signature: 'Warmly,\nCindy',
      updated_at: now(),
    },
  ];

  const sendJobs = [
    {
      id: 'preview-send-job-1',
      tenant_id: TENANT_ID,
      event_id: EVENT_ID,
      message_id: 'msg-invitation',
      job_type: 'invitation',
      pace_profile: 'fastest',
      starts_at: daysFromNow(-13),
      estimated_finish_at: daysFromNow(-13),
      status: 'completed',
      total_recipients: 8,
      sent_count: 8,
      failed_count: 0,
      is_simulated: true,
      created_by: USER_ID,
      created_at: daysFromNow(-13),
      updated_at: daysFromNow(-13),
    },
  ];

  const sendJobRecipients = invitations
    .filter((i) => i.invite_status === 'sent')
    .map((inv) => ({
      id: id('sjr'),
      tenant_id: TENANT_ID,
      send_job_id: 'preview-send-job-1',
      invitation_id: inv.id,
      message_variant_id: null,
      resolved_subject: 'A candid peer conversation on input costs',
      resolved_body: '<p>Preview content</p>',
      scheduled_at: daysFromNow(-13),
      sent_at: daysFromNow(-13),
      status: 'sent',
      attempt_count: 1,
      last_error: null,
      provider_message_id: null,
      claimed_at: null,
      created_at: daysFromNow(-13),
      updated_at: daysFromNow(-13),
    }));

  const engagementSignals = [
    { id: id('sig'), tenant_id: TENANT_ID, invitation_id: invitations[0]!.id, signal_type: 'email_opened', occurred_at: daysFromNow(-12), meta: {}, created_at: daysFromNow(-12) },
    { id: id('sig'), tenant_id: TENANT_ID, invitation_id: invitations[0]!.id, signal_type: 'form_link_clicked', occurred_at: daysFromNow(-12), meta: {}, created_at: daysFromNow(-12) },
  ];

  return {
    tenants: [
      { id: TENANT_ID, name: 'Cindy Smith Coaching (Preview)', is_demo: false, created_at: daysFromNow(-200), updated_at: daysFromNow(-1) },
    ],
    app_users: [{ id: USER_ID, tenant_id: TENANT_ID, display_name: 'Cindy Smith', role: 'host', created_at: daysFromNow(-200) }],
    relationship_types: relationshipTypes,
    event_types: eventTypes,
    people,
    events,
    invitations,
    notes,
    messages,
    message_variants: messageVariants,
    forms,
    form_questions: formQuestions,
    form_responses: formResponses,
    mailbox_connections: mailboxConnections,
    tenant_settings: tenantSettings,
    send_jobs: sendJobs,
    send_job_recipients: sendJobRecipients,
    engagement_signals: engagementSignals,
  };
}
