-- ============================================================================
-- 0005_admin_allowlist_and_writes
-- Locks all write paths for collections + photos behind an admin allowlist.
--
-- Layers of defense (redundant on purpose):
--   1. `private.admin_allowlist` table lists which emails are admins.
--   2. `private.enforce_admin_allowlist` trigger blocks signup on `auth.users`
--      for any email not in the allowlist (fails loud with an error message).
--   3. Every write function (`create/update/delete_collection` and photos)
--      calls `private.current_user_is_admin()` before doing anything. Even if
--      a rogue user somehow ends up in `auth.users`, they cannot write.
--   4. RLS policies on the tables never grant INSERT/UPDATE/DELETE to any
--      role. All writes must go through the functions.
--
-- Grants: EXECUTE on the write functions is given to `authenticated` only.
-- Anon cannot even see the functions on the API surface.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Allowlist (private schema = invisible to the API).
-- ---------------------------------------------------------------------------
create table if not exists private.admin_allowlist (
  email      text        primary key,
  note       text,
  created_at timestamptz not null default now()
);

insert into private.admin_allowlist(email, note) values
  ('rodfelluan@gmail.com', 'Luan Rodrigues, owner')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- Helper: is the currently authenticated user an admin?
-- Used inside every write function. `stable` because within a single
-- transaction the answer does not change.
-- ---------------------------------------------------------------------------
create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join private.admin_allowlist a on a.email = u.email
    where u.id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Signup allowlist trigger. Blocks any attempt to create an account with an
-- email that is not on the allowlist. Runs before insert on auth.users.
-- ---------------------------------------------------------------------------
create or replace function private.enforce_admin_allowlist()
returns trigger
language plpgsql
security definer
set search_path = private, public, auth
as $$
begin
  if not exists (select 1 from private.admin_allowlist where email = new.email) then
    raise exception 'Signup rejected for %: not in admin allowlist', new.email;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_admin_allowlist on auth.users;
create trigger enforce_admin_allowlist
  before insert on auth.users
  for each row execute function private.enforce_admin_allowlist();

-- ===========================================================================
-- WRITE FUNCTIONS: collections
-- ===========================================================================

create or replace function public.create_collection(
  p_slug          text,
  p_parent_slug   text,
  p_name_pt       text,
  p_name_en       text,
  p_name_es       text,
  p_display_order integer
) returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id uuid;
begin
  if not private.current_user_is_admin() then
    raise exception 'Not authorized';
  end if;
  insert into public.collections (slug, parent_slug, name_pt, name_en, name_es, display_order)
  values (p_slug, p_parent_slug, p_name_pt, p_name_en, p_name_es, coalesce(p_display_order, 0))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_collection(
  p_id            uuid,
  p_slug          text,
  p_parent_slug   text,
  p_name_pt       text,
  p_name_en       text,
  p_name_es       text,
  p_display_order integer
) returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.current_user_is_admin() then
    raise exception 'Not authorized';
  end if;
  update public.collections set
    slug          = coalesce(p_slug, slug),
    parent_slug   = p_parent_slug,
    name_pt       = coalesce(p_name_pt, name_pt),
    name_en       = coalesce(p_name_en, name_en),
    name_es       = coalesce(p_name_es, name_es),
    display_order = coalesce(p_display_order, display_order)
  where id = p_id;
end;
$$;

create or replace function public.delete_collection(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.current_user_is_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.collections where id = p_id;
end;
$$;

-- ===========================================================================
-- WRITE FUNCTIONS: photos
-- ===========================================================================

create or replace function public.create_photo(
  p_collection_id    uuid,
  p_storage_path     text,
  p_width            integer,
  p_height           integer,
  p_alt_pt           text,
  p_alt_en           text,
  p_alt_es           text,
  p_display_order    integer,
  p_is_published     boolean,
  p_is_home_featured boolean,
  p_taken_at         date
) returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id uuid;
begin
  if not private.current_user_is_admin() then
    raise exception 'Not authorized';
  end if;
  insert into public.photos (
    collection_id, storage_path, width, height,
    alt_pt, alt_en, alt_es,
    display_order, is_published, is_home_featured, taken_at
  ) values (
    p_collection_id, p_storage_path, p_width, p_height,
    p_alt_pt, p_alt_en, p_alt_es,
    coalesce(p_display_order, 0),
    coalesce(p_is_published, true),
    coalesce(p_is_home_featured, false),
    p_taken_at
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_photo(
  p_id               uuid,
  p_collection_id    uuid,
  p_alt_pt           text,
  p_alt_en           text,
  p_alt_es           text,
  p_display_order    integer,
  p_is_published     boolean,
  p_is_home_featured boolean,
  p_taken_at         date
) returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.current_user_is_admin() then
    raise exception 'Not authorized';
  end if;
  update public.photos set
    collection_id    = coalesce(p_collection_id, collection_id),
    alt_pt           = coalesce(p_alt_pt, alt_pt),
    alt_en           = coalesce(p_alt_en, alt_en),
    alt_es           = coalesce(p_alt_es, alt_es),
    display_order    = coalesce(p_display_order, display_order),
    is_published     = coalesce(p_is_published, is_published),
    is_home_featured = coalesce(p_is_home_featured, is_home_featured),
    taken_at         = coalesce(p_taken_at, taken_at)
  where id = p_id;
end;
$$;

-- Note: this deletes the DB row only. The Storage object cleanup happens in
-- the admin UI (JS calls Supabase Storage SDK after this call succeeds).
-- Keeping them decoupled means a failed storage delete does not leave a
-- ghost row, and vice versa.
create or replace function public.delete_photo(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_storage_path text;
begin
  if not private.current_user_is_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.photos where id = p_id returning storage_path into v_storage_path;
  return v_storage_path;
end;
$$;

-- ===========================================================================
-- Grants
-- ===========================================================================
revoke all on function public.create_collection(text, text, text, text, text, integer) from public;
revoke all on function public.update_collection(uuid, text, text, text, text, text, integer) from public;
revoke all on function public.delete_collection(uuid) from public;
revoke all on function public.create_photo(uuid, text, integer, integer, text, text, text, integer, boolean, boolean, date) from public;
revoke all on function public.update_photo(uuid, uuid, text, text, text, integer, boolean, boolean, date) from public;
revoke all on function public.delete_photo(uuid) from public;

grant execute on function public.create_collection(text, text, text, text, text, integer) to authenticated;
grant execute on function public.update_collection(uuid, text, text, text, text, text, integer) to authenticated;
grant execute on function public.delete_collection(uuid) to authenticated;
grant execute on function public.create_photo(uuid, text, integer, integer, text, text, text, integer, boolean, boolean, date) to authenticated;
grant execute on function public.update_photo(uuid, uuid, text, text, text, integer, boolean, boolean, date) to authenticated;
grant execute on function public.delete_photo(uuid) to authenticated;

commit;

-- ROLLBACK:
--   drop trigger if exists enforce_admin_allowlist on auth.users;
--   drop function if exists private.enforce_admin_allowlist();
--   drop function if exists private.current_user_is_admin();
--   drop function if exists public.create_collection(text, text, text, text, text, integer);
--   drop function if exists public.update_collection(uuid, text, text, text, text, text, integer);
--   drop function if exists public.delete_collection(uuid);
--   drop function if exists public.create_photo(uuid, text, integer, integer, text, text, text, integer, boolean, boolean, date);
--   drop function if exists public.update_photo(uuid, uuid, text, text, text, integer, boolean, boolean, date);
--   drop function if exists public.delete_photo(uuid);
--   drop table if exists private.admin_allowlist;
