-- 0012's branding storage policies only checked bucket_id, not the object's
-- own path - since uploadBrandingImageAction writes to
-- `${tenantId}/${uuid}.ext` (apps/web/src/lib/storage-actions.ts), tenant_id
-- there was just a path segment, not an access boundary. Any authenticated
-- Host could overwrite any other tenant's branding image at its (publicly
-- visible, since it's rendered as a plain <img src> on the public RSVP page)
-- URL. This re-scopes both policies to the caller's own tenant_id folder.
drop policy if exists branding_authenticated_upload on storage.objects;
drop policy if exists branding_authenticated_update on storage.objects;

create policy branding_authenticated_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = current_tenant_id()::text);

create policy branding_authenticated_update on storage.objects
  for update to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = current_tenant_id()::text);
