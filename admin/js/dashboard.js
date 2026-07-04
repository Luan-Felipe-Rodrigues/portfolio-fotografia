import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell, STORAGE_RENDER } from './admin-shell.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('dashboard', session.user.email);

try {
  await load();
} catch (e) {
  console.error(e);
  document.querySelectorAll('.placeholder').forEach((el) => {
    el.textContent = 'Erro: ' + e.message;
    el.classList.add('error');
  });
}

async function load() {
  const [photosRes, colsRes, recentRes, likesRes] = await Promise.all([
    supabase.from('photos').select('id, collection_id, is_published, is_archived'),
    supabase.from('collections').select('id, slug, parent_slug, name_pt, display_order').order('parent_slug', { nullsFirst: true, ascending: true }).order('display_order'),
    supabase.from('photos').select('id, storage_path, alt_pt, created_at, is_archived, collection:collections(name_pt)').order('created_at', { ascending: false }).limit(5),
    supabase.from('photo_likes').select('count')
  ]);

  if (photosRes.error) throw photosRes.error;
  if (colsRes.error) throw colsRes.error;
  if (recentRes.error) throw recentRes.error;

  const photos = photosRes.data;
  const collections = colsRes.data;
  const recent = recentRes.data;
  const likes = likesRes.data || [];

  const active = photos.filter((p) => !p.is_archived);
  setKpi('kpi-total', photos.length);
  setKpi('kpi-published', active.filter((p) => p.is_published).length);
  setKpi('kpi-draft', active.filter((p) => !p.is_published).length);
  setKpi('kpi-archived', photos.filter((p) => p.is_archived).length);
  setKpi('kpi-likes', likes.reduce((sum, l) => sum + (l.count || 0), 0));

  renderByCollection(collections, photos);
  renderRecent(recent);
}

function setKpi(id, value) {
  document.getElementById(id).textContent = value;
}

function renderByCollection(collections, photos) {
  // Direct count per collection (photos whose collection_id matches this row).
  const directCount = new Map();
  for (const c of collections) {
    directCount.set(
      c.slug,
      photos.filter((p) => p.collection_id === c.id && !p.is_archived).length
    );
  }

  // Effective count: top-level rows aggregate children by parent_slug so a
  // parent whose photos live under sub-collections doesn't misleadingly show 0.
  const rows = collections.map((c) => {
    let count = directCount.get(c.slug) || 0;
    if (!c.parent_slug) {
      for (const child of collections) {
        if (child.parent_slug === c.slug) {
          count += directCount.get(child.slug) || 0;
        }
      }
    }
    return { ...c, count };
  });

  const max = Math.max(1, ...rows.map((c) => c.count));
  const el = document.getElementById('by-collection');

  if (rows.every((c) => c.count === 0)) {
    el.innerHTML = '<p class="placeholder">Nenhuma foto ainda.</p>';
    return;
  }

  el.innerHTML = rows.map((c) => `
    <div class="collection-row ${c.parent_slug ? 'nested' : ''}">
      <div class="collection-name">${escapeHtml(c.name_pt)}</div>
      <div class="collection-bar" title="${c.count} foto(s)">
        <div class="collection-fill" style="width: ${(c.count / max * 100).toFixed(0)}%"></div>
      </div>
      <div class="collection-count">${c.count}</div>
    </div>
  `).join('');
}

function renderRecent(recent) {
  const el = document.getElementById('recent-uploads');
  if (!recent.length) {
    el.innerHTML = '<p class="placeholder">Nenhuma foto ainda. <a href="./upload.html">Enviar a primeira</a></p>';
    return;
  }
  el.innerHTML = recent.map((p) => `
    <a href="./edit.html?id=${p.id}" class="recent-row">
      <img src="${STORAGE_RENDER}/${p.storage_path}?width=120&quality=70" alt="" loading="lazy">
      <div class="recent-meta">
        <div class="recent-alt">${escapeHtml(p.alt_pt || 'sem alt-text')}</div>
        <div class="recent-tag muted">${escapeHtml(p.collection?.name_pt || '?')} · ${formatDate(p.created_at)}${p.is_archived ? ' · arquivada' : ''}</div>
      </div>
    </a>
  `).join('');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
