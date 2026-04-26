/**
 * Cloudflare Worker — anonymous photo likes for luanrodrigues.photography
 *
 * Routes:
 *   GET    /likes?ids=a,b,c  -> { a: 12, b: 0, c: 5 }
 *   POST   /like/:id         -> { id, count }   (increments)
 *   DELETE /like/:id         -> { id, count }   (decrements, floors at 0)
 *
 * Storage: KV namespace bound as `LIKES`. Key = sanitized photo id, value = string integer.
 * No authentication. Per-browser dedup is the frontend's job (localStorage).
 */

const ALLOWED_ORIGINS = [
  'https://luanrodrigues.photography',
  'https://luan-felipe-rodrigues.github.io',
  'http://localhost:8000',
  'http://localhost:8080',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:8080',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(corsOrigin) });
    }

    try {
      if (request.method === 'GET' && url.pathname === '/likes') {
        const idsParam = url.searchParams.get('ids') || '';
        const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200);
        const counts = {};
        await Promise.all(ids.map(async id => {
          const v = await env.LIKES.get(safeKey(id));
          counts[id] = parseInt(v || '0', 10);
        }));
        return jsonResponse(counts, corsOrigin);
      }

      const likeMatch = url.pathname.match(/^\/like\/(.+)$/);
      if (likeMatch && (request.method === 'POST' || request.method === 'DELETE')) {
        const id = decodeURIComponent(likeMatch[1]);
        if (!id || id.length > 250) {
          return new Response('Bad request', { status: 400, headers: corsHeaders(corsOrigin) });
        }
        const key = safeKey(id);
        const current = parseInt((await env.LIKES.get(key)) || '0', 10);
        const next = request.method === 'POST' ? current + 1 : Math.max(0, current - 1);
        await env.LIKES.put(key, String(next));
        return jsonResponse({ id, count: next }, corsOrigin);
      }

      return new Response('Not found', { status: 404, headers: corsHeaders(corsOrigin) });
    } catch (e) {
      return new Response('Error: ' + (e && e.message ? e.message : 'unknown'), {
        status: 500,
        headers: corsHeaders(corsOrigin),
      });
    }
  },
};

function safeKey(id) {
  return id.toLowerCase().replace(/[^a-z0-9._/-]/g, '_').slice(0, 250);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, origin) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}
