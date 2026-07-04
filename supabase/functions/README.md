# Supabase Edge Functions

Deno-based serverless functions that run inside the Supabase project.

## Prerequisites

Install the Supabase CLI once:

```bash
brew install supabase/tap/supabase
```

Then link this repo to the project (only needed once per machine):

```bash
supabase link --project-ref junfgutjyicdrvpoyuzz
```

You'll be prompted for the database password (see Credenciais.md in the Bunker).

## Deploy `ingest`

The `ingest` function receives analytics beacons from the public site.

```bash
supabase functions deploy ingest --no-verify-jwt
```

`--no-verify-jwt` is required because the site sends beacons anonymously; the
Edge Function decides internally who is trusted.

After deploy, the URL is:

```
https://junfgutjyicdrvpoyuzz.supabase.co/functions/v1/ingest
```

## Testing

```bash
# smoke: pageview
curl -X POST -H 'content-type: application/json' \
  -d '{"type":"pageview","session_id":"test1234567890","path":"/","locale":"pt"}' \
  https://junfgutjyicdrvpoyuzz.supabase.co/functions/v1/ingest

# rate limit check: same body 40 times
for i in $(seq 1 40); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' \
    -d '{"type":"pageview","session_id":"test1234567890","path":"/"}' \
    https://junfgutjyicdrvpoyuzz.supabase.co/functions/v1/ingest
done
# expected: first 30 → 200, rest → 429
```

Then check the DB:

```sql
select * from public.sessions order by first_seen desc limit 5;
select * from public.page_views order by created_at desc limit 10;
```

## Convention

New Edge Functions live under `supabase/functions/<name>/index.ts`. Keep them
small and self-contained. Anything that reuses tables should follow the
existing RLS (service role from the function, no anon RPC surface).
