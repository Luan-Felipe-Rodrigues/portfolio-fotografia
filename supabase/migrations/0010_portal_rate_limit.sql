-- Portal do Cliente — rate limit persistente
--
-- Move o rate limit em memória (Map<key, timestamps> no client-portal Edge
-- Function) para uma tabela. Sobrevive cold starts do Deno e é auditável.
-- Uma linha por hit, key = "<ip>:<type>". Janela de 60s, 20 hits max.

create table if not exists public.portal_rate_hits (
  id bigserial primary key,
  key text not null,
  created_at timestamptz not null default now()
);

-- Index tuned pra query "count where key = ? and created_at > now() - 1m"
create index if not exists portal_rate_hits_key_ts_idx
  on public.portal_rate_hits (key, created_at desc);

-- RLS: só service_role escreve/lê. Anon não toca.
alter table public.portal_rate_hits enable row level security;

-- RPC atômico: insere hit + retorna contagem na janela. Uma única roundtrip
-- do Edge Function. Retorna true se dentro do limite, false se estourou.
create or replace function public.portal_rate_check(
  p_key text,
  p_window_seconds int default 60,
  p_max_hits int default 20
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.portal_rate_hits (key) values (p_key);
  select count(*) into v_count
  from public.portal_rate_hits
  where key = p_key
    and created_at > now() - make_interval(secs => p_window_seconds);
  return v_count <= p_max_hits;
end
$$;

revoke all on function public.portal_rate_check(text, int, int) from public, anon, authenticated;
grant execute on function public.portal_rate_check(text, int, int) to service_role;

-- Prune housekeeping: mata hits > 10 min. Chamado oportunisticamente pelo
-- Edge Function (1% dos requests) pra evitar cron job e manter tabela enxuta.
create or replace function public.portal_rate_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.portal_rate_hits where created_at < now() - interval '10 minutes';
$$;

revoke all on function public.portal_rate_prune() from public, anon, authenticated;
grant execute on function public.portal_rate_prune() to service_role;
