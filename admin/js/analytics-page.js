import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell } from './admin-shell.js';
import { escapeHtml } from './shared.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('analytics', session.user.email);

let currentRange = 30;
const charts = {};

document.querySelectorAll('#range-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#range-toggle button').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    currentRange = parseInt(btn.dataset.range, 10);
    load().catch((e) => console.error(e));
  });
});

await load();

async function load() {
  const since = new Date(Date.now() - currentRange * 86400000).toISOString();

  const [pvRes, sessRes, phvRes] = await Promise.all([
    supabase.from('page_views').select('session_id, path, referrer, duration_ms, created_at').gte('created_at', since),
    supabase.from('sessions').select('session_id, country, device_type, is_bot, first_seen').gte('first_seen', since),
    supabase.from('photo_views').select('photo_id, created_at').gte('created_at', since)
  ]);
  if (pvRes.error) throw pvRes.error;
  if (sessRes.error) throw sessRes.error;
  if (phvRes.error) throw phvRes.error;

  const humans = new Set(sessRes.data.filter((s) => !s.is_bot).map((s) => s.session_id));
  const pv = pvRes.data.filter((r) => humans.has(r.session_id));
  const humanSessions = sessRes.data.filter((s) => !s.is_bot);

  // KPIs
  setText('k-visits', pv.length);
  setText('k-sessions', new Set(pv.map((r) => r.session_id)).size);
  const durs = pv.map((r) => r.duration_ms).filter((d) => d != null && d > 0);
  const avgSec = durs.length ? Math.round(durs.reduce((s, d) => s + d, 0) / durs.length / 1000) : 0;
  setText('k-avg', avgSec > 0 ? `${avgSec}s` : '—');
  setText('k-photo-views', phvRes.data.length);

  // Line: visits per day
  const byDay = new Map();
  const oldest = new Date(since);
  const today = new Date();
  for (let d = new Date(oldest); d <= today; d.setDate(d.getDate() + 1)) {
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of pv) {
    const key = r.created_at.slice(0, 10);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  const days = [...byDay.keys()].sort();
  drawLine('chart-visits', days.map(shortDay), days.map((d) => byDay.get(d)));

  // Pizza: countries
  const countries = new Map();
  for (const s of humanSessions) {
    const k = s.country || 'Desconhecido';
    countries.set(k, (countries.get(k) || 0) + 1);
  }
  drawPie('chart-countries', [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));

  // Pizza: devices
  const devices = new Map();
  for (const s of humanSessions) {
    const k = s.device_type || 'desconhecido';
    devices.set(k, (devices.get(k) || 0) + 1);
  }
  drawPie('chart-devices', [...devices.entries()]);

  // Top paths
  const paths = new Map();
  for (const r of pv) paths.set(r.path, (paths.get(r.path) || 0) + 1);
  renderRanked('top-paths', [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));

  // Top referrers
  const refs = new Map();
  for (const r of pv) {
    if (!r.referrer) continue;
    let host;
    try { host = new URL(r.referrer).host; } catch { host = r.referrer; }
    if (host === window.location.host) continue;
    refs.set(host, (refs.get(host) || 0) + 1);
  }
  renderRanked('top-refs', [...refs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10), 'Nenhum referrer externo ainda.');
}

function setText(id, v) {
  document.getElementById(id).textContent = v;
}

function shortDay(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function drawLine(canvasId, labels, data) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: '#1a1a1a', tension: 0.25, pointRadius: 2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function drawPie(canvasId, entries) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (!entries.length) {
    ctx.canvas.parentElement.innerHTML = '<p class="placeholder">Sem dados ainda.</p>';
    return;
  }
  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map((e) => e[0]),
      datasets: [{ data: entries.map((e) => e[1]), backgroundColor: ['#1a1a1a', '#4a4a4a', '#7a7a7a', '#a0a0a0', '#c0c0c0', '#d5d5d5', '#e0e0e0', '#eaeaea'] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });
}

function renderRanked(elId, entries, emptyMsg) {
  const el = document.getElementById(elId);
  if (!entries.length) {
    el.innerHTML = `<p class="placeholder">${emptyMsg || 'Nenhum dado ainda.'}</p>`;
    return;
  }
  const max = entries[0][1];
  el.innerHTML = entries.map(([k, v]) => `
    <div class="collection-row">
      <div class="collection-name">${escapeHtml(k)}</div>
      <div class="collection-bar"><div class="collection-fill" style="width:${(v / max * 100).toFixed(0)}%"></div></div>
      <div class="collection-count">${v}</div>
    </div>
  `).join('');
}

