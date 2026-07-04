import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell, loadCollectionsForSelect, imgUrl } from './admin-shell.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('photos', session.user.email);

const filterEl = document.getElementById('collection-filter');
const listEl = document.getElementById('photos-list');
const viewToggle = document.getElementById('view-toggle');

let currentView = 'active';

await loadCollectionsForSelect(filterEl, { includeEmpty: true, emptyLabel: 'Todas as coleções' });

filterEl.addEventListener('change', () => loadPhotos());

viewToggle.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.view === currentView) return;
    currentView = btn.dataset.view;
    viewToggle.querySelectorAll('button').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    loadPhotos();
  });
});

async function loadPhotos() {
  listEl.innerHTML = '<p class="placeholder">Carregando fotos...</p>';

  let query = supabase
    .from('photos')
    .select('id, storage_path, alt_pt, display_order, is_published, is_home_featured, is_archived, taken_at, width, height, collection:collections(name_pt, slug)')
    .eq('is_archived', currentView === 'archived')
    .order('display_order');

  if (filterEl.value) query = query.eq('collection_id', filterEl.value);

  const { data, error } = await query;

  if (error) {
    listEl.innerHTML = `<p class="placeholder error">Erro: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data.length) {
    const emptyMsg = currentView === 'archived'
      ? 'Nenhuma foto arquivada.'
      : `Nenhuma foto ${filterEl.value ? 'nesta coleção' : 'ainda'}.<br><a href="./upload.html">Enviar a primeira</a>`;
    listEl.innerHTML = `<p class="placeholder">${emptyMsg}</p>`;
    return;
  }

  listEl.innerHTML = data.map(renderRow).join('');
  data.forEach((p) => wireRow(p));
}

function renderRow(p) {
  const thumb = imgUrl(p.storage_path, { width: 400, quality: 70 });
  const isArchived = currentView === 'archived';

  const badges = [
    p.collection?.name_pt ? `<span class="tag">${escapeHtml(p.collection.name_pt)}</span>` : '',
    p.is_home_featured ? '<span class="tag home">home</span>' : '',
    isArchived
      ? '<span class="tag archived">arquivada</span>'
      : (p.is_published ? '<span class="tag published">publicada</span>' : '<span class="tag draft">rascunho</span>'),
    p.taken_at ? `<span class="tag muted">${p.taken_at}</span>` : ''
  ].filter(Boolean).join(' ');

  const archiveBtn = isArchived
    ? '<button class="button ghost" data-action="restore">Restaurar</button>'
    : '<button class="button ghost" data-action="archive">Arquivar</button>';

  return `
    <div class="photo-row" data-id="${p.id}">
      <img src="${thumb}" alt="" loading="lazy" width="200">
      <div class="photo-meta">
        <div class="photo-alt">${escapeHtml(p.alt_pt || '')}${!p.alt_pt ? '<em class="muted">sem alt-text</em>' : ''}</div>
        <div class="photo-tags">${badges}</div>
        <div class="photo-dims muted">${p.width} × ${p.height} px</div>
      </div>
      <div class="photo-actions">
        <label class="field inline">
          <span class="muted">Ordem</span>
          <input type="number" value="${p.display_order}" data-field="order" step="10">
        </label>
        <a href="./edit.html?id=${p.id}" class="button ghost">Editar</a>
        ${archiveBtn}
        <button class="button danger" data-action="delete">Excluir</button>
      </div>
    </div>
  `;
}

function wireRow(p) {
  const row = listEl.querySelector(`.photo-row[data-id="${p.id}"]`);
  if (!row) return;

  row.querySelector('[data-field="order"]').addEventListener('change', async (e) => {
    const newOrder = parseInt(e.target.value, 10);
    if (Number.isNaN(newOrder)) return;
    const { error } = await supabase.rpc('update_photo', {
      p_id: p.id,
      p_collection_id: null,
      p_alt_pt: null,
      p_alt_en: null,
      p_alt_es: null,
      p_display_order: newOrder,
      p_is_published: null,
      p_is_home_featured: null,
      p_taken_at: null
    });
    if (error) alert('Erro ao salvar ordem: ' + error.message);
  });

  const archiveBtn = row.querySelector('[data-action="archive"], [data-action="restore"]');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', async () => {
      const archiving = archiveBtn.dataset.action === 'archive';
      const { error } = await supabase.rpc('set_photo_archived', { p_id: p.id, p_archived: archiving });
      if (error) {
        alert('Erro: ' + error.message);
        return;
      }
      row.remove();
    });
  }

  row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    if (!confirm('Excluir esta foto? Não dá pra desfazer.')) return;
    const { data: path, error } = await supabase.rpc('delete_photo', { p_id: p.id });
    if (error) {
      alert('Erro: ' + error.message);
      return;
    }
    if (path) {
      const { error: storageErr } = await supabase.storage.from('photos').remove([path]);
      if (storageErr) console.warn('Falha ao apagar objeto do storage:', storageErr.message);
    }
    row.remove();
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

await loadPhotos();
