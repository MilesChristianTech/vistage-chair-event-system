-- ============================================================================
-- Chair Event System - Row-Level Security
--
-- Structural tenant isolation (Part 2.3, 12): every tenant-scoped table gets
-- RLS enabled with a single pattern - a row is visible/writable only if its
-- tenant_id matches current_tenant_id() for the authenticated caller.
--
-- Public-facing surfaces (the hosted RSVP form, submitting a response) are
-- deliberately NOT exposed via anon Supabase policies. They go through
-- Next.js server routes using the service-role key (apps/web/src/lib/
-- supabase/service.ts), which bypasses RLS deliberately and applies its own
-- narrow, purpose-built checks (see apps/web/src/app/api/public/*). This
-- keeps the "structurally impossible to leak another tenant's data" property
-- for authenticated access while still allowing a public form link to work,
-- without ever handing the anon role broad table access.
-- ============================================================================

alter table tenants enable row level security;
alter table app_users enable row level security;
alter table relationship_types enable row level security;
alter table event_types enable row level security;
alter table people enable row level security;
alter table events enable row level security;
alter table invitations enable row level security;
alter table notes enable row level security;
alter table messages enable row level security;
alter table message_variants enable row level security;
alter table forms enable row level security;
alter table form_questions enable row level security;
alter table form_responses enable row level security;
alter table mailbox_connections enable row level security;
alter table tenant_settings enable row level security;
alter table send_jobs enable row level security;
alter table send_job_recipients enable row level security;
alter table engagement_signals enable row level security;

-- tenants: a Host may read their own tenant row (for display), never others.
create policy tenants_select_own on tenants
  for select using (id = current_tenant_id());

-- app_users: a Host may see co-tenant users (rare in V1, matters later),
-- never other tenants' users.
create policy app_users_select_same_tenant on app_users
  for select using (tenant_id = current_tenant_id());

-- Generic tenant-isolation policy, applied per table below. Written out
-- per-table (rather than looped) so each is explicit and auditable.

create policy relationship_types_isolation on relationship_types
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy event_types_isolation on event_types
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy people_isolation on people
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy events_isolation on events
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy invitations_isolation on invitations
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy notes_isolation on notes
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy messages_isolation on messages
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy message_variants_isolation on message_variants
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy forms_isolation on forms
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy form_questions_isolation on form_questions
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy form_responses_isolation on form_responses
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy mailbox_connections_isolation on mailbox_connections
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy tenant_settings_isolation on tenant_settings
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy send_jobs_isolation on send_jobs
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy send_job_recipients_isolation on send_job_recipients
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create policy engagement_signals_isolation on engagement_signals
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Note: the `service_role` used by the Next.js server and the send worker
-- bypasses RLS entirely by design (Supabase's service key always does) -
-- that is how the worker polls send_job_recipients across ALL tenants in
-- one shared queue (7.6) and how public form routes work. The browser is
-- NEVER given the service key (see docs/OWNER_SETUP_CHECKLIST.md); the
-- browser only ever holds the anon key plus a signed-in session, which is
-- exactly what these policies constrain.
