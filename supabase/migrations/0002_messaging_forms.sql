-- ============================================================================
-- Chair Event System — Messages/Drafts, Forms, Responses
-- Part 3.5, 3.6, 3.10
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Messages (drafts) — one canonical message per (event, message_type),
-- authored by the Host via the Coach. Part 3.5, 5.3.
-- ----------------------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,

  message_type text not null check (message_type in (
    'invitation', 'reminder', 'priority_follow_up', 'rsvp_confirmation',
    'final_details', 'waitlist', 'cancellation', 'thank_you',
    'post_event_follow_up', 'form_intro', 'form_confirmation'
  )),

  subject text,
  body text not null default '',

  is_approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references app_users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_id, message_type)
);

create index messages_tenant_id_idx on messages (tenant_id);
create index messages_event_id_idx on messages (event_id);

comment on column messages.is_approved is
  'Every Coach-generated item is a draft until the Host explicitly approves it (3.5, 5.5). Sending is blocked on the invitation message until approved.';

-- ----------------------------------------------------------------------------
-- Message variants — for deliverability at volume (Part 7.5). The canonical
-- message (above) is variant "0" conceptually; additional AI-generated
-- variants live here and are always visible/editable, never hidden.
-- ----------------------------------------------------------------------------
create table message_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  message_id uuid not null references messages (id) on delete cascade,

  variant_index integer not null,
  subject text not null,
  body text not null,

  is_active boolean not null default true,
  generated_by_ai boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (message_id, variant_index)
);

create index message_variants_message_id_idx on message_variants (message_id);

create trigger messages_set_updated_at before update on messages
  for each row execute function set_updated_at();
create trigger message_variants_set_updated_at before update on message_variants
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Forms — one hosted RSVP form per event (Part 3.6)
-- ----------------------------------------------------------------------------
create table forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  event_id uuid not null unique references events (id) on delete cascade,

  -- Unguessable public link identifier. The public form page and public API
  -- routes resolve entirely through the Next.js server (service-role client),
  -- never via direct anon access to Supabase, so this token is the only
  -- thing standing between "unlisted" and "indexable" — treat it as a secret.
  public_token uuid not null default gen_random_uuid(),

  intro_text text,
  confirmation_text text,

  is_published boolean not null default false,
  published_at timestamptz,

  -- Whitelabel theme override for this event's form. Falls back to the
  -- tenant's default branding (tenants_branding table) when null.
  theme jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index forms_public_token_idx on forms (public_token);
create index forms_tenant_id_idx on forms (tenant_id);

create trigger forms_set_updated_at before update on forms
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Form questions — drag-and-drop assembled, ordered, editable/removable.
-- ----------------------------------------------------------------------------
create table form_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  form_id uuid not null references forms (id) on delete cascade,

  question_type text not null check (question_type in (
    'attendance', 'guest_count', 'guest_names', 'dietary_accessibility',
    'open_text', 'short_text', 'yes_no'
  )),

  label text not null,
  help_text text,
  is_required boolean not null default false,
  sort_order integer not null default 0,

  -- For question_type = 'yes_no' / 'short_text' etc., optional config
  -- (choice labels, placeholder text) so custom questions remain flexible
  -- without new columns per type.
  options jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index form_questions_form_id_idx on form_questions (form_id, sort_order);

create trigger form_questions_set_updated_at before update on form_questions
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Form responses — RAW, immutable submissions (Part 3.10: "preserve raw,
-- do normalization/matching in a separate layer"). Never edited in place.
-- ----------------------------------------------------------------------------
create table form_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  form_id uuid not null references forms (id) on delete cascade,

  -- Set if the response arrived via a personalized invitation link.
  invitation_id uuid references invitations (id) on delete set null,

  -- Exact raw payload as submitted, keyed by form_question_id. Never mutated.
  raw_answers jsonb not null,

  submitted_email text,
  submitted_name text,

  submitted_at timestamptz not null default now(),
  ip_hash text,

  -- Matching status: was this cleanly tied to an invitation, or does it need
  -- the Host's attention (3.10 "exceptions view")?
  match_status text not null default 'matched'
    check (match_status in ('matched', 'needs_review', 'manual_entry')),

  -- Populated once the Host resolves an exception, without touching raw data.
  resolved_invitation_id uuid references invitations (id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references app_users (id) on delete set null,

  created_at timestamptz not null default now()
);

create index form_responses_tenant_id_idx on form_responses (tenant_id);
create index form_responses_form_id_idx on form_responses (form_id);
create index form_responses_invitation_id_idx on form_responses (invitation_id);
create index form_responses_match_status_idx on form_responses (tenant_id, match_status);

comment on table form_responses is
  'Immutable source of truth for what an invitee actually submitted. Parsed/normalized fields on the invitation (rsvp_status, guest_count, etc.) are derived from this and may be corrected by the Host without ever altering these rows.';
