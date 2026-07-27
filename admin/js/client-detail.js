import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell } from './admin-shell.js';
import { escapeHtml } from './shared.js';

const STORAGE_BASE = 'https://junfgutjyicdrvpoyuzz.supabase.co/storage/v1';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('clients', session.user.email);

const contentEl = document.getElementById('client-content');
const clientId = new URL(window.location.href).searchParams.get('id');

if (!clientId) {
  contentEl.innerHTML = '<p class="placeholder error">ID do cliente ausente na URL.</p>';
  throw new Error('missing id');
}

let client = null;
let ensaios = [];
let signedUrlCache = new Map();

try {
  await load();
} catch (e) {
  contentEl.innerHTML = `<p class="placeholder error">Erro: ${escapeHtml(e.message)}</p>`;
}

async function load() {
  const [clientRes, ensaiosRes, actionsRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('client_ensaios').select(`
      id, title, description, ensaio_date, is_paid, is_delivered, display_order,
      photos:client_photos(id, storage_path, width, height, display_order)
    `).eq('client_id', clientId).order('display_order'),
    supabase.from('client_actions').select('*')
  ]);

  if (clientRes.error) throw clientRes.error;
  if (ensaiosRes.error) throw ensaiosRes.error;

  client = clientRes.data;
  ensaios = ensaiosRes.data || [];

  // Filter actions to those in this client's ensaios
  const ensaioIds = new Set(ensaios.map((e) => e.id));
  const allActions = (actionsRes.data || []).filter((a) => ensaioIds.has(a.ensaio_id));

  // Group actions
  const actionsByEnsaio = new Map();
  const actionsByPhoto = new Map();
  for (const a of allActions) {
    if (!actionsByEnsaio.has(a.ensaio_id)) actionsByEnsaio.set(a.ensaio_id, []);
    actionsByEnsaio.get(a.ensaio_id).push(a);
    if (a.photo_id) {
      if (!actionsByPhoto.has(a.photo_id)) actionsByPhoto.set(a.photo_id, { likes: 0, comments: [], print: false });
      const bucket = actionsByPhoto.get(a.photo_id);
      if (a.kind === 'like') bucket.likes++;
      else if (a.kind === 'comment' && a.content) bucket.comments.push(a);
      else if (a.kind === 'print_select') bucket.print = true;
    }
  }

  // Batch sign URLs
  const paths = ensaios.flatMap((e) => (e.photos || []).map((p) => p.storage_path));
  if (paths.length) {
    const { data: signed } = await supabase.storage.from('client-photos').createSignedUrls(paths, 3600);
    for (const s of signed || []) {
      if (s.path && s.signedUrl) signedUrlCache.set(s.path, s.signedUrl);
    }
  }

  render(actionsByEnsaio, actionsByPhoto);
  // mark last-seen for this client
  localStorage.setItem(`lr_admin_last_seen:${clientId}`, new Date().toISOString());
}

function render(actionsByEnsaio, actionsByPhoto) {
  const portalUrl = `${window.location.origin}/c/${client.slug}`;
  contentEl.innerHTML = `
    <div class="client-header">
      <h1 class="admin-title">${escapeHtml(client.name)}</h1>
      <div class="client-meta">
        <div class="client-url">
          URL: <code>${escapeHtml(portalUrl)}</code>
          <button class="button ghost" id="copy-url">Copiar</button>
          <button class="button ghost" id="wa-share">WhatsApp</button>
          <button class="button danger" id="rotate-url">Regenerar</button>
        </div>
        <div class="client-contact">
          ${client.email ? `E-mail: ${escapeHtml(client.email)} · ` : ''}
          ${client.phone ? `Tel: ${escapeHtml(client.phone)}` : ''}
        </div>
        <div class="client-actions-inline">
          <button class="button ghost" id="edit-client">Editar dados</button>
          <button class="button ghost" id="archive-client">${client.archived ? 'Restaurar' : 'Arquivar'}</button>
        </div>
      </div>
    </div>

    <section class="ensaios-section">
      <div class="section-heading">
        <h2 class="section-title">Ensaios (${ensaios.length})</h2>
        <button class="button" id="new-ensaio">Novo ensaio</button>
      </div>
      ${ensaios.length ? '' : '<p class="placeholder">Nenhum ensaio ainda. Cria um pra começar a subir fotos.</p>'}
      <div id="ensaios-list">
        ${ensaios.map((e) => renderEnsaio(e, actionsByEnsaio.get(e.id) || [], actionsByPhoto)).join('')}
      </div>
    </section>
  `;

  wireHeader(portalUrl);
  wireEnsaios();
}

