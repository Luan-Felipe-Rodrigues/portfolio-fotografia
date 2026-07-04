/*
 * Supabase client for the public site. Loaded ahead of dynamic-render.js.
 * Uses the same publishable key as admin (safe on the frontend, protected by
 * RLS).
 *
 * The client is exposed as window.LR_SUPABASE and dispatches
 * `lr:supabase-ready` when it finishes loading. Callers should wait for the
 * event or check the global before using.
 */
(function () {
  if (window.LR_SUPABASE || document.getElementById('lr-supabase-loader')) return;

  const SUPABASE_URL = 'https://junfgutjyicdrvpoyuzz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_GY-aCPbwOTu_BXGGGNx5rQ_Rmc_Nddb';

  // Dynamic ESM import to avoid dragging the SDK on pages that don't need it.
  // esm.sh serves a browser-ready ESM build of @supabase/supabase-js.
  import('https://esm.sh/@supabase/supabase-js@2.45.0').then((mod) => {
    const client = mod.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    window.LR_SUPABASE = client;
    window.LR_SUPABASE_URL = SUPABASE_URL;
    window.LR_STORAGE_RENDER = `${SUPABASE_URL}/storage/v1/render/image/public/photos`;
    window.LR_STORAGE_OBJECT = `${SUPABASE_URL}/storage/v1/object/public/photos`;
    document.dispatchEvent(new CustomEvent('lr:supabase-ready'));
  }).catch((err) => {
    console.error('[supabase-public] falha ao carregar SDK:', err);
    // Signal readiness so waiters don't hang. Callers should check LR_SUPABASE.
    document.dispatchEvent(new CustomEvent('lr:supabase-ready'));
  });
})();
