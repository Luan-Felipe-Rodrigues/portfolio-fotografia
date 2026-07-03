import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell, loadCollectionsForSelect } from './admin-shell.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('upload', session.user.email);

const targetEl = document.getElementById('collection-target');
const isPublishedEl = document.getElementById('is-published');
const isHomeEl = document.getElementById('is-home-featured');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadsList = document.getElementById('uploads-list');

await loadCollectionsForSelect(targetEl, { includeEmpty: false });

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
  if (!targetEl.value) {
    alert('Escolha uma coleção antes de subir fotos.');
    return;
  }
  if (!files.length) return;
  for (const f of files) {
    // sequential upload — simpler status UI, avoids clogging the free tier
    // eslint-disable-next-line no-await-in-loop
    await uploadOne(f);
  }
  fileInput.value = '';
}

async function uploadOne(file) {
  const targetOpt = targetEl.selectedOptions[0];
  const collectionId = targetOpt.value;
  const collectionSlug = targetOpt.dataset.slug;

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
    const year = new Date().getFullYear();
    const path = `${collectionSlug}/${year}/${uuid}.${extOf(file)}`;

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
