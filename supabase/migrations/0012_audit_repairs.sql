begin;
alter table public.page_views add column if not exists event_id uuid;
alter table public.page_views add column if not exists utm_source text;
alter table public.page_views add column if not exists utm_medium text;
alter table public.page_views add column if not exists utm_campaign text;
create unique index if not exists page_views_event_unique on public.page_views(event_id);

create or replace function public.record_page_view(p_event_id uuid,p_session_id text,p_path text,p_locale text,p_referrer text,p_duration_ms integer default null,p_utm_source text default null,p_utm_medium text default null,p_utm_campaign text default null)
returns void language sql security definer set search_path = '' as $$
 insert into public.page_views(event_id,session_id,path,locale,referrer,duration_ms,utm_source,utm_medium,utm_campaign)
 values(p_event_id,p_session_id,left(p_path,500),p_locale,left(p_referrer,500),p_duration_ms,left(p_utm_source,120),left(p_utm_medium,120),left(p_utm_campaign,120))
 on conflict(event_id) do update set duration_ms=greatest(public.page_views.duration_ms,excluded.duration_ms)
 where public.page_views.session_id=excluded.session_id;
$$;
revoke all on function public.record_page_view(uuid,text,text,text,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.record_page_view(uuid,text,text,text,text,integer,text,text,text) to service_role;

-- Existing policy was merely authenticated, despite its admin-only comment.
drop policy if exists "authenticated reads sessions" on public.sessions;
drop policy if exists "authenticated reads page_views" on public.page_views;
drop policy if exists "authenticated reads photo_views" on public.photo_views;
create policy "admin reads sessions" on public.sessions for select to authenticated using(private.current_user_is_admin());
create policy "admin reads page_views" on public.page_views for select to authenticated using(private.current_user_is_admin());
create policy "admin reads photo_views" on public.photo_views for select to authenticated using(private.current_user_is_admin());

alter table public.quote_requests add column if not exists request_id uuid;
create unique index if not exists quote_requests_request_unique on public.quote_requests(request_id);
alter table public.quote_requests add column if not exists email_status text not null default 'not_configured';
alter table public.quote_requests add column if not exists email_error text;
alter table public.quote_requests add column if not exists email_sent_at timestamptz;
-- NOT VALID preserves historical requests, while enforcing the rule on new writes.
alter table public.quote_requests add constraint quote_duration_valid check(duration_hours is null or (duration_hours between 0.5 and 24 and mod(duration_hours*2,1)=0)) not valid;
commit;
