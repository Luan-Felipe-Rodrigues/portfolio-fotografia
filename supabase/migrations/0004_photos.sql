-- ============================================================================
-- 0004_photos
-- The photos table. Each row is one photo, points to a collection (or a
-- sub-collection like `lugares-roma`), and carries the metadata that the
-- public site needs to render (dimensions, alt-text in 3 languages, order,
-- publication flag, home feature flag, capture date).
--
-- Reads: anon sees only published; authenticated (admin logged in) sees all.
-- Writes: not permitted directly. Go through SECURITY DEFINER functions in 0005.
-- ============================================================================

begin;

create table if not exists public.photos (
  id                uuid        primary key default gen_random_uuid(),
  collection_id     uuid        not null references public.collections(id) on delete restrict,
  storage_path      text        not null unique,
  width             integer     not null check (width > 0),
  height            integer     not null check (height > 0),
  alt_pt            text,
  alt_en            text,
  alt_es            text,
  display_order     integer     not null default 0,
  is_published      boolean     not null default true,
  is_home_featured  boolean     not null default false,
  taken_at          date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint photos_storage_path_nonempty check (length(storage_path) between 1 and 500)
);

create index if not exists photos_collection_order on public.photos(collection_id, display_order);
create index if not exists photos_published on public.photos(is_published) where is_published = true;
create index if not exists photos_home_featured on public.photos(is_home_featured) where is_home_featured = true;
create index if not exists photos_taken_at on public.photos(taken_at) where taken_at is not null;

drop trigger if exists touch_photos on public.photos;
create trigger touch_photos
  before update on public.photos
  for each row execute function private.set_updated_at();

alter table public.photos enable row level security;

-- Anonymous visitors see only what's published.
drop policy if exists "anon reads published photos" on public.photos;
create policy "anon reads published photos"
  on public.photos for select
  to anon
  using (is_published = true);

-- Authenticated users (the admin logged in via magic link) see everything,
-- including drafts. Allowlist-gating happens in 0005 write functions;
-- reading everything is safe because the only authenticated user is the admin.
drop policy if exists "authenticated reads all photos" on public.photos;
create policy "authenticated reads all photos"
  on public.photos for select
  to authenticated
  using (true);

commit;

-- ROLLBACK:
--   drop table public.photos cascade;
