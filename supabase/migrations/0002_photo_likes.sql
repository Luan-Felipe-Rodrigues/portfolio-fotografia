-- ============================================================================
-- 0002_photo_likes
-- Anonymous like counter per photo. Reads are open via RLS, writes only happen
-- through the SECURITY DEFINER function `public.increment_like` so the anon
-- key in the frontend can't bypass clamping or set arbitrary counts.
-- ============================================================================

begin;

create table if not exists public.photo_likes (
  photo_id   text        primary key,
  count      integer     not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_photo_likes on public.photo_likes;
create trigger touch_photo_likes
  before update on public.photo_likes
  for each row execute function private.set_updated_at();

-- RLS: reads open to everyone, no direct writes.
alter table public.photo_likes enable row level security;

drop policy if exists "anyone can read photo_likes" on public.photo_likes;
create policy "anyone can read photo_likes"
  on public.photo_likes for select
  to anon, authenticated
  using (true);

-- Atomic increment / decrement. Clamps delta to ±1 (so callers can't push
-- +9999 with a forged anon request) and floors the count at 0.
create or replace function public.increment_like(p_photo_id text, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_delta integer;
  v_count integer;
begin
  if p_photo_id is null or length(p_photo_id) = 0 or length(p_photo_id) > 250 then
    raise exception 'invalid photo_id';
  end if;

  v_delta := case
    when p_delta > 0 then 1
    when p_delta < 0 then -1
    else 0
  end;

  if v_delta = 0 then
    return coalesce((select count from public.photo_likes where photo_id = p_photo_id), 0);
  end if;

  insert into public.photo_likes (photo_id, count)
  values (p_photo_id, greatest(0, v_delta))
  on conflict (photo_id) do update
    set count = greatest(0, public.photo_likes.count + v_delta)
  returning count into v_count;

  return v_count;
end;
$$;

revoke all on function public.increment_like(text, integer) from public;
grant execute on function public.increment_like(text, integer) to anon, authenticated;

commit;
