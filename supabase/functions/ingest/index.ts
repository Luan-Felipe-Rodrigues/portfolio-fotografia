// Supabase Edge Function: ingest
// Receives analytics beacons from the public site and writes to
// public.sessions / page_views / photo_views using the service role.
//
// Deploy:
//   supabase functions deploy ingest --no-verify-jwt
// Env (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
//
// Contract with the frontend (js/analytics.js):
//   POST /functions/v1/ingest
//   Body: {
//     type: 'pageview' | 'photo_view',
//     session_id: string,
//     path?: string,
//     locale?: 'pt' | 'en' | 'es',
//     referrer?: string,
//     duration_ms?: number,
//     photo_id?: uuid,  // for photo_view
//     source?: 'lightbox' | 'grid'
//   }
//   Response: 200 ok | 400 bad_request | 429 rate_limited | 500 error
//
// No auth required (--no-verify-jwt). Bots (by UA) are recorded in
// sessions with is_bot=true but no events are logged.

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

// In-memory rate limit per (session_id + endpoint) with a rolling 60s window.
// Instance-local; Supabase Edge Functions run multiple isolates but for
// analytics we're OK with best-effort rate limiting.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const prior = hits.get(key) || [];
  const recent = prior.filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // crude memory cap
  return recent.length > RATE_MAX;
}

async function geoLookup(ip: string): Promise<string | null> {
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) return null;
    const t = (await res.text()).trim();
    return /^[A-Z]{2}$/.test(t) ? t : null;
  } catch {
    return null;
  }
}

function classifyUA(ua: string): { family: string; device: string; isBot: boolean } {
  const isBot = /bot|crawler|spider|scraper|preview|lighthouse|pingdom|uptimerobot/i.test(ua);
  let family = 'Other';
  if (/Firefox\//.test(ua)) family = 'Firefox';
  else if (/Edg\//.test(ua)) family = 'Edge';
  else if (/Chrome\//.test(ua)) family = 'Chrome';
  else if (/Safari\//.test(ua)) family = 'Safari';
  const device = /iPhone|Android.*Mobile/i.test(ua) ? 'mobile'
    : /iPad|Tablet/i.test(ua) ? 'tablet'
    : 'desktop';
  return { family, device, isBot };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: CORS });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400, headers: CORS });
  }

  const { type, session_id, path, locale, referrer, photo_id, source, duration_ms } = body;
  if (!session_id || typeof session_id !== 'string' || session_id.length < 8 || session_id.length > 100) {
    return new Response('bad session_id', { status: 400, headers: CORS });
  }
  if (type !== 'pageview' && type !== 'photo_view') {
    return new Response('bad type', { status: 400, headers: CORS });
  }

  const rateKey = `${session_id}:${type}:${path || photo_id || 'x'}`;
  if (isRateLimited(rateKey)) return new Response('rate limited', { status: 429, headers: CORS });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ua = req.headers.get('user-agent') || '';
  const uaInfo = classifyUA(ua);

  const country = ip ? await geoLookup(ip) : null;

  const { error: sessErr } = await supabase.from('sessions').upsert({
    session_id,
    last_seen: new Date().toISOString(),
    country,
    ua_family: uaInfo.family,
    device_type: uaInfo.device,
    is_bot: uaInfo.isBot
  }, { onConflict: 'session_id' });

  if (sessErr) {
    console.error('sessions upsert:', sessErr.message);
    return new Response('error', { status: 500, headers: CORS });
  }

  // Bots get a session row but no events (keeps the counts clean).
  if (uaInfo.isBot) return new Response('ok (bot)', { headers: CORS });

  if (type === 'pageview') {
    const { error } = await supabase.from('page_views').insert({
      session_id,
      path: (path || '/').slice(0, 500),
      locale: locale || null,
      referrer: referrer ? String(referrer).slice(0, 500) : null,
      duration_ms: typeof duration_ms === 'number' ? Math.max(0, Math.min(3_600_000, duration_ms)) : null
    });
    if (error) {
      console.error('page_views insert:', error.message);
      return new Response('error', { status: 500, headers: CORS });
    }
  } else if (type === 'photo_view') {
    if (!photo_id || !/^[0-9a-f-]{36}$/i.test(photo_id)) {
      return new Response('bad photo_id', { status: 400, headers: CORS });
    }
    const { error } = await supabase.from('photo_views').insert({
      session_id,
      photo_id,
      source: source === 'grid' ? 'grid' : 'lightbox',
      duration_ms: typeof duration_ms === 'number' ? Math.max(0, Math.min(3_600_000, duration_ms)) : null
    });
    if (error) {
      console.error('photo_views insert:', error.message);
      return new Response('error', { status: 500, headers: CORS });
    }
  }

  return new Response('ok', { headers: CORS });
});
