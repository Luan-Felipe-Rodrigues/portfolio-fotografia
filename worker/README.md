# Likes Worker — DEPRECATED

> **2026-04-26:** the likes feature is now backed by Supabase (see [`/supabase/`](../supabase)). This Cloudflare Worker is kept only for reference — it is not deployed and `js/likes.js` no longer points at it. Safe to delete if it gets in the way.

---


Cloudflare Worker that stores anonymous like counts for the photos in a KV namespace. The frontend (`js/likes.js`) talks to this Worker.

## Deploy (one time)

```bash
cd worker
npm install -g wrangler          # if not installed
wrangler login                   # browser flow

# Create the KV namespace and copy the printed id into wrangler.toml
wrangler kv:namespace create LIKES

# Deploy the Worker
wrangler deploy
```

After deploy you'll get a URL like `https://luan-portfolio-likes.<your-subdomain>.workers.dev`. Open `js/likes.js` in the repo root and set:

```js
const API = 'https://luan-portfolio-likes.<your-subdomain>.workers.dev';
```

Commit + push the portfolio. Likes go live after GitHub Pages updates (~40s).

## Updating the Worker

```bash
cd worker
wrangler deploy
```

## API

| Method | Path                  | Response                  |
|--------|-----------------------|---------------------------|
| GET    | `/likes?ids=a,b,c`    | `{ a: 12, b: 0, c: 5 }`   |
| POST   | `/like/<id>`          | `{ id, count }` (+1)      |
| DELETE | `/like/<id>`          | `{ id, count }` (-1, ≥0)  |

`<id>` is URL-encoded. The frontend uses paths like `images/autoral/abril-2026/IMG_7287.jpg` as ids.

## Notes on abuse

There's no auth. Per-browser dedup is enforced via `localStorage` on the frontend. Anyone running curl can spam likes — fine for a portfolio. If it ever becomes a problem, add IP rate-limit in the Worker (Cloudflare provides `request.headers.get('CF-Connecting-IP')`).
