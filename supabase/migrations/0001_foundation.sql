-- ============================================================================
-- 0001_foundation
-- Sets up the base conventions used by every later migration:
--   * `private` schema for internal helpers / sensitive data
--   * shared updated_at trigger function
-- Apply this BEFORE any feature migration.
-- ============================================================================

begin;

-- Internal schema. Anything in here is invisible to PostgREST (the REST API
-- only exposes `public` by default), so it's where we keep helpers, audit
-- tables, rate-limit counters, etc. New "internal-only" stuff goes here.
create schema if not exists private;

-- Standard updated_at trigger. Every table that has an updated_at column
-- should attach this trigger via:
--
--   create trigger touch_<table>
--     before update on public.<table>
--     for each row execute function private.set_updated_at();
--
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

commit;
