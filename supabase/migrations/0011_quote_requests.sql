-- Sprint 4: Cotação
--
-- Wizard modal multi-step (D12 revisada 2026-07-05) dispara insert em
-- `quote_requests`. Admin gerencia via `/admin/quotes.html`. Rate limit
-- reusa `portal_rate_hits` da migração 0010 (mesmo pool de rate limit
-- para todo endpoint anon do site (coerente).

create type public.quote_status as enum (
  'nova',
  'vista',
  'respondida',
  'ganha',
  'perdida'
);

create type public.quote_ensaio_type as enum (
  'prewedding',
  'autoral',
  'eventos',
  'lugares',
  'outros'
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  status public.quote_status not null default 'nova',

  -- Contato (S4 do wizard)
  contact_name text not null,
  contact_email text not null,
  contact_whatsapp text,

  -- S1: tipo de ensaio
  ensaio_type public.quote_ensaio_type not null,

  -- S2: quando/onde/quanto
  preferred_date date,
  date_flexible boolean not null default false,
  location text,
  duration_hours numeric(4,1),

  -- S3: estilo/referências
  styles text[],           -- badges selecionados
  reference_notes text,    -- URLs / descrição livre

  -- Livre
  extra_notes text,

  -- LGPD (consentimento explícito é bloqueio no wizard)
  consent_given boolean not null default false,

  -- Meta
  ip_address text,
  user_agent text,
  wizard_language text not null default 'pt',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint quote_email_shape check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint quote_lgpd_given check (consent_given = true)
);

create index quote_requests_status_created_idx on public.quote_requests (status, created_at desc);
create index quote_requests_created_idx on public.quote_requests (created_at desc);

-- Anotações internas do admin (histórico visível só no /admin)
create table public.quote_request_notes (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote_requests(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index quote_request_notes_quote_idx on public.quote_request_notes (quote_id, created_at desc);

-- Trigger de updated_at
create or replace function public.tg_quote_touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger quote_requests_touch
  before update on public.quote_requests
  for each row execute function public.tg_quote_touch_updated();

-- RLS: só service_role escreve/lê. Anon nunca toca as tabelas; toda escrita
-- passa pela Edge Function submit-quote-request (service_role).
alter table public.quote_requests enable row level security;
alter table public.quote_request_notes enable row level security;

-- Admin autenticado lê e atualiza (para mudar status + anotações). O admin
-- allowlist já filtra quem é autenticado no site (0005_admin_allowlist_and_writes).
create policy "admin reads quotes" on public.quote_requests
  for select to authenticated
  using (private.current_user_is_admin());

create policy "admin updates quotes" on public.quote_requests
  for update to authenticated
  using (private.current_user_is_admin());

create policy "admin reads quote notes" on public.quote_request_notes
  for select to authenticated
  using (private.current_user_is_admin());

create policy "admin inserts quote notes" on public.quote_request_notes
  for insert to authenticated
  with check (private.current_user_is_admin());

create policy "admin deletes quote notes" on public.quote_request_notes
  for delete to authenticated
  using (private.current_user_is_admin());
