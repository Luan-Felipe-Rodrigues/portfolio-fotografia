import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell, STORAGE_RENDER } from './admin-shell.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('photos', session.user.email);

const contentEl = document.getElementById('edit-content');
const photoId = new URL(window.location.href).searchParams.get('id');

if (!photoId) {
  contentEl.innerHTML = '<p class="placeholder error">ID da foto ausente na URL.</p>';
  throw new Error('missing id');
}

try {
  const [photoRes, colsRes] = await Promise.all([
    supabase.from('photos').select('*').eq('id', photoId).single(),
    supabase
      .from('collections')
      .select('id, slug, parent_slug, name_pt, display_order')
      .order('parent_slug', { nullsFirst: true, ascending: true })
      .order('display_order')
  ]);

  if (photoRes.error) throw photoRes.error;
  if (colsRes.error) throw colsRes.error;

  render(photoRes.data, colsRes.data);
} catch (e) {
  contentEl.innerHTML = `<p class="placeholder error">Erro: ${escapeHtml(e.message)}</p>`;
}

function render(p, cols) {
  const preview = `${STORAGE_RENDER}/${p.storage_path}?width=600&quality=80`;

  contentEl.innerHTML = `
    <div class="edit-layout">
      <div class="edit-preview">
        <img src="${preview}" alt="${escapeHtml(p.alt_pt || '')}">
        <p class="dims muted">${p.width} × ${p.height} px</p>
        <p class="dims muted">Storage: <code>${escapeHtml(p.storage_path)}</code></p>
      </div>

      <form id="edit-form" class="edit-form">
        <label class="field">
          Coleção
          <select name="collection_id" required>
            ${cols.map((c) => `
              <option value="${c.id}" ${c.id === p.collection_id ? 'selected' : ''}>
                ${c.parent_slug ? '   → ' : ''}${escapeHtml(c.name_pt)}
              </option>
            `).join('')}
          </select>
        </label>

        <label class="field">
          Alt PT
          <input name="alt_pt" value="${escapeAttr(p.alt_pt || '')}" placeholder="Descrição em português">
        </label>
        <label class="field">
          Alt EN
          <input name="alt_en" value="${escapeAttr(p.alt_en || '')}" placeholder="Description in English">
        </label>
        <label class="field">
          Alt ES
          <input name="alt_es" value="${escapeAttr(p.alt_es || '')}" placeholder="Descripción en español">
        </label>

        <div class="row two">
          <label class="field">
            Ordem
            <input name="display_order" type="number" step="10" value="${p.display_order}">
          </label>
          <label class="field">
            Data da foto
            <input name="taken_at" type="date" value="${p.taken_at || ''}">
          </label>
        </div>

        <label class="checkbox">
          <input name="is_published" type="checkbox" ${p.is_published ? 'checked' : ''}>
          Publicada (visível pra visitantes)
        </label>
        <label class="checkbox">
          <input name="is_home_featured" type="checkbox" ${p.is_home_featured ? 'checked' : ''}>
          Featured na home
        </label>

        <div class="form-actions">
          <button type="submit" class="button">Salvar</button>
          <a href="./photos.html" class="button ghost">Voltar</a>
          <button type="button" class="button ghost" id="archive-btn">${p.is_archived ? 'Restaurar' : 'Arquivar'}</button>
          <button type="button" class="button danger" id="delete-btn">Excluir</button>
        </div>
        <p id="save-status" class="status" role="status" aria-live="polite"></p>
      </form>
    </div>
  `;

  const form = document.getElementById('edit-form');
  const status = document.getElementById('save-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.classList.remove('error');
    status.textContent = 'Salvando...';

    const fd = new FormData(form);
    const { error } = await supabase.rpc('update_photo', {
      p_id: photoId,
      p_collection_id: fd.get('collection_id'),
      p_alt_pt: (fd.get('alt_pt') || '').trim() || null,
      p_alt_en: (fd.get('alt_en') || '').trim() || null,
      p_alt_es: (fd.get('alt_es') || '').trim() || null,
      p_display_order: parseInt(fd.get('display_order'), 10),
      p_is_published: fd.get('is_published') === 'on',
      p_is_home_featured: fd.get('is_home_featured') === 'on',
      p_taken_at: fd.get('taken_at') || null
    });

    if (error) {
      status.textContent = 'Erro: ' + error.message;
      status.classList.add('error');
      return;
    }
    status.textContent = 'Salvo.';
  });

  document.getElementById('archive-btn').addEventListener('click', async () => {
    const targetState = !p.is_archived;
    const label = targetState ? 'arquivar' : 'restaurar';
    if (!confirm(`Confirma ${label} esta foto?`)) return;
    const { error } = await supabase.rpc('set_photo_archived', { p_id: photoId, p_archived: targetState });
    if (error) {
      alert('Erro: ' + error.message);
      return;
    }
    window.location.replace('./photos.html');
  });

  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!confirm('Excluir esta foto? Não dá pra desfazer.')) return;
    const { data: path, error } = await supabase.rpc('delete_photo', { p_id: photoId });
    if (error) {
      alert('Erro: ' + error.message);
      return;
    }
    if (path) {
      const { error: storageErr } = await supabase.storage.from('photos').remove([path]);
      if (storageErr) console.warn('Falha ao apagar objeto do storage:', storageErr.message);
    }
    window.location.replace('./photos.html');
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}
