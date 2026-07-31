-- ============================================================================
-- Chair Event System — Mailbox Connections, Send Jobs, Engagement, Settings
-- Part 2.2, 7, 8, 11.1
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Mailbox connections — one per tenant. Holds the Microsoft Graph refresh
-- token that lets the server send while the Host is away (2.2, 7.1, 11.1).
-- Tokens are encrypted at the application layer before being written here
-- (see apps/web/src/lib/crypto.ts) — this column never holds plaintext.
-- ----------------------------------------------------------------------------
create table mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants (id) on delete cascade,

  provider text not null default 'microsoft' check (provider in ('microsoft')),
  connected_email text,

  encrypted_refresh_token text,
  access_token_expires_at timestamptz,

  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'needs_reconnect', 'throttled')),
  last_error text,
  last_checked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mailbox_connections_set_updated_at before update on mailbox_connections
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Tenant-level settings — operator-tunable knobs and Host branding (Part
-- 7.5 variant threshold, Part 10.4 whitelabel).
-- ----------------------------------------------------------------------------
create table tenant_settings (
  tenant_id uuid primary key references tenants (id) on delete cascade,

  variant_threshold integer not null default 60,
  variant_count_min integer not null default 5,
  variant_count_max integer not null default 8,

  branding jsonb not null default '{
    "logoUrl": null,
    "accentColor": "#B08D57",
    "primaryColor": "#0F1F3D",
    "headerImageUrl": null
  }'::jsonb,

  host_display_name text,
  host_signature text,

  updated_at timestamptz not null default now()
);

create trigger tenant_settings_set_updated_at before update on tenant_settings
  for each row execute function set_updated_at();

comment on column tenant_settings.variant_threshold is
  'Recipient count above which message variation kicks in (7.5). Spec suggests ~60 as a sensible default; operator-tunable, not a hardcoded magic number.';

-- ----------------------------------------------------------------------------
-- Send jobs — one durable record per bulk send (Part 3.8, 7.6)
-- ----------------------------------------------------------------------------
create table send_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  message_id uuid not null references messages (id) on delete restrict,

  job_type text not null default 'invitation' check (job_type in (
    'invitation', 'reminder', 'priority_follow_up', 'rsvp_confirmation',
    'final_details', 'waitlist', 'cancellation', 'thank_you', 'post_event_follow_up'
  )),

  pace_profile text not null check (pace_profile in ('fastest', 'one_day', 'two_day', 'custom')),
  starts_at timestamptz not null default now(),
  estimated_finish_at timestamptz,

  status text not null default 'queued'
    check (status in ('queued', 'running', 'paused', 'completed', 'cancelled', 'failed')),

  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,

  -- True for demo-tenant jobs: the worker simulates delivery instead of
  -- calling Microsoft Graph (2.5 — "a real email must never leave the demo
  -- account").
  is_simulated boolean not null default false,

  created_by uuid references app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index send_jobs_tenant_id_idx on send_jobs (tenant_id);
create index send_jobs_event_id_idx on send_jobs (event_id);
create index send_jobs_status_idx on send_jobs (status);

create trigger send_jobs_set_updated_at before update on send_jobs
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Send job recipients — the actual queue the worker consumes (7.6). This is
-- the durable state that makes sending crash-proof: the worker holds nothing
-- important in memory, it only asks "what's due next?" and writes results
-- back immediately (2.2).
-- ----------------------------------------------------------------------------
create table send_job_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  send_job_id uuid not null references send_jobs (id) on delete cascade,
  invitation_id uuid not null references invitations (id) on delete cascade,

  message_variant_id uuid references message_variants (id) on delete set null,

  -- Fully resolved, merge-field-substituted content, frozen at enqueue time
  -- so an edit to the underlying draft after this point can never alter
  -- what's already scheduled to go out unsent-to-that-person (6.4).
  resolved_subject text not null,
  resolved_body text not null,

  scheduled_at timestamptz not null,
  sent_at timestamptz,

  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'cancelled')),

  attempt_count integer not null default 0,
  last_error text,

  -- Microsoft Graph message id, for correlating with bounce webhooks / logs.
  provider_message_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (send_job_id, invitation_id)
);

-- The single most important index in the system: this is exactly the query
-- the worker runs every polling cycle ("what's due next, across all
-- tenants?"). See Part 2.2, 7.6.
create index send_job_recipients_due_idx
  on send_job_recipients (status, scheduled_at)
  where status = 'queued';

create index send_job_recipients_job_id_idx on send_job_recipients (send_job_id);
create index send_job_recipients_invitation_id_idx on send_job_recipients (invitation_id);
create index send_job_recipients_tenant_id_idx on send_job_recipients (tenant_id);

create trigger send_job_recipients_set_updated_at before update on send_job_recipients
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Engagement signals — soft, probabilistic (Part 3.9, 8.3)
-- ----------------------------------------------------------------------------
create table engagement_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  invitation_id uuid not null references invitations (id) on delete cascade,

  signal_type text not null check (signal_type in (
    'email_opened', 'form_link_clicked', 'form_started', 'form_submitted'
  )),

  occurred_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index engagement_signals_invitation_id_idx on engagement_signals (invitation_id);
create index engagement_signals_tenant_id_idx on engagement_signals (tenant_id);

comment on table engagement_signals is
  'Explicitly probabilistic (8.3) — Apple Mail Privacy Protection and corporate link pre-fetching both create false positives. Every UI surface reading this table must show the honest clarifying note; never present as certainty.';
