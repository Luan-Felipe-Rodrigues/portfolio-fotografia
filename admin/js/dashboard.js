import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell, imgUrl } from './admin-shell.js';
import { escapeHtml } from './shared.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('dashboard', session.user.email);

try {
  await load();
  await loadTraffic();
  await loadQuotes();
} catch (e) {
  console.error(e);
  document.querySelectorAll('.placeholder').forEach((el) => {
    el.textContent = 'Erro: ' + e.message;
    el.classList.add('error');
  });
}

const QUOTE_TYPE_LABELS = {
  prewedding: 'Pre-Wedding',
  autoral: 'Autoral',
  eventos: 'Eventos',
  lugares: 'Lugares',
  outros: 'Outros'
};

async function loadQuotes() {
  const { data, error } = await supabase
    .from('quote_requests')
    .select('id, status, ensaio_type, contact_name, created_at')
    .in('status', ['nova', 'vista', 'respondida'])
    .order('created_at', { ascending: false });
  if (error) return; // silencia. Sem cotações não bloqueia dashboard.
  const openCount = data.length;
  if (openCount > 0) {
    const quick = document.getElementById('quotes-quick');
    const badge = document.getElementById('quotes-badge');
    if (quick && badge) {
      badge.textContent = openCount;
      quick.hidden = false;
    }
  }
  // Últimas 3 cotações (mostra painel se houver qualquer cotação, não só abertas)
  const { data: recent } = await supabase
    .from('quote_requests')
    .select('id, status, ensaio_type, contact_name, contact_email, created_at')
    .order('created_at', { ascending: false })
    .limit(3);
  if (recent && recent.length) {
    const panel = document.getElementById('recent-quotes-panel');
    const list = document.getElementById('recent-quotes');
    if (panel && list) {
      panel.hidden = false;
      list.innerHTML = recent.map((q) => {
        const type = QUOTE_TYPE_LABELS[q.ensaio_type] || q.ensaio_type;
        const when = new Date(q.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const isOpen = ['nova', 'vista', 'respondida'].includes(q.status);
        return `
          <a class="recent-item" href="./quote.html?id=${q.id}" style="text-decoration:none;color:inherit">
            <div class="recent-meta">
              <div class="recent-title">${escapeHtml(q.contact_name)} · ${escapeHtml(type)}</div>
              <div class="recent-tag muted">${when} · ${isOpen ? '<strong>' + q.status + '</strong>' : q.status}</div>
            </div>
          </a>
        `;
      }).join('');
    }
  }
}


async function loadTraffic() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [pvRes, sessRes, phvRes] = await Promise.all([
    supabase.from('page_views').select('session_id, path, duration_ms, created_at').gte('created_at', thirtyDaysAgo),
    supabase.from('sessions').select('session_id, is_bot, first_seen').gte('first_seen', thirtyDaysAgo),
    supabase.from('photo_views').select('photo_id, created_at, photo:photos(id, storage_path, alt_pt, collection:collections(name_pt))').gte('created_at', thirtyDaysAgo)
  ]);

  if (pvRes.error) throw pvRes.error;
  if (sessRes.error) throw sessRes.error;
  if (phvRes.error) throw phvRes.error;

  const humanSessions = new Set(sessRes.data.filter((s) => !s.is_bot).map((s) => s.session_id));
  const pv = pvRes.data.filter((r) => humanSessions.has(r.session_id));

  setKpi('tr-visits', pv.length);
  setKpi('tr-sessions', new Set(pv.map((r) => r.session_id)).size);
  const durations = pv.map((r) => r.duration_ms).filter((d) => d != null && d > 0);
  const avgSec = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length / 1000) : 0;
  setKpi('tr-avg', avgSec > 0 ? `${avgSec}s` : '·');
  setKpi('tr-photo-views', phvRes.data.length);

  const counts = new Map();
  const meta = new Map();
  for (const row of phvRes.data) {
    if (!row.photo_id || !row.photo) continue;
    counts.set(row.photo_id, (counts.get(row.photo_id) || 0) + 1);
    if (!meta.has(row.photo_id)) meta.set(row.photo_id, row.photo);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, count, photo: meta.get(id) }));

  const topEl = document.getElementById('top-photos');
  if (!top.length) {
    topEl.innerHTML = '<p class="placeholder">Nenhuma visualização ainda. Aguarde um dia de tráfego.</p>';
    return;
  }
  topEl.innerHTML = top.map((t) => `
    <a href="./edit.html?id=${t.id}" class="recent-row">
      <img src="${imgUrl(t.photo.storage_path, { width: 240, quality: 70 })}" alt="" loading="lazy">
      <div class="recent-meta">
        <div class="recent-alt">${escapeHtml(t.photo.alt_pt || 'sem alt-text')}</div>
        <div class="recent-tag muted">${escapeHtml(t.photo.collection?.name_pt || '?')} · ${t.count} view${t.count > 1 ? 's' : ''}</div>
      </div>
    </a>
  `).join('');
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

  // Interleave: for each top-level row, render it and then all its
  // children in order. Previously the query dumped all subs after Lugares
  // regardless of parent, breaking the visual hierarchy.
  const topLevels = rows.filter((c) => !c.parent_slug);
  const childrenBySlug = new Map();
  for (const c of rows) {
    if (!c.parent_slug) continue;
    if (!childrenBySlug.has(c.parent_slug)) childrenBySlug.set(c.parent_slug, []);
    childrenBySlug.get(c.parent_slug).push(c);
  }
  function renderRow(c, nested) {
    return `
    <div class="collection-row ${nested ? 'nested' : ''}">
      <div class="collection-name">${escapeHtml(c.name_pt)}</div>
      <div class="collection-bar" title="${c.count} foto(s)">
        <div class="collection-fill" style="width: ${(c.count / max * 100).toFixed(0)}%"></div>
      </div>
      <div class="collection-count">${c.count}</div>
    </div>`;
  }
  const html = [];
  for (const parent of topLevels) {
    html.push(renderRow(parent, false));
    const kids = childrenBySlug.get(parent.slug) || [];
    for (const kid of kids) html.push(renderRow(kid, true));
  }
  el.innerHTML = html.join('');
}

function renderRecent(recent) {
  const el = document.getElementById('recent-uploads');
  if (!recent.length) {
    el.innerHTML = '<p class="placeholder">Nenhuma foto ainda. <a href="./upload.html">Enviar a primeira</a></p>';
    return;
  }
  el.innerHTML = recent.map((p) => `
    <a href="./edit.html?id=${p.id}" class="recent-row">
      <img src="${imgUrl(p.storage_path, { width: 240, quality: 70 })}" alt="" loading="lazy">
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
