-- Lets a Host define their own classifier columns ("Prospect", "Member",
-- or anything else from their spreadsheet) rather than being limited to the
-- fixed contact fields - a basic Excel-CRM flexibility request.
create table custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  field_key text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, field_key)
);

create index custom_field_definitions_tenant_id_idx on custom_field_definitions (tenant_id);

alter table custom_field_definitions enable row level security;
create policy custom_field_definitions_isolation on custom_field_definitions
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table people add column custom_fields jsonb not null default '{}';

-- One search function backs both the Contacts list and the "add invitees to
-- an event" search, so "search by anything" (title, relationship type, any
-- custom field, not just name/company/email) only needs to be right in one
-- place. SECURITY INVOKER (the default) means the calling Hosts own RLS
-- still applies - p_tenant_id narrows the query directly rather than being
-- the only thing standing between tenants.
create or replace function search_people(
  p_tenant_id uuid,
  p_query text default null,
  p_status text default 'active',
  p_relationship_type_id uuid default null
)
returns setof people
language sql
stable
as $$
  select people.*
  from people
  where people.tenant_id = p_tenant_id
    and (
      p_status = 'all'
      or (p_status = 'active' and people.is_active)
      or (p_status = 'inactive' and not people.is_active)
    )
    and (p_relationship_type_id is null or people.relationship_type_id = p_relationship_type_id)
    and (
      p_query is null or p_query = ''
      or people.first_name ilike '%' || p_query || '%'
      or people.last_name ilike '%' || p_query || '%'
      or people.preferred_name ilike '%' || p_query || '%'
      or people.company ilike '%' || p_query || '%'
      or people.title ilike '%' || p_query || '%'
      or people.email ilike '%' || p_query || '%'
      or people.summary_note ilike '%' || p_query || '%'
      or people.custom_fields::text ilike '%' || p_query || '%'
      or exists (
        select 1 from relationship_types rt
        where rt.id = people.relationship_type_id and rt.label ilike '%' || p_query || '%'
      )
    )
  order by people.last_name, people.first_name;
$$;

comment on function search_people is
  'Backs both the Contacts list and the add-invitees search - matches name, company, title, email, relationship type label, the free-text summary note, and any custom field value.';
