import { supabase } from './supabase-client.js';

export const STORAGE_BASE = 'https://junfgutjyicdrvpoyuzz.supabase.co/storage/v1';
export const STORAGE_RENDER = `${STORAGE_BASE}/render/image/public/photos`;
export const STORAGE_OBJECT = `${STORAGE_BASE}/object/public/photos`;

/**
 * Build a Supabase image-transform URL that always passes both width and
 * height with resize=contain. Prevents the vertical-strip crop bug on
 * portrait photos captured landscape and rotated via EXIF orientation.
 *
 * @param {string} storagePath  the row's storage_path
 * @param {{width?: number, height?: number, quality?: number, resize?: 'contain'|'cover'|'fill'}} opts
 */
export function imgUrl(storagePath, opts = {}) {
  if (!storagePath) return '';
  const params = new URLSearchParams();
  const w = opts.width;
  const h = opts.height || w;
  if (w) params.set('width', String(w));
  if (h) params.set('height', String(h));
  params.set('resize', opts.resize || 'contain');
  if (opts.quality) params.set('quality', String(opts.quality));
  return `${STORAGE_RENDER}/${storagePath}?${params.toString()}`;
}

export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace('./login.html');
    return null;
  }
  // Mark this browser as opted-out from analytics — so Luan's own admin
  // and site browsing don't inflate the counters. Idempotent, no-op if
  // already set. Same origin as the public site, localStorage is shared.
  try { localStorage.setItem('lr_no_track', '1'); } catch { /* noop */ }
  return session;
}

export function renderShell(activeKey, email) {
  const container = document.getElementById('admin-shell-header');
  if (!container) return;

  container.innerHTML = `
    <header class="admin-nav">
      <a href="./" class="admin-nav-brand">Admin</a>
      <nav class="admin-nav-links">
        <a href="./" data-key="dashboard">Dashboard</a>
        <a href="./photos.html" data-key="photos">Fotos</a>
        <a href="./clients.html" data-key="clients">Clientes</a>
        <a href="./quotes.html" data-key="quotes">Cotações</a>
        <a href="./analytics.html" data-key="analytics">Análises</a>
      </nav>
      <div class="admin-nav-user">
        <span class="user-info">${email || ''}</span>
        <button class="logout" id="admin-logout-btn">Sair</button>
      </div>
    </header>
  `;

  const active = container.querySelector(`a[data-key="${activeKey}"]`);
  if (active) active.classList.add('active');

  document.getElementById('admin-logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('./login.html');
  });
}

export async function loadCollectionsForSelect(selectEl, { includeEmpty = false, emptyLabel = 'Todas' } = {}) {
  const { data, error } = await supabase
    .from('collections')
    .select('id, slug, parent_slug, name_pt, display_order')
    .order('parent_slug', { nullsFirst: true, ascending: true })
    .order('display_order');

  if (error) throw error;

  selectEl.innerHTML = '';
  if (includeEmpty) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = emptyLabel;
    selectEl.appendChild(opt);
  }
  for (const c of data) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.dataset.slug = c.slug;
    opt.textContent = c.parent_slug ? `   → ${c.name_pt}` : c.name_pt;
    selectEl.appendChild(opt);
  }
  return data;
}
