-- ============================================================================
-- 0006_storage_photos
-- Storage bucket that holds the actual image files. Object records live in
-- `storage.objects` and are addressed by (bucket_id, name). We use `photos`
-- with `public = true` so the CDN can serve files directly by URL.
--
-- Policies:
--   * SELECT: anyone. Files are meant to be seen. Access control lives at
--     the DB layer (`photos.is_published`), not at the object layer.
--   * INSERT / UPDATE / DELETE: only authenticated users whose email is in
--     `private.admin_allowlist`. Reuses `private.current_user_is_admin()`
--     from 0005 so the check is defined in exactly one place.
--
-- Path convention (enforced by the admin UI, not by SQL): `<collection>/<yyyy>/<uuid>.<ext>`.
-- ============================================================================

begin;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = excluded.public;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects, scoped to bucket_id = 'photos'.
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can read photos bucket" on storage.objects;
create policy "anyone can read photos bucket"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

drop policy if exists "admin can insert into photos bucket" on storage.objects;
create policy "admin can insert into photos bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos' and private.current_user_is_admin());

drop policy if exists "admin can update photos bucket" on storage.objects;
create policy "admin can update photos bucket"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos' and private.current_user_is_admin())
  with check (bucket_id = 'photos' and private.current_user_is_admin());

drop policy if exists "admin can delete from photos bucket" on storage.objects;
create policy "admin can delete from photos bucket"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and private.current_user_is_admin());

commit;

-- ROLLBACK:
--   drop policy if exists "anyone can read photos bucket" on storage.objects;
--   drop policy if exists "admin can insert into photos bucket" on storage.objects;
--   drop policy if exists "admin can update photos bucket" on storage.objects;
--   drop policy if exists "admin can delete from photos bucket" on storage.objects;
--   delete from storage.buckets where id = 'photos';
