-- ============================================================================
-- Chair Event System - Automatic tenant provisioning defaults
--
-- "Adding a second Host later is an onboarding task, not an engineering
-- project" (2.3). Whenever a new tenant row is created - the pilot Host,
-- the demo tenant, or any future Host - it should automatically receive
-- sensible default settings and editable lookup lists, so the operator
-- never has to hand-seed those tables per tenant.
-- ============================================================================

create or replace function provision_new_tenant()
returns trigger
language plpgsql
as $$
begin
  insert into tenant_settings (tenant_id) values (new.id);

  insert into relationship_types (tenant_id, label, sort_order, is_system) values
    (new.id, 'Member', 1, true),
    (new.id, 'Prospect', 2, true),
    (new.id, 'Alumnus', 3, true),
    (new.id, 'Referral Partner', 4, true),
    (new.id, 'Speaker', 5, true),
    (new.id, 'Guest', 6, true),
    (new.id, 'Spouse', 7, true),
    (new.id, 'Other', 8, true);

  insert into event_types (tenant_id, label, sort_order, is_system) values
    (new.id, 'Executive Roundtable', 1, true),
    (new.id, 'Speaker Dinner', 2, true),
    (new.id, 'Member/Guest Event', 3, true),
    (new.id, 'Social / Spouse Event', 4, true),
    (new.id, 'Workshop', 5, true),
    (new.id, 'Other', 6, true);

  return new;
end;
$$;

create trigger tenants_provision_defaults after insert on tenants
  for each row execute function provision_new_tenant();

comment on function provision_new_tenant is
  'Fires on every new tenant (real Host or demo). Keeps onboarding a one-row insert instead of a multi-table manual seed - see scripts/provision-tenant.ts.';