function renderEnsaio(e, actions, actionsByPhoto) {
  const photos = (e.photos || []).sort((a, b) => a.display_order - b.display_order);
  const totalLikes = actions.filter((a) => a.kind === 'like').length;
  const totalComments = actions.filter((a) => a.kind === 'comment').length;
  const totalPrint = actions.filter((a) => a.kind === 'print_select').length;
  const commentList = actions.filter((a) => a.kind === 'comment' && a.content);

  return `
    <details class="ensaio-card" data-id="${e.id}">
      <summary>
        <div class="ensaio-title">
          <strong>${escapeHtml(e.title)}</strong>
          ${e.ensaio_date ? `<span class="muted"> · ${e.ensaio_date}</span>` : ''}
        </div>
        <div class="ensaio-tags">
          ${e.is_paid ? '<span class="tag published">pago</span>' : '<span class="tag draft">a receber</span>'}
          ${e.is_delivered ? '<span class="tag published">entregue</span>' : ''}
          <span class="tag">${photos.length} foto${photos.length !== 1 ? 's' : ''}</span>
          ${totalLikes ? `<span class="tag home">${totalLikes} ❤</span>` : ''}
          ${totalComments ? `<span class="tag home">${totalComments} 💬</span>` : ''}
          ${totalPrint ? `<span class="tag home">${totalPrint} 🖨</span>` : ''}
        </div>
      </summary>

      <div class="ensaio-body">
        ${e.description ? `<p class="ensaio-desc muted">${escapeHtml(e.description)}</p>` : ''}

        <div class="ensaio-controls">
          <a class="button" href="./upload.html?ensaio=${e.id}">Enviar fotos</a>
          <button class="button ghost" data-action="toggle-paid" data-id="${e.id}" data-current="${e.is_paid}">
            ${e.is_paid ? 'Desmarcar pago' : 'Marcar pago'}
          </button>
          <button class="button ghost" data-action="toggle-delivered" data-id="${e.id}" data-current="${e.is_delivered}">
            ${e.is_delivered ? 'Desmarcar entregue' : 'Marcar entregue'}
          </button>
          <button class="button ghost" data-action="edit-ensaio" data-id="${e.id}">Editar</button>
          <button class="button danger" data-action="delete-ensaio" data-id="${e.id}">Excluir</button>
        </div>

        ${photos.length ? `
          <div class="client-photos-grid">
            ${photos.map((p) => renderPhotoThumb(p, actionsByPhoto.get(p.id))).join('')}
          </div>
        ` : '<p class="placeholder">Nenhuma foto neste ensaio ainda.</p>'}

        ${commentList.length ? `
          <div class="comments-block">
            <h3 class="section-title">Comentários (${commentList.length})</h3>
            ${commentList.map((c) => `
              <div class="comment-item">
                <div class="comment-content">${escapeHtml(c.content)}</div>
                <div class="comment-meta muted">${new Date(c.created_at).toLocaleString('pt-BR')}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </details>
  `;
}

function renderPhotoThumb(p, bucket) {
  const signedUrl = signedUrlCache.get(p.storage_path);
  const b = bucket || { likes: 0, comments: [], print: false };
  const badges = [
    b.likes ? `<span class="thumb-badge">❤ ${b.likes}</span>` : '',
    b.comments.length ? `<span class="thumb-badge">💬 ${b.comments.length}</span>` : '',
    b.print ? '<span class="thumb-badge">🖨</span>' : ''
  ].filter(Boolean).join('');
  return `
    <div class="client-photo-thumb">
      ${signedUrl ? `<img src="${signedUrl}" alt="" loading="lazy">` : '<div class="thumb-missing">sem URL</div>'}
      ${badges ? `<div class="thumb-badges">${badges}</div>` : ''}
    </div>
  `;
}

function wireHeader(portalUrl) {
  document.getElementById('copy-url').addEventListener('click', async () => {
    await navigator.clipboard.writeText(portalUrl);
    alert('URL copiada');
  });
  document.getElementById('wa-share').addEventListener('click', () => {
    const text = `Oi ${client.name.split(' ')[0]}, seu link do portal com as fotos: ${portalUrl}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  });
  document.getElementById('rotate-url').addEventListener('click', async () => {
    if (!confirm('Regenerar URL vai invalidar a atual. Continuar?')) return;
    const newSlug = crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase.from('clients').update({ slug: newSlug }).eq('id', clientId);
    if (error) return alert('Erro: ' + error.message);
    await load();
  });
  document.getElementById('edit-client').addEventListener('click', async () => {
    const name = prompt('Nome:', client.name);
    if (name === null) return;
    const email = prompt('E-mail:', client.email || '') || null;
    const phone = prompt('Telefone:', client.phone || '') || null;
    const notes = prompt('Notas privadas:', client.notes_admin || '') || null;
    const { error } = await supabase.from('clients')
      .update({ name: name.trim(), email, phone, notes_admin: notes })
      .eq('id', clientId);
    if (error) return alert('Erro: ' + error.message);
    await load();
  });
  document.getElementById('archive-client').addEventListener('click', async () => {
    const target = !client.archived;
    if (!confirm(`Confirma ${target ? 'arquivar' : 'restaurar'} este cliente?`)) return;
    const { error } = await supabase.from('clients').update({ archived: target }).eq('id', clientId);
    if (error) return alert('Erro: ' + error.message);
    if (target) window.location.href = './clients.html';
    else await load();
  });
  document.getElementById('new-ensaio').addEventListener('click', createNewEnsaio);
}

function wireEnsaios() {
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'toggle-paid') {
        const current = btn.dataset.current === 'true';
        const { error } = await supabase.from('client_ensaios').update({ is_paid: !current }).eq('id', id);
        if (error) return alert('Erro: ' + error.message);
        await load();
      } else if (action === 'toggle-delivered') {
        const current = btn.dataset.current === 'true';
        const { error } = await supabase.from('client_ensaios').update({ is_delivered: !current }).eq('id', id);
        if (error) return alert('Erro: ' + error.message);
        await load();
      } else if (action === 'edit-ensaio') {
        const ensaio = ensaios.find((x) => x.id === id);
        const title = prompt('Título:', ensaio.title);
        if (title === null) return;
        const desc = prompt('Descrição:', ensaio.description || '') || null;
        const date = prompt('Data (YYYY-MM-DD, vazio pra remover):', ensaio.ensaio_date || '') || null;
        const { error } = await supabase.from('client_ensaios')
          .update({ title: title.trim(), description: desc, ensaio_date: date })
          .eq('id', id);
        if (error) return alert('Erro: ' + error.message);
        await load();
      } else if (action === 'delete-ensaio') {
        if (!confirm('Excluir este ensaio e TODAS as fotos dele? Não dá pra desfazer.')) return;
        const ensaio = ensaios.find((x) => x.id === id);
        // Delete storage objects first
        if (ensaio && ensaio.photos && ensaio.photos.length) {
          const paths = ensaio.photos.map((p) => p.storage_path);
          await supabase.storage.from('client-photos').remove(paths);
        }
        const { error } = await supabase.from('client_ensaios').delete().eq('id', id);
        if (error) return alert('Erro: ' + error.message);
        await load();
      }
    });
  });
}

async function createNewEnsaio() {
  const title = prompt('Título do ensaio (ex: "Pri e Michel Pre-Wedding"):');
  if (!title || !title.trim()) return;
  const date = prompt('Data do ensaio (YYYY-MM-DD, opcional):') || null;
  const description = prompt('Descrição (opcional):') || null;
  const displayOrder = (ensaios[ensaios.length - 1]?.display_order || 0) + 10;
  const { error } = await supabase.from('client_ensaios')
    .insert({ client_id: clientId, title: title.trim(), description, ensaio_date: date, display_order: displayOrder });
  if (error) return alert('Erro: ' + error.message);
  await load();
}

