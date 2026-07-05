-- ============================================================================
-- 0009_client_portal
-- Backend do Portal do Cliente (Sprint 6). Cada cliente tem uma URL secreta
-- permanente (slug 32-char) que dá acesso a todos os seus ensaios privados
-- via Edge Function `client-portal`. Fotos privadas vivem em bucket separado
-- `client-photos` (não-público). Feedback do cliente (like, comment, print
-- select) é registrado em `client_actions`.
--
-- Read/write direto pelas anon é BLOQUEADO por RLS. Toda operação anon passa
-- pela Edge Function `client-portal` que usa service role, valida o slug,
-- e chama as tabelas. Admin (authenticated) tem acesso total pra gerenciar.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  email       text,
  phone       text,
  notes_admin text,
  archived    boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clients_slug_len check (length(slug) between 20 and 40),
  constraint clients_slug_format check (slug ~ '^[a-zA-Z0-9]+$')
);

create index if not exists clients_slug on public.clients(slug);
create index if not exists clients_active on public.clients(archived) where archived = false;

drop trigger if exists touch_clients on public.clients;
create trigger touch_clients
  before update on public.clients
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- client_ensaios (agrupam fotos privadas do cliente)
-- ---------------------------------------------------------------------------
create table if not exists public.client_ensaios (
  id            uuid        primary key default gen_random_uuid(),
  client_id     uuid        not null references public.clients(id) on delete cascade,
  title         text        not null,
  description   text,
  ensaio_date   date,
  is_paid       boolean     not null default false,
  is_delivered  boolean     not null default false,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists client_ensaios_client on public.client_ensaios(client_id, display_order);

drop trigger if exists touch_client_ensaios on public.client_ensaios;
create trigger touch_client_ensaios
  before update on public.client_ensaios
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- client_photos (bucket client-photos)
-- ---------------------------------------------------------------------------
create table if not exists public.client_photos (
  id                uuid        primary key default gen_random_uuid(),
  ensaio_id         uuid        not null references public.client_ensaios(id) on delete cascade,
  storage_path      text        not null unique,
  width             integer     not null check (width > 0),
  height            integer     not null check (height > 0),
  taken_at          date,
  display_order     integer     not null default 0,
  is_visible        boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists client_photos_ensaio on public.client_photos(ensaio_id, display_order);
create index if not exists client_photos_visible on public.client_photos(is_visible) where is_visible = true;

drop trigger if exists touch_client_photos on public.client_photos;
create trigger touch_client_photos
  before update on public.client_photos
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- client_actions (feedback do cliente)
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'client_action_kind') then
    create type public.client_action_kind as enum ('like', 'comment', 'print_select');
  end if;
end $$;

create table if not exists public.client_actions (
  id          bigserial   primary key,
  ensaio_id   uuid        not null references public.client_ensaios(id) on delete cascade,
  photo_id    uuid        references public.client_photos(id) on delete cascade,
  kind        public.client_action_kind not null,
  content     text,
  created_at  timestamptz not null default now(),
  constraint client_actions_content_len check (content is null or length(content) <= 2000)
);

create index if not exists client_actions_ensaio on public.client_actions(ensaio_id, created_at desc);
create index if not exists client_actions_photo on public.client_actions(photo_id) where photo_id is not null;
create index if not exists client_actions_kind on public.client_actions(kind);

-- ---------------------------------------------------------------------------
-- Bucket privado
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('client-photos', 'client-photos', false)
on conflict (id) do update set public = false;

-- ---------------------------------------------------------------------------
-- RLS
-- Toda tabela: enable + policies só pra authenticated (admin). Anon nunca
-- lê/escreve direto. Edge Function `client-portal` usa service role (bypassa
-- RLS) e valida o slug em código.
-- ---------------------------------------------------------------------------

alter table public.clients         enable row level security;
alter table public.client_ensaios  enable row level security;
alter table public.client_photos   enable row level security;
alter table public.client_actions  enable row level security;

drop policy if exists "admin manages clients" on public.clients;
create policy "admin manages clients"
  on public.clients for all
  to authenticated
  using (private.current_user_is_admin())
  with check (private.current_user_is_admin());

drop policy if exists "admin manages client_ensaios" on public.client_ensaios;
create policy "admin manages client_ensaios"
  on public.client_ensaios for all
  to authenticated
  using (private.current_user_is_admin())
  with check (private.current_user_is_admin());

drop policy if exists "admin manages client_photos" on public.client_photos;
create policy "admin manages client_photos"
  on public.client_photos for all
  to authenticated
  using (private.current_user_is_admin())
  with check (private.current_user_is_admin());

drop policy if exists "admin reads client_actions" on public.client_actions;
create policy "admin reads client_actions"
  on public.client_actions for select
  to authenticated
  using (private.current_user_is_admin());

-- ---------------------------------------------------------------------------
-- Storage policies para client-photos: só admin escreve/deleta. Leitura é
-- exclusivamente via signed URLs geradas pela Edge Function.
-- ---------------------------------------------------------------------------
drop policy if exists "admin writes client-photos" on storage.objects;
create policy "admin writes client-photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'client-photos' and private.current_user_is_admin());

drop policy if exists "admin updates client-photos" on storage.objects;
create policy "admin updates client-photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'client-photos' and private.current_user_is_admin())
  with check (bucket_id = 'client-photos' and private.current_user_is_admin());

drop policy if exists "admin deletes client-photos" on storage.objects;
create policy "admin deletes client-photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'client-photos' and private.current_user_is_admin());

commit;

-- ROLLBACK:
--   drop policy if exists "admin deletes client-photos" on storage.objects;
--   drop policy if exists "admin updates client-photos" on storage.objects;
--   drop policy if exists "admin writes client-photos" on storage.objects;
--   delete from storage.buckets where id = 'client-photos';
--   drop table if exists public.client_actions;
--   drop table if exists public.client_photos;
--   drop table if exists public.client_ensaios;
--   drop table if exists public.clients;
--   drop type if exists public.client_action_kind;
