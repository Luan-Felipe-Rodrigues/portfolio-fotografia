import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell, loadCollectionsForSelect } from './admin-shell.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');

const params = new URLSearchParams(window.location.search);
const ensaioId = params.get('ensaio');
const targetMode = ensaioId ? 'client' : 'public';

renderShell(targetMode === 'client' ? 'clients' : 'photos', session.user.email);

const targetEl = document.getElementById('collection-target');
const collectionField = targetEl?.closest('.field');
const isPublishedEl = document.getElementById('is-published');
const isHomeEl = document.getElementById('is-home-featured');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadsList = document.getElementById('uploads-list');

let clientEnsaio = null;

if (targetMode === 'client') {
  // Hide public toggles + collection dropdown, show ensaio badge
  if (collectionField) collectionField.style.display = 'none';
  if (isPublishedEl) isPublishedEl.closest('label').style.display = 'none';
  if (isHomeEl) isHomeEl.closest('label').style.display = 'none';

  const { data, error } = await supabase
    .from('client_ensaios')
    .select('id, title, description, client:clients(id, name, slug)')
    .eq('id', ensaioId)
    .single();
  if (error || !data) {
    dropZone.parentElement.insertAdjacentHTML('beforebegin',
      `<p class="placeholder error">Ensaio não encontrado.</p>`);
    throw new Error('ensaio not found');
  }
  clientEnsaio = data;

  const badge = document.createElement('div');
  badge.className = 'ensaio-target-badge';
  badge.innerHTML = `
    <div class="section-title">Enviando pra ensaio privado</div>
    <div><strong>${escapeHtml(clientEnsaio.client.name)}</strong> · ${escapeHtml(clientEnsaio.title)}</div>
    <a href="./client.html?id=${clientEnsaio.client.id}" class="button ghost">Voltar pro cliente</a>
  `;
  dropZone.parentElement.insertBefore(badge, dropZone.parentElement.firstChild);
} else {
  await loadCollectionsForSelect(targetEl, { includeEmpty: false });
}

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
  handleFiles(files);
});

async function handleFiles(files) {
  if (targetMode === 'public' && !targetEl.value) {
    alert('Escolha uma coleção antes de subir fotos.');
    return;
  }
  if (!files.length) return;
  for (const f of files) {
    // sequential upload — simpler status UI
    // eslint-disable-next-line no-await-in-loop
    await uploadOne(f);
  }
  fileInput.value = '';
}

async function uploadOne(file) {
  const row = document.createElement('div');
  row.className = 'upload-row';
  row.innerHTML = `
    <div class="upload-name">${escapeHtml(file.name)}</div>
    <div class="upload-status">Lendo dimensões...</div>
  `;
  uploadsList.prepend(row);
  const status = row.querySelector('.upload-status');

  try {
    const dims = await readDimensions(file);
    const uuid = crypto.randomUUID();
    const ext = extOf(file);

    if (targetMode === 'client') {
      const path = `${clientEnsaio.client.slug}/${ensaioId}/${uuid}.${ext}`;
      status.textContent = 'Enviando arquivo...';
      const { error: upErr } = await supabase.storage
        .from('client-photos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      status.textContent = 'Registrando no banco...';
      const { error: dbErr } = await supabase.from('client_photos').insert({
        ensaio_id: ensaioId,
        storage_path: path,
        width: dims.width,
        height: dims.height,
        taken_at: null,
        display_order: 0,
        is_visible: true
      });
      if (dbErr) throw dbErr;

      row.innerHTML = `
        <div class="upload-name">${escapeHtml(file.name)}</div>
        <div class="upload-status ok">Enviado pro ensaio.</div>
      `;
    } else {
      const targetOpt = targetEl.selectedOptions[0];
      const collectionId = targetOpt.value;
      const collectionSlug = targetOpt.dataset.slug;
      const year = new Date().getFullYear();
      const path = `${collectionSlug}/${year}/${uuid}.${ext}`;

      status.textContent = 'Enviando arquivo...';
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      status.textContent = 'Registrando no banco...';
      const { data: photoId, error: rpcError } = await supabase.rpc('create_photo', {
        p_collection_id: collectionId,
        p_storage_path: path,
        p_width: dims.width,
        p_height: dims.height,
        p_alt_pt: null,
        p_alt_en: null,
        p_alt_es: null,
        p_display_order: 0,
        p_is_published: isPublishedEl.checked,
        p_is_home_featured: isHomeEl.checked,
        p_taken_at: null
      });
      if (rpcError) throw rpcError;

      row.innerHTML = `
        <div class="upload-name">${escapeHtml(file.name)}</div>
        <div class="upload-status ok">Enviado. <a href="./edit.html?id=${photoId}">editar metadados</a></div>
      `;
    }
  } catch (e) {
    row.innerHTML = `
      <div class="upload-name">${escapeHtml(file.name)}</div>
      <div class="upload-status error">Falhou: ${escapeHtml(e.message || String(e))}</div>
    `;
  }
}

function readDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler as dimensões da imagem'));
    };
    img.src = url;
  });
}

function extOf(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.webp')) return 'webp';
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().replace(/[^a-z0-9]/g, '') : 'bin';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
