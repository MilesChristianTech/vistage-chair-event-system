-- ============================================================================
-- Chair Event System — Core Schema
-- Tenants, users, CRM (people), events, invitations, notes
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tenants (Hosts). Every piece of tenant data hangs off this table.
-- ----------------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table tenants is 'One row per Host organization. Row-level security keys off this everywhere.';
comment on column tenants.is_demo is 'True only for the operator-facing demo tenant. Sending must be blocked/simulated for demo tenants — enforced in application logic, see apps/web send preflight.';

-- ----------------------------------------------------------------------------
-- App users. One row per authenticated person, mapped 1:1 to auth.users.
-- Provisioned directly by the operator (Part 2.5) — no self-signup in V1.
-- ----------------------------------------------------------------------------
create table app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  display_name text not null,
  role text not null default 'host' check (role in ('host', 'operator')),
  created_at timestamptz not null default now()
);

create index app_users_tenant_id_idx on app_users (tenant_id);

-- Helper: resolve the calling user's tenant. SECURITY DEFINER so RLS policies
-- (which run as the calling role) can still look this up without granting
-- broad table access to authenticated users.
create or replace function current_tenant_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select tenant_id from app_users where id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- Editable lookup lists (Part 3.2, 3.3: "editable by the Host, not hardcoded")
-- ----------------------------------------------------------------------------
create table relationship_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index relationship_types_tenant_id_idx on relationship_types (tenant_id);

create table event_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index event_types_tenant_id_idx on event_types (tenant_id);

-- ----------------------------------------------------------------------------
-- People (the CRM) — Part 3.2
-- ----------------------------------------------------------------------------
create table people (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,

  first_name text not null,
  last_name text not null,
  preferred_name text,

  email text,
  email_normalized text generated always as (lower(trim(email))) stored,

  company text,
  title text,

  relationship_type_id uuid references relationship_types (id) on delete set null,

  contact_preference text not null default 'email_ok'
    check (contact_preference in ('email_ok', 'phone_only', 'do_not_contact')),

  is_active boolean not null default true,

  -- Free-text durable relationship context, distinct from the timestamped
  -- Notes table (3.7) which is the structured, timestamped record. This
  -- field is a quick-glance summary the Host can edit inline.
  summary_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index people_tenant_id_idx on people (tenant_id);
create index people_email_normalized_idx on people (tenant_id, email_normalized);
create index people_active_idx on people (tenant_id, is_active);
create index people_name_idx on people (tenant_id, last_name, first_name);

comment on column people.email_normalized is 'Lowercased/trimmed email, maintained automatically for matching. Never shown to the Host directly (3.2).';

-- ----------------------------------------------------------------------------
-- Events — Part 3.3
-- ----------------------------------------------------------------------------
create table events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,

  internal_name text not null,
  public_title text not null,

  event_type_id uuid references event_types (id) on delete set null,

  purpose text,
  audience_description text,
  value_proposition text,
  speaker_details text,

  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text not null default 'America/New_York',

  is_virtual boolean not null default false,
  venue_name text,
  venue_address text,
  parking_notes text,
  virtual_link text,

  capacity integer,
  rsvp_deadline timestamptz,

  status text not null default 'draft'
    check (status in ('draft', 'inviting', 'closed', 'completed', 'cancelled')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_tenant_id_idx on events (tenant_id);
create index events_status_idx on events (tenant_id, status);

-- ----------------------------------------------------------------------------
-- Invitations — Person x Event — Part 3.4
-- ----------------------------------------------------------------------------
create table invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,

  event_id uuid not null references events (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,

  -- Unguessable token used on the personalized RSVP link so a busy executive
  -- never has to type an event code (3.6). Never exposed except in that URL.
  public_token uuid not null default gen_random_uuid(),

  audience_segment text not null default 'guest'
    check (audience_segment in ('priority', 'member', 'prospect', 'guest', 'referral', 'other')),

  personalization_note text,

  invite_status text not null default 'planned'
    check (invite_status in ('planned', 'ready', 'sent', 'held', 'bounced', 'withdrawn')),

  rsvp_status text not null default 'no_response'
    check (rsvp_status in ('no_response', 'yes', 'no', 'maybe', 'waitlisted', 'cancelled')),
  rsvp_responded_at timestamptz,
  guest_count integer not null default 0,
  guest_names text,
  dietary_accessibility_notes text,

  attendance_status text not null default 'unknown'
    check (attendance_status in ('unknown', 'attended', 'no_show', 'cancelled')),

  reminders_sent jsonb not null default '{}'::jsonb,

  -- Calculated recommendation vs. Host override — see 3.4.
  calculated_next_action text,
  next_action_overridden_by_host boolean not null default false,
  host_override_status text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_id, person_id)
);

create index invitations_tenant_id_idx on invitations (tenant_id);
create index invitations_event_id_idx on invitations (event_id);
create index invitations_person_id_idx on invitations (person_id);
create index invitations_public_token_idx on invitations (public_token);
create index invitations_rsvp_status_idx on invitations (event_id, rsvp_status);

comment on constraint invitations_event_id_person_id_key on invitations is
  'Enforces "one invitation per person per event" at the database level (3.4, 3.10). Application layer flags attempted duplicates rather than relying only on this, but the constraint is the last line of defense.';

-- ----------------------------------------------------------------------------
-- Notes — contextual, polymorphic (Part 3.7)
-- Exactly one of person_id / event_id / invitation_id is set.
-- ----------------------------------------------------------------------------
create table notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,

  person_id uuid references people (id) on delete cascade,
  event_id uuid references events (id) on delete cascade,
  invitation_id uuid references invitations (id) on delete cascade,

  body text not null,
  created_by uuid references app_users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint notes_exactly_one_parent check (
    (case when person_id is not null then 1 else 0 end) +
    (case when event_id is not null then 1 else 0 end) +
    (case when invitation_id is not null then 1 else 0 end) = 1
  )
);

create index notes_tenant_id_idx on notes (tenant_id);
create index notes_person_id_idx on notes (person_id) where person_id is not null;
create index notes_event_id_idx on notes (event_id) where event_id is not null;
create index notes_invitation_id_idx on notes (invitation_id) where invitation_id is not null;

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at before update on tenants
  for each row execute function set_updated_at();
create trigger people_set_updated_at before update on people
  for each row execute function set_updated_at();
create trigger events_set_updated_at before update on events
  for each row execute function set_updated_at();
create trigger invitations_set_updated_at before update on invitations
  for each row execute function set_updated_at();
