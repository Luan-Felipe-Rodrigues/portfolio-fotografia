import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell } from './admin-shell.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('clients', session.user.email);

const listEl = document.getElementById('clients-list');
const viewToggle = document.getElementById('view-toggle');
const newBtn = document.getElementById('new-client-btn');

let currentView = 'active';

viewToggle.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.view === currentView) return;
    currentView = btn.dataset.view;
    viewToggle.querySelectorAll('button').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    load();
  });
});

newBtn.addEventListener('click', createNewClient);

async function load() {
  listEl.innerHTML = '<p class="placeholder">Carregando...</p>';
  const isArchived = currentView === 'archived';

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, slug, name, email, phone, archived, created_at')
    .eq('archived', isArchived)
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<p class="placeholder error">Erro: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!clients.length) {
    listEl.innerHTML = `<p class="placeholder">Nenhum cliente ${isArchived ? 'arquivado' : 'ativo'} ainda.${!isArchived ? '<br><button class="link-btn" id="empty-new">Criar o primeiro cliente</button>' : ''}</p>`;
    const empty = document.getElementById('empty-new');
    if (empty) empty.addEventListener('click', createNewClient);
    return;
  }

  // Fetch aggregate stats per client (ensaios + actions)
  const ids = clients.map((c) => c.id);
  const [ensaiosRes, actionsRes] = await Promise.all([
    supabase.from('client_ensaios').select('id, client_id').in('client_id', ids),
    supabase.from('client_actions').select('id, kind, ensaio_id, created_at')
  ]);

  const ensaiosByClient = new Map();
  const ensaioToClient = new Map();
  for (const e of ensaiosRes.data || []) {
    ensaiosByClient.set(e.client_id, (ensaiosByClient.get(e.client_id) || 0) + 1);
    ensaioToClient.set(e.id, e.client_id);
  }

  const lastSeenAll = getLastSeen('__all__');
  const actionsByClient = new Map();
  const unseenByClient = new Map();
  for (const a of actionsRes.data || []) {
    const clientId = ensaioToClient.get(a.ensaio_id);
    if (!clientId) continue;
    actionsByClient.set(clientId, (actionsByClient.get(clientId) || 0) + 1);
    if (new Date(a.created_at) > lastSeenAll) {
      unseenByClient.set(clientId, (unseenByClient.get(clientId) || 0) + 1);
    }
  }

  listEl.innerHTML = clients.map((c) => renderRow(c, {
    ensaios: ensaiosByClient.get(c.id) || 0,
    actions: actionsByClient.get(c.id) || 0,
    unseen: unseenByClient.get(c.id) || 0
  })).join('');

  listEl.querySelectorAll('.copy-url-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const slug = btn.dataset.slug;
      const url = `${window.location.origin}/c/${slug}`;
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = 'Copiado';
        setTimeout(() => { btn.textContent = 'Copiar URL'; }, 1500);
      } catch {
        alert(url);
      }
    });
  });
}

function renderRow(c, stats) {
  const url = `${window.location.origin}/c/${c.slug}`;
  const contact = [c.email, c.phone].filter(Boolean).join(' · ') || '';
  const unseenBadge = stats.unseen > 0 ? `<span class="tag home">${stats.unseen} novo${stats.unseen > 1 ? 's' : ''}</span>` : '';
  return `
    <a class="photo-row" href="./client.html?id=${c.id}" style="text-decoration:none;color:inherit">
      <div class="client-avatar">${escapeHtml((c.name || '?').charAt(0).toUpperCase())}</div>
      <div class="photo-meta">
        <div class="photo-alt">${escapeHtml(c.name)}</div>
        <div class="photo-tags">
          ${unseenBadge}
          <span class="tag muted">${stats.ensaios} ensaio${stats.ensaios !== 1 ? 's' : ''}</span>
          <span class="tag muted">${stats.actions} interaç${stats.actions === 1 ? 'ão' : 'ões'}</span>
        </div>
        ${contact ? `<div class="photo-dims muted">${escapeHtml(contact)}</div>` : ''}
        <div class="photo-dims muted">URL: <code>${escapeHtml(url)}</code></div>
      </div>
      <div class="photo-actions">
        <button class="button ghost copy-url-btn" data-slug="${c.slug}">Copiar URL</button>
      </div>
    </a>
  `;
}

async function createNewClient() {
  const name = prompt('Nome do cliente:');
  if (!name || !name.trim()) return;
  const email = prompt('E-mail (opcional):') || null;
  const phone = prompt('WhatsApp/telefone (opcional):') || null;

  const slug = crypto.randomUUID().replace(/-/g, '');
  const { data, error } = await supabase
    .from('clients')
    .insert({ slug, name: name.trim(), email, phone })
    .select('id')
    .single();
  if (error) {
    alert('Erro: ' + error.message);
    return;
  }
  window.location.href = `./client.html?id=${data.id}`;
}

function getLastSeen(key) {
  const raw = localStorage.getItem(`lr_admin_last_seen:${key}`);
  return raw ? new Date(raw) : new Date(0);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Mark "all clients" as seen when hitting the list
localStorage.setItem('lr_admin_last_seen:__all__', new Date().toISOString());

await load();
