-- ============================================================================
-- 0008_analytics
-- Own-your-data analytics for the public site. Tables land here; the Edge
-- Function `ingest` (added later in S2.2) writes to them with the service
-- role, so no anon-facing RPCs are exposed. Admin reads for the dashboard
-- go through the `authenticated` role, which is already allowlist-gated by
-- 0005.
--
-- Design:
--   sessions      one row per browser session (sessionStorage-backed UUID).
--                 Country + UA family + device type are enriched by the
--                 Edge Function on the first request.
--   page_views    one row per pageview beacon.
--   photo_views   one row per lightbox open (or grid focus, per source).
--
-- No cookies, no PII, no client fingerprinting beyond the session_id.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  session_id  text        primary key,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  is_bot      boolean     not null default false,
  country     text,
  ua_family   text,
  device_type text,
  constraint sessions_session_id_len check (length(session_id) between 8 and 100)
);

create index if not exists sessions_first_seen on public.sessions(first_seen desc);
create index if not exists sessions_country on public.sessions(country) where country is not null;

-- ---------------------------------------------------------------------------
-- page_views
-- ---------------------------------------------------------------------------
create table if not exists public.page_views (
  id          bigserial   primary key,
  session_id  text        not null references public.sessions(session_id) on delete cascade,
  path        text        not null,
  locale      text,
  referrer    text,
  duration_ms integer,
  created_at  timestamptz not null default now()
);

create index if not exists page_views_created_at on public.page_views(created_at desc);
create index if not exists page_views_session on public.page_views(session_id);
create index if not exists page_views_path on public.page_views(path);

-- ---------------------------------------------------------------------------
-- photo_views
-- ---------------------------------------------------------------------------
create table if not exists public.photo_views (
  id          bigserial   primary key,
  session_id  text        not null references public.sessions(session_id) on delete cascade,
  photo_id    uuid        not null references public.photos(id) on delete cascade,
  source      text        not null default 'lightbox',
  duration_ms integer,
  created_at  timestamptz not null default now(),
  constraint photo_views_source_valid check (source in ('lightbox', 'grid', 'unknown'))
);

create index if not exists photo_views_created_at on public.photo_views(created_at desc);
create index if not exists photo_views_photo on public.photo_views(photo_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: no anon access at all. Writes come from the Edge Function via the
-- service role (bypasses RLS). Reads only for the admin (authenticated) as
-- gated by the allowlist in 0005.
-- ---------------------------------------------------------------------------

alter table public.sessions    enable row level security;
alter table public.page_views  enable row level security;
alter table public.photo_views enable row level security;

drop policy if exists "authenticated reads sessions" on public.sessions;
create policy "authenticated reads sessions"
  on public.sessions for select
  to authenticated
  using (true);

drop policy if exists "authenticated reads page_views" on public.page_views;
create policy "authenticated reads page_views"
  on public.page_views for select
  to authenticated
  using (true);

drop policy if exists "authenticated reads photo_views" on public.photo_views;
create policy "authenticated reads photo_views"
  on public.photo_views for select
  to authenticated
  using (true);

commit;

-- ROLLBACK:
--   drop table if exists public.photo_views;
--   drop table if exists public.page_views;
--   drop table if exists public.sessions;
