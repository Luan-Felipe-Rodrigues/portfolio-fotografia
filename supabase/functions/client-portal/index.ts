// Supabase Edge Function: client-portal
// Endpoint único que serve o Portal do Cliente. Anon chama via publishable
// key (só CORS restrito à origem do site); função valida slug em código e
// usa service role pra ler/escrever nas tabelas RLS-protegidas.
//
// Body do POST:
//   { type: 'load' | 'action', slug: string, ... }
//
// type='load':
//   Retorna { client_name, ensaios: [{ id, title, description, ensaio_date,
//   is_paid, is_delivered, photos: [{ id, width, height, display_order,
//   signed_url, likes, has_comment, print_selected }] }] }
//
// type='action':
//   Body: { type:'action', slug, ensaio_id, photo_id, kind:'like'|'comment'|
//   'print_select', content? }
//   Retorna { id }
//
// Deploy:
//   supabase functions deploy client-portal --no-verify-jwt

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const SIGNED_URL_TTL = 3600; // 1h
const SLUG_RE = /^[a-zA-Z0-9]{20,40}$/;

// Rate limit em memória (por instância). Suficiente pra prevenir enumeração
// de slugs por brute force. Slug de 32 chars alfa-num = ~10^57 combinações,
// então isso é defesa em profundidade.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const prior = hits.get(key) || [];
  const recent = prior.filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' }
  });
}

async function handleLoad(slug: string) {
  // 1. Validate slug + fetch client
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('slug', slug)
    .eq('archived', false)
    .maybeSingle();
  if (clientErr) {
    console.error('clients query:', clientErr.message);
    return json({ error: 'server error' }, 500);
  }
  if (!client) return json({ error: 'not found' }, 404);

  // 2. Fetch ensaios + photos + counts
  const { data: ensaios, error: ensErr } = await supabase
    .from('client_ensaios')
    .select(`
      id, title, description, ensaio_date, is_paid, is_delivered, display_order,
      photos:client_photos(id, storage_path, width, height, display_order)
    `)
    .eq('client_id', client.id)
    .order('display_order');
  if (ensErr) {
    console.error('ensaios query:', ensErr.message);
    return json({ error: 'server error' }, 500);
  }

  // 3. Fetch aggregated actions for each ensaio
  const ensaioIds = (ensaios || []).map((e: any) => e.id);
  const { data: actions } = ensaioIds.length
    ? await supabase
        .from('client_actions')
        .select('ensaio_id, photo_id, kind, content')
        .in('ensaio_id', ensaioIds)
    : { data: [] as any[] };

  const likesByPhoto = new Map<string, number>();
  const commentByPhoto = new Map<string, boolean>();
  const printByPhoto = new Map<string, boolean>();
  for (const a of actions || []) {
    if (!a.photo_id) continue;
    if (a.kind === 'like') likesByPhoto.set(a.photo_id, (likesByPhoto.get(a.photo_id) || 0) + 1);
    else if (a.kind === 'comment') commentByPhoto.set(a.photo_id, true);
    else if (a.kind === 'print_select') printByPhoto.set(a.photo_id, true);
  }

  // 4. Sign URLs for all photos in one batch per ensaio
  const enrichedEnsaios = [];
  for (const e of ensaios || []) {
    const photos = e.photos || [];
    const paths = photos.map((p: any) => p.storage_path);
    let signedByPath: Record<string, string> = {};
    if (paths.length) {
      const { data: signed, error: signErr } = await supabase.storage
        .from('client-photos')
        .createSignedUrls(paths, SIGNED_URL_TTL);
      if (signErr) {
        console.error('sign URLs:', signErr.message);
      } else {
        for (const s of signed || []) {
          if (s.path && s.signedUrl) signedByPath[s.path] = s.signedUrl;
        }
      }
    }
    enrichedEnsaios.push({
      id: e.id,
      title: e.title,
      description: e.description,
      ensaio_date: e.ensaio_date,
      is_paid: e.is_paid,
      is_delivered: e.is_delivered,
      display_order: e.display_order,
      photos: photos
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((p: any) => ({
          id: p.id,
          width: p.width,
          height: p.height,
          display_order: p.display_order,
          signed_url: signedByPath[p.storage_path] || null,
          likes: likesByPhoto.get(p.id) || 0,
          has_comment: !!commentByPhoto.get(p.id),
          print_selected: !!printByPhoto.get(p.id)
        }))
    });
  }

  return json({
    client_name: client.name,
    ensaios: enrichedEnsaios
  });
}

async function handleAction(body: any) {
  const { slug, ensaio_id, photo_id, kind, content } = body;

  if (!kind || !['like', 'comment', 'print_select'].includes(kind)) {
    return json({ error: 'bad kind' }, 400);
  }
  if (!ensaio_id || typeof ensaio_id !== 'string') return json({ error: 'bad ensaio_id' }, 400);

  // Validate slug → client
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .eq('archived', false)
    .maybeSingle();
  if (!client) return json({ error: 'not found' }, 404);

  // Validate ensaio belongs to client
  const { data: ensaio } = await supabase
    .from('client_ensaios')
    .select('id')
    .eq('id', ensaio_id)
    .eq('client_id', client.id)
    .maybeSingle();
  if (!ensaio) return json({ error: 'ensaio not linked' }, 403);

  // Validate photo (if provided) belongs to ensaio
  if (photo_id) {
    const { data: photo } = await supabase
      .from('client_photos')
      .select('id')
      .eq('id', photo_id)
      .eq('ensaio_id', ensaio_id)
      .maybeSingle();
    if (!photo) return json({ error: 'photo not linked' }, 403);
  }

  const trimmedContent = kind === 'comment' && typeof content === 'string'
    ? content.trim().slice(0, 2000)
    : null;

  const { data: inserted, error: insErr } = await supabase
    .from('client_actions')
    .insert({
      ensaio_id,
      photo_id: photo_id || null,
      kind,
      content: trimmedContent
    })
    .select('id')
    .single();
  if (insErr) {
    console.error('action insert:', insErr.message);
    return json({ error: 'server error' }, 500);
  }

  return json({ id: inserted.id });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const { type, slug } = body;
  if (!slug || typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return json({ error: 'bad slug' }, 400);
  }
  if (type !== 'load' && type !== 'action') {
    return json({ error: 'bad type' }, 400);
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (isRateLimited(`${ip}:${type}`)) {
    return json({ error: 'rate limited' }, 429);
  }

  return type === 'load' ? await handleLoad(slug) : await handleAction(body);
});
