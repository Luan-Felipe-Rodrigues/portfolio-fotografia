# Supabase — luanrodrigues.photography

Database backing for features that need persistence (likes today; comments, contact submissions, view metrics later).

## Bootstrap (one time)

1. Create a Supabase project (region `sa-east-1` — São Paulo).
2. In **SQL Editor**, open and run each file from [`migrations/`](./migrations) **in order**:
   - `0001_foundation.sql`
   - `0002_photo_likes.sql`
   - … new migrations as they're added.
3. Copy **Project URL** and **anon public key** from *Project Settings → API* and paste them into `js/likes.js`.

You can paste a migration straight into the SQL editor. Each file is wrapped in a `begin / commit` so a failed migration rolls back cleanly.

## Conventions

These rules apply to every migration. They exist so that adding a new feature (say, `photo_comments`) is mechanical, not a design exercise.

### Schemas

| Schema    | Purpose                                                                             |
|-----------|-------------------------------------------------------------------------------------|
| `public`  | Surface exposed via PostgREST. Tables here are reachable by the anon key, so they must have RLS. RPC functions here are callable from the browser. |
| `private` | Internal helpers, audit trails, rate-limit counters. Never reachable from the API.  |

Default: new helpers and sensitive tables go in `private`. Only put something in `public` when it's intentionally part of the API.

### Standard columns

Every table gets:

```sql
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

…and a trigger:

```sql
create trigger touch_<table>
  before update on public.<table>
  for each row execute function private.set_updated_at();
```

### RLS-first

- Enable RLS on every public-schema table (`alter table … enable row level security`).
- Default deny. Add explicit policies for reads.
- **Anon never writes to tables directly.** All writes go through `security definer` functions that validate and clamp inputs.

### Writes through SECURITY DEFINER functions

For any user-driven write, expose a function instead of granting INSERT/UPDATE on the table:

```sql
create or replace function public.do_thing(p_arg text)
returns <type>
language plpgsql
security definer
set search_path = public, private
as $$
  -- validate input
  -- clamp / sanitize
  -- perform the write
$$;

revoke all on function public.do_thing(text) from public;
grant execute on function public.do_thing(text) to anon, authenticated;
```

Why: the anon key is *in the frontend bundle*. Anyone can call the API directly with curl. If you grant raw INSERT to anon, they can write whatever they want. Functions are the only safe place to enforce business rules.

### Naming

| Thing            | Convention                  | Example                     |
|------------------|-----------------------------|-----------------------------|
| Tables           | snake_case, plural          | `photo_likes`, `photo_visits` |
| Functions        | snake_case, verb_noun       | `increment_like`            |
| Triggers         | `touch_<table>`             | `touch_photo_likes`         |
| Foreign keys     | `<entity>_id`               | `photo_id`                  |
| Policies         | quoted, plain English        | `"anyone can read photo_likes"` |

### Idempotency

Migrations should be safe to re-run if they only contain `create … if not exists`, `create or replace …`, `drop … if exists` patterns. Wrap each migration in a `begin / commit` so a failure rolls everything back.

### Indexes

Postgres does **not** auto-index foreign keys. When you add a FK and expect to query by it, add an explicit index in the same migration.

### Secrets

- **anon key** — fine to ship in the frontend. RLS + functions are what keep you safe.
- **service_role key** — *never* commit, *never* ship to the browser. Keep it in `.env` files outside the repo or use Supabase Edge Functions to access it server-side.

## Adding a new feature — checklist

When you add a new table (`photo_comments`, `contact_submissions`, …):

1. Create a new file `migrations/NNNN_<feature>.sql`, numbered after the latest.
2. Wrap in `begin / commit`.
3. Define the table with standard columns + a CHECK constraint where it makes sense.
4. Add the `touch_<table>` trigger.
5. Enable RLS, add explicit read policies.
6. If users write to it, add a SECURITY DEFINER function and grant EXECUTE to anon/authenticated.
7. Add indexes for any FK or hot query path.
8. Apply via the Supabase SQL Editor.
9. Update the frontend to use the new endpoint.
10. Append a row to the migration table below.

## Migration ledger

| #     | File                                  | Adds                                     |
|-------|---------------------------------------|------------------------------------------|
| 0001  | `0001_foundation.sql`                 | `private` schema, `set_updated_at()`     |
| 0002  | `0002_photo_likes.sql`                | `photo_likes` table, `increment_like()`  |

## Backup

Supabase free tier keeps automated daily backups for 7 days. Pro tier increases retention. For luanrodrigues.photography, the data here is non-critical (like counts) so the free tier window is plenty. If we add anything irreplaceable (e.g. user submissions worth keeping), revisit retention.

## Roadmap (sketches, not commitments)

- `photo_comments` — text comments per photo, anon, moderated by a flag column.
- `photo_visits` — daily aggregates of lightbox opens (no IPs stored, just counts).
- `contact_submissions` — replace the mailto contact with a form.
- `newsletter_subscribers` — opt-in email list with consent flag.

Each follows the same pattern: public table + RLS read + SECURITY DEFINER write fn.
