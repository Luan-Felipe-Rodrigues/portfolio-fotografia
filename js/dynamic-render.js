/*
 * dynamic-render.js
 *
 * Public site rendering layer that consumes Supabase. Activated by:
 *   - URL flag: `?dynamic=1` (during rollout, S1.17)
 *   - Global switch: LR_DYNAMIC_DEFAULT = true (post-switchover, S1.18)
 *
 * Contract: exposes window.LR_DYNAMIC with:
 *   - isEnabled()
 *   - imageUrl(storagePath, opts)
 *   - altFor(photo, locale)
 *   - fetchHomePhotos()
 *   - fetchAllPublished()
 *   - fetchByCollectionSlug(slug)
 *   - fetchByParentSlug(parent) → { collection, photos }[]
 *   - locale() → 'pt' | 'en' | 'es'
 *   - onReady(cb) → runs cb when Supabase client is ready
 */
(function () {
  if (window.LR_DYNAMIC) return;

  // ------ Config ------
  const DEFAULT_DYNAMIC = false; // flipped to true in S1.18 switchover

  // ------ Helpers ------
  function locale() {
    const path = window.location.pathname;
    if (path.startsWith('/en/')) return 'en';
    if (path.startsWith('/es/')) return 'es';
    return 'pt';
  }

  function isEnabled() {
    try {
      const flag = new URLSearchParams(window.location.search).get('dynamic');
      if (flag === '1' || flag === 'true') return true;
      if (flag === '0' || flag === 'false') return false;
    } catch { /* noop */ }
    return DEFAULT_DYNAMIC;
  }

  function imageUrl(storagePath, opts) {
    if (!storagePath) return '';
    const base = window.LR_STORAGE_RENDER;
    const params = new URLSearchParams();
    if (opts?.width) params.set('width', String(opts.width));
    if (opts?.quality) params.set('quality', String(opts.quality));
    const qs = params.toString();
    return `${base}/${storagePath}${qs ? '?' + qs : ''}`;
  }

  function altFor(photo, loc) {
    const l = loc || locale();
    if (l === 'en') return photo.alt_en || photo.alt_pt || '';
    if (l === 'es') return photo.alt_es || photo.alt_pt || '';
    return photo.alt_pt || '';
  }

  function onReady(cb) {
    if (window.LR_SUPABASE) return cb();
    document.addEventListener('lr:supabase-ready', () => cb(), { once: true });
  }

  // ------ Queries ------
  async function fetchAllPublished() {
    const sb = window.LR_SUPABASE;
    if (!sb) throw new Error('Supabase client not ready');
    const { data, error } = await sb
      .from('photos')
      .select('id, storage_path, width, height, alt_pt, alt_en, alt_es, display_order, is_home_featured, taken_at, collection:collections(id, slug, parent_slug, name_pt, name_en, name_es, display_order)')
      .eq('is_published', true)
      .eq('is_archived', false)
      .order('display_order');
    if (error) throw error;
    return data;
  }

  async function fetchHomePhotos() {
    const sb = window.LR_SUPABASE;
    if (!sb) throw new Error('Supabase client not ready');
    const { data, error } = await sb
      .from('photos')
      .select('id, storage_path, width, height, alt_pt, alt_en, alt_es, collection:collections(slug, parent_slug)')
      .eq('is_home_featured', true)
      .eq('is_published', true)
      .eq('is_archived', false);
    if (error) throw error;
    return data;
  }

  /** Fetch all photos of a collection identified by its slug. */
  async function fetchByCollectionSlug(slug) {
    const sb = window.LR_SUPABASE;
    if (!sb) throw new Error('Supabase client not ready');
    // Resolve collection id first
    const { data: col, error: colErr } = await sb
      .from('collections')
      .select('id, slug, name_pt, name_en, name_es')
      .eq('slug', slug)
      .maybeSingle();
    if (colErr) throw colErr;
    if (!col) return { collection: null, photos: [] };
    const { data: photos, error: photoErr } = await sb
      .from('photos')
      .select('id, storage_path, width, height, alt_pt, alt_en, alt_es, display_order, taken_at')
      .eq('collection_id', col.id)
      .eq('is_published', true)
      .eq('is_archived', false)
      .order('display_order');
    if (photoErr) throw photoErr;
    return { collection: col, photos };
  }

  /** Fetch all sub-collections of a parent (e.g. lugares), returning
   *  each with its photos, in display_order. */
  async function fetchByParentSlug(parentSlug) {
    const sb = window.LR_SUPABASE;
    if (!sb) throw new Error('Supabase client not ready');
    const { data: subs, error: subErr } = await sb
      .from('collections')
      .select('id, slug, name_pt, name_en, name_es, display_order')
      .eq('parent_slug', parentSlug)
      .order('display_order');
    if (subErr) throw subErr;
    if (!subs.length) return [];

    // Also include the parent's OWN photos (photos directly linked to the
    // parent collection). Useful when the parent is used as a flat pool
    // alongside sub-collections.
    const { data: parent, error: parentErr } = await sb
      .from('collections')
      .select('id, slug, name_pt, name_en, name_es')
      .eq('slug', parentSlug)
      .maybeSingle();
    if (parentErr) throw parentErr;

    const allIds = subs.map((s) => s.id);
    if (parent) allIds.push(parent.id);

    const { data: photos, error: photoErr } = await sb
      .from('photos')
      .select('id, collection_id, storage_path, width, height, alt_pt, alt_en, alt_es, display_order, taken_at')
      .in('collection_id', allIds)
      .eq('is_published', true)
      .eq('is_archived', false)
      .order('display_order');
    if (photoErr) throw photoErr;

    const byCollection = new Map();
    for (const s of subs) byCollection.set(s.id, { collection: s, photos: [] });
    for (const p of photos) {
      const bucket = byCollection.get(p.collection_id);
      if (bucket) bucket.photos.push(p);
    }
    return Array.from(byCollection.values());
  }

  /** For pages that flatten across parent + subs (like series-eventos.html). */
  async function fetchByParentSlugFlat(parentSlug) {
    const groups = await fetchByParentSlug(parentSlug);
    return groups.flatMap((g) => g.photos);
  }

  // ------ Public API ------
  window.LR_DYNAMIC = {
    isEnabled,
    imageUrl,
    altFor,
    locale,
    onReady,
    fetchAllPublished,
    fetchHomePhotos,
    fetchByCollectionSlug,
    fetchByParentSlug,
    fetchByParentSlugFlat
  };
  document.dispatchEvent(new CustomEvent('lr:dynamic-ready'));
})();
