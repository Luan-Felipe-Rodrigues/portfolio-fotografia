-- ============================================================================
-- 0007_photos_archive
-- Adds an archived state to photos, independent of is_published.
--
-- Semantics:
--   * is_published = true  AND is_archived = false  → visible to visitors
--   * is_published = false AND is_archived = false  → draft, admin-only
--   * is_archived  = true                           → hidden from public
--                                                     regardless of is_published;
--                                                     hidden from admin default view
--                                                     until admin toggles the
--                                                     "Arquivadas" tab
--
-- Restoring an archived photo does NOT touch is_published, so a photo that
-- was live before being archived returns to live if is_published was true.
--
-- Public read policy is tightened to require both flags. Admin RLS is
-- unchanged (authenticated still sees everything).
-- ============================================================================

begin;

alter table public.photos
  add column if not exists is_archived boolean not null default false;

create index if not exists photos_archived on public.photos(is_archived) where is_archived = true;
create index if not exists photos_visible on public.photos(is_published, is_archived)
  where is_published = true and is_archived = false;

-- Tighten anon read policy: exclude archived rows.
drop policy if exists "anon reads published photos" on public.photos;
create policy "anon reads published photos"
  on public.photos for select
  to anon
  using (is_published = true and is_archived = false);

-- Dedicated toggle so the admin UI can archive/restore without going through
-- the general update path (keeps intent explicit in logs and callers).
create or replace function public.set_photo_archived(p_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.current_user_is_admin() then
    raise exception 'Not authorized';
  end if;
  update public.photos set is_archived = coalesce(p_archived, is_archived) where id = p_id;
end;
$$;

revoke all on function public.set_photo_archived(uuid, boolean) from public;
grant execute on function public.set_photo_archived(uuid, boolean) to authenticated;

commit;

-- ROLLBACK:
--   drop function if exists public.set_photo_archived(uuid, boolean);
--   drop policy if exists "anon reads published photos" on public.photos;
--   create policy "anon reads published photos" on public.photos for select to anon using (is_published = true);
--   alter table public.photos drop column if exists is_archived;
