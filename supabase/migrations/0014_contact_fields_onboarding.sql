-- Tracks whether a tenant has been through the "set up your important
-- contact fields" first-run step (apps/web/src/app/onboarding/fields) - a
-- brand-new tenant defaults to false so the (app) layout routes them there
-- once before letting them into the rest of the product; the demo tenant
-- skips this check entirely (see (app)/layout.tsx) so it always works
-- out of the box.
alter table tenant_settings add column contact_fields_onboarded boolean not null default false;
