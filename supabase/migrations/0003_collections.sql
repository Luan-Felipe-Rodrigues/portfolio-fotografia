-- ============================================================================
-- 0003_collections
-- Curated groups that photos belong to. Top-level entries (autoral, prewedding,
-- eventos, lugares) each correspond to a series page. Child entries (parent_slug
-- pointing at a top-level slug) model sub-locations like Roma inside Lugares.
--
-- No 'home' collection here on purpose — the home page renders a mix curated
-- via `photos.is_home_featured`, not a collection.
--
-- Reads are open; writes go through SECURITY DEFINER functions gated by the
-- admin allowlist introduced in 0006.
-- ============================================================================

begin;

create table if not exists public.collections (
  id             uuid        primary key default gen_random_uuid(),
  slug           text        not null unique,
  parent_slug    text        references public.collections(slug) on delete set null on update cascade,
  name_pt        text        not null,
  name_en        text        not null,
  name_es        text        not null,
  display_order  integer     not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint collections_slug_not_empty check (length(slug) between 1 and 80),
  constraint collections_not_self_parent check (parent_slug is null or parent_slug <> slug)
);

create index if not exists collections_parent on public.collections(parent_slug) where parent_slug is not null;
create index if not exists collections_order on public.collections(display_order);

drop trigger if exists touch_collections on public.collections;
create trigger touch_collections
  before update on public.collections
  for each row execute function private.set_updated_at();

-- RLS: anyone reads. Direct writes disallowed; go through SECURITY DEFINER
-- functions added in 0006 once the admin allowlist exists.
alter table public.collections enable row level security;

drop policy if exists "anyone can read collections" on public.collections;
create policy "anyone can read collections"
  on public.collections for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Seed: top-level series + Lugares sub-locations.
-- Eventos sub-locations are auto-discovered by the migration script in S1.10
-- (folder structure is heterogeneous, better to normalize with real data).
-- Idempotent via ON CONFLICT DO NOTHING so re-running the migration is safe.
-- ---------------------------------------------------------------------------

insert into public.collections (slug, parent_slug, name_pt, name_en, name_es, display_order) values
  ('autoral',    null, 'Autoral',    'Personal',    'Autoral',    10),
  ('prewedding', null, 'Pre-Wedding', 'Pre-Wedding', 'Pre-Wedding', 20),
  ('eventos',    null, 'Eventos',    'Events',      'Eventos',    30),
  ('lugares',    null, 'Lugares',    'Places',      'Lugares',    40)
on conflict (slug) do nothing;

insert into public.collections (slug, parent_slug, name_pt, name_en, name_es, display_order) values
  ('lugares-cinque-terre', 'lugares', 'Cinque Terre',    'Cinque Terre',    'Cinque Terre',      10),
  ('lugares-toscana',      'lugares', 'Toscana',         'Tuscany',         'Toscana',           20),
  ('lugares-roma',         'lugares', 'Roma',            'Rome',            'Roma',              30),
  ('lugares-santos',       'lugares', 'Santos',          'Santos',          'Santos',            40),
  ('lugares-serra-negra',  'lugares', 'Serra Negra',     'Serra Negra',     'Serra Negra',       50),
  ('lugares-nova-york',    'lugares', 'Nova York',       'New York',        'Nueva York',        60),
  ('lugares-mexico',       'lugares', 'México',          'Mexico',          'México',            70),
  ('lugares-rio',          'lugares', 'Rio de Janeiro',  'Rio de Janeiro',  'Río de Janeiro',    80)
on conflict (slug) do nothing;

commit;

-- ROLLBACK (manual, only if this migration hasn't been referenced yet):
--   drop table public.collections cascade;
