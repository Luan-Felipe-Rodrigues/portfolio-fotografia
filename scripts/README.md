# Scripts

One-off migration and maintenance scripts. **Not** shipped to GitHub Pages.

## Setup (once)

```bash
cd scripts
npm install
```

Node 18+ required.

## Environment variables

Both are required. Never commit them.

```bash
export SUPABASE_URL="https://junfgutjyicdrvpoyuzz.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."   # from Project Settings → API
```

The service_role key bypasses RLS. Use it only in this script from your local
machine. After the migration, rotate it in the Supabase Dashboard.

## migrate-photos.js

Walks `../images/` and populates Supabase Storage (bucket `photos`) and the
`public.photos` table with metadata. Follows the decisions in the Spec:

- D18 path structure: `<collection_slug>/<taken_at_year>/<uuid>.<ext>`
- D6 `taken_at` fallback: EXIF `DateTimeOriginal` → folder name parse → null
- D21/D22 sub-collection axes: autoral temporal, lugares geographic, prewedding
  and eventos flat
- D23 visual order: parsed from PT canonical HTML files

### Dry run first

```bash
npm run migrate:dry
```

Prints the plan (which files go where, what dates are inferred, what
sub-collections need creating) without touching Supabase. Review the report
before running the real thing.

### Real run

```bash
npm run migrate
```

Idempotent by `storage_path`: safe to re-run. Storage uploads use
`upsert: false`, so if the object exists the script logs and moves on.

### Options

- `--dry-run`: no writes, just plan and report
- `--verbose`: print per-file processing
- `--limit=N`: process only the first N photos (useful to smoke test)

### Final report

At the end you get:

```
Fotos processadas: N
Por coleção:
  autoral: X
  lugares: Y (roma: A, toscana: B, ...)
  ...
Por fonte de taken_at:
  EXIF: M
  Pasta: P
  null: Q
Marcadas home_featured: H
Erros: E
```

Validate: 10 random samples of taken_at against the actual photo dates you
know. If EXIF percentage is low (<50%) something is wrong.

## Rotating the service_role key

After the migration, in the Dashboard rotate the key. Any local shell that
had it in env dies with the terminal session, so no leak persists.
