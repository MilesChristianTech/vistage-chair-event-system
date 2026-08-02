-- The "branding" bucket (created via the Supabase Storage API, public for
-- reads) still needs an explicit RLS policy for writes - a public bucket
-- only affects how reads are served, not who's allowed to upload.
create policy branding_authenticated_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding');

create policy branding_authenticated_update on storage.objects
  for update to authenticated
  using (bucket_id = 'branding');
