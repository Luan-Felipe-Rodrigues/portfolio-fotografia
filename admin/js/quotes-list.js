import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell } from './admin-shell.js';
import { escapeHtml } from './shared.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('quotes', session.user.email);

const listEl = document.getElementById('quotes-list');
const filter = document.getElementById('status-filter');

let currentStatus = 'abertas';

filter.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const s = btn.dataset.status;
    if (s === currentStatus) return;
    currentStatus = s;
    filter.querySelectorAll('button').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    load();
  });
});

const TYPE_LABELS = {
  prewedding: 'Pre-Wedding',
  autoral: 'Autoral',
  eventos: 'Eventos',
  lugares: 'Lugares',
  outros: 'Outros'
};

const STATUS_LABELS = {
  nova: 'Nova',
  vista: 'Vista',
  respondida: 'Respondida',
  ganha: 'Ganha',
  perdida: 'Perdida'
};

async function load() {
  listEl.innerHTML = '<p class="placeholder">Carregando...</p>';
  let query = supabase
    .from('quote_requests')
    .select('id, status, ensaio_type, contact_name, contact_email, contact_whatsapp, preferred_date, date_flexible, location, duration_hours, styles, created_at')
    .order('created_at', { ascending: false });

  if (currentStatus === 'abertas') {
    query = query.in('status', ['nova', 'vista', 'respondida']);
  } else if (currentStatus !== 'todas') {
    query = query.eq('status', currentStatus);
  }

  const { data, error } = await query;
  if (error) {
    listEl.innerHTML = `<p class="placeholder error">Erro: ${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data.length) {
    listEl.innerHTML = `<p class="placeholder">Nenhuma cotação ${currentStatus === 'todas' ? '' : currentStatus} ainda.</p>`;
    return;
  }
  listEl.innerHTML = data.map(renderRow).join('');
}

function renderRow(q) {
  const type = TYPE_LABELS[q.ensaio_type] || q.ensaio_type;
  const date = q.preferred_date ? new Date(q.preferred_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
  const meta = [
    date ? `${date}${q.date_flexible ? ' (flexível)' : ''}` : null,
    q.location,
    q.duration_hours ? `${q.duration_hours}h` : null
  ].filter(Boolean).join(' · ');

  const styleBadges = (q.styles || []).slice(0, 4).map((s) => `<span class="tag muted">${escapeHtml(s)}</span>`).join('');
  const isNew = q.status === 'nova';
  const statusBadge = `<span class="tag ${isNew ? 'home' : 'muted'}">${STATUS_LABELS[q.status] || q.status}</span>`;
  const receivedAt = new Date(q.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return `
    <a class="photo-row" href="./quote.html?id=${q.id}" style="text-decoration:none;color:inherit">
      <div class="client-avatar">${escapeHtml((q.contact_name || '?').charAt(0).toUpperCase())}</div>
      <div class="photo-meta">
        <div class="photo-alt">${escapeHtml(q.contact_name)} · ${escapeHtml(type)}</div>
        <div class="photo-tags">
          ${statusBadge}
          ${styleBadges}
        </div>
        ${meta ? `<div class="photo-dims muted">${escapeHtml(meta)}</div>` : ''}
        <div class="photo-dims muted">${escapeHtml(q.contact_email)}${q.contact_whatsapp ? ' · ' + escapeHtml(q.contact_whatsapp) : ''} · <span>${receivedAt}</span></div>
      </div>
    </a>
  `;
}


// Mark "all quotes" as seen when hitting the list
localStorage.setItem('lr_admin_last_seen:__quotes__', new Date().toISOString());

await load();
