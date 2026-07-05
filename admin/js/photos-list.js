import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell, loadCollectionsForSelect, imgUrl } from './admin-shell.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('photos', session.user.email);

const filterEl = document.getElementById('collection-filter');
const listEl = document.getElementById('photos-list');
const viewToggle = document.getElementById('view-toggle');
const selectAllEl = document.getElementById('select-all');
const bulkActionsEl = document.getElementById('bulk-actions');
const bulkCountEl = document.getElementById('bulk-count');

let currentView = 'active';
let currentPhotos = [];
const selected = new Set();

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

selectAllEl.addEventListener('change', () => {
  if (selectAllEl.checked) {
    for (const p of currentPhotos) selected.add(p.id);
  } else {
    selected.clear();
  }
  syncCheckboxes();
  updateBulkBar();
});

document.querySelectorAll('[data-bulk]').forEach((btn) => {
  btn.addEventListener('click', () => handleBulk(btn.dataset.bulk));
});

async function loadPhotos() {
  listEl.innerHTML = '<p class="placeholder">Carregando fotos...</p>';
  selected.clear();
  selectAllEl.checked = false;
  updateBulkBar();

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

  currentPhotos = data;

  if (!data.length) {
    const emptyMsg = currentView === 'archived'
      ? 'Nenhuma foto arquivada.'
      : `Nenhuma foto ${filterEl.value ? 'nesta coleção' : 'ainda'}.<br><a href="./upload.html">Enviar a primeira</a>`;
    listEl.innerHTML = `<p class="placeholder">${emptyMsg}</p>`;
    return;
  }

  listEl.innerHTML = data.map(renderRow).join('');
  data.forEach((p) => wireRow(p));

  // Show/hide bulk unarchive button per view
  const restoreBtn = document.querySelector('[data-bulk="unarchive"]');
  const archiveBtn = document.querySelector('[data-bulk="archive"]');
  const publishBtn = document.querySelector('[data-bulk="publish"]');
  const unpubBtn = document.querySelector('[data-bulk="unpublish"]');
  const showArchived = currentView === 'archived';
  restoreBtn.hidden = !showArchived;
  archiveBtn.hidden = showArchived;
  publishBtn.hidden = showArchived;
  unpubBtn.hidden = showArchived;
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
      <label class="row-select">
        <input type="checkbox" class="row-checkbox" data-id="${p.id}">
      </label>
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

  const cb = row.querySelector('.row-checkbox');
  cb.addEventListener('change', () => {
    if (cb.checked) selected.add(p.id);
    else selected.delete(p.id);
    updateBulkBar();
    selectAllEl.checked = selected.size === currentPhotos.length && currentPhotos.length > 0;
    selectAllEl.indeterminate = selected.size > 0 && selected.size < currentPhotos.length;
  });

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
      selected.delete(p.id);
      updateBulkBar();
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
    selected.delete(p.id);
    updateBulkBar();
  });
}

function syncCheckboxes() {
  listEl.querySelectorAll('.row-checkbox').forEach((cb) => {
    cb.checked = selected.has(cb.dataset.id);
  });
}

function updateBulkBar() {
  bulkCountEl.textContent = `${selected.size} selecionada${selected.size !== 1 ? 's' : ''}`;
  bulkActionsEl.hidden = selected.size === 0;
}

async function handleBulk(action) {
  if (!selected.size) return;
  const ids = [...selected];

  const labels = {
    publish: `Publicar ${ids.length} foto${ids.length > 1 ? 's' : ''}?`,
    unpublish: `Despublicar ${ids.length} foto${ids.length > 1 ? 's' : ''}?`,
    archive: `Arquivar ${ids.length} foto${ids.length > 1 ? 's' : ''}?`,
    unarchive: `Restaurar ${ids.length} foto${ids.length > 1 ? 's' : ''}?`,
    delete: `EXCLUIR ${ids.length} foto${ids.length > 1 ? 's' : ''} permanentemente? Não dá pra desfazer.`,
    clear: null
  };

  if (action === 'clear') {
    selected.clear();
    syncCheckboxes();
    updateBulkBar();
    selectAllEl.checked = false;
    selectAllEl.indeterminate = false;
    return;
  }

  if (!confirm(labels[action])) return;

  // Show progress inline in the bulk bar
  const originalText = bulkCountEl.textContent;
  bulkCountEl.textContent = `Processando 0/${ids.length}...`;

  let done = 0;
  let errors = 0;

  for (const id of ids) {
    try {
      if (action === 'publish' || action === 'unpublish') {
        const { error } = await supabase.rpc('update_photo', {
          p_id: id,
          p_collection_id: null,
          p_alt_pt: null,
          p_alt_en: null,
          p_alt_es: null,
          p_display_order: null,
          p_is_published: action === 'publish',
          p_is_home_featured: null,
          p_taken_at: null
        });
        if (error) throw error;
      } else if (action === 'archive' || action === 'unarchive') {
        const { error } = await supabase.rpc('set_photo_archived', {
          p_id: id,
          p_archived: action === 'archive'
        });
        if (error) throw error;
      } else if (action === 'delete') {
        const { data: path, error } = await supabase.rpc('delete_photo', { p_id: id });
        if (error) throw error;
        if (path) {
          await supabase.storage.from('photos').remove([path]).catch(() => {});
        }
      }
      done++;
    } catch (e) {
      errors++;
      console.error(`bulk ${action} ${id}:`, e.message);
    }
    bulkCountEl.textContent = `Processando ${done + errors}/${ids.length}...`;
  }

  if (errors) {
    alert(`Concluído com ${errors} erro(s). Ver console.`);
  }

  // Refresh
  await loadPhotos();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

await loadPhotos();
