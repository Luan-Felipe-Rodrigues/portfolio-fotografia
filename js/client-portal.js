/*
 * Portal do Cliente.
 *
 * Standalone: não usa main.js, dinâmic-render, likes, analytics. Vive
 * paralelo ao site público. Servido por:
 *   - /c/<slug>          → hits /404.html (fallback SPA do GitHub Pages)
 *   - /c/                → hits /c/index.html
 * Ambos carregam este JS, que lê o slug do pathname e chama a Edge
 * Function `client-portal`.
 *
 * No cookies. Uma vez que o slug é conhecido, guardo em sessionStorage
 * pra ações subsequentes (likes, comments, prints) sem re-parse.
 *
 * localStorage por-navegador previne múltiplos likes na mesma foto:
 * `lr_client_liked` = { [photoId]: true }.
 */

const INGEST_URL = 'https://junfgutjyicdrvpoyuzz.supabase.co/functions/v1/client-portal';
const SLUG_RE = /^[a-zA-Z0-9]{20,40}$/;

const root = document.getElementById('portal-root');
if (!root) throw new Error('portal-root missing');

const slugFromPath = (() => {
  const m = window.location.pathname.match(/^\/c\/([a-zA-Z0-9]{20,40})\/?$/);
  return m ? m[1] : null;
})();

if (!slugFromPath) {
  // Rendered from /c/ bare or /404.html for real 404s
  renderReal404();
} else {
  loadPortal(slugFromPath).catch((err) => {
    console.error(err);
    renderError('Não conseguimos carregar seu portal. Tente recarregar a página.');
  });
}

// ---------------------------------------------------------------------------

async function loadPortal(slug) {
  const res = await fetch(INGEST_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'load', slug })
  });

  if (res.status === 404) {
    renderError('Este link não é mais válido. Fale com o Luan pra receber um novo.');
    return;
  }
  if (res.status === 429) {
    renderError('Muitas tentativas. Aguarde alguns instantes e tente de novo.');
    return;
  }
  if (!res.ok) {
    renderError('Ocorreu um erro ao carregar. Tente recarregar a página.');
    return;
  }

  const data = await res.json();
  render(slug, data);
}

function render(slug, data) {
  const firstName = (data.client_name || '').split(' ')[0];
  const ensaios = data.ensaios || [];

  root.innerHTML = `
    <header class="portal-header">
      <div class="portal-header-inner">
        <p class="portal-eyebrow">Portal privado</p>
        <h1 class="portal-title">Olá, ${escapeHtml(firstName || data.client_name)}</h1>
        <p class="portal-sub">Suas fotos com Luan Rodrigues. Este link é seu, não compartilhe.</p>
      </div>
    </header>

    <main class="portal-main">
      ${ensaios.length ? ensaios.map(renderEnsaio).join('') :
        '<p class="portal-empty">Ainda não subi fotos aqui. Assim que subir você vê nesta página.</p>'}
    </main>

    <div id="lightbox" class="portal-lightbox" role="dialog" aria-modal="true" hidden>
      <button class="lb-close" aria-label="Fechar">×</button>
      <button class="lb-prev" aria-label="Anterior">‹</button>
      <button class="lb-next" aria-label="Próxima">›</button>
      <img id="lb-img" alt="">
      <div class="lb-actions">
        <button class="lb-action" data-kind="like" aria-label="Curtir">
          <span class="ico">♥</span><span class="count">0</span>
        </button>
        <button class="lb-action" data-kind="comment" aria-label="Comentar">
          <span class="ico">💬</span>
        </button>
        <button class="lb-action" data-kind="print_select" aria-label="Selecionar pra impressão">
          <span class="ico">🖨</span>
        </button>
        <button class="lb-action" data-kind="share" aria-label="Compartilhar">
          <span class="ico">↗</span>
        </button>
      </div>
      <div id="lb-comment" class="lb-comment" hidden>
        <textarea placeholder="Seu comentário sobre esta foto…" maxlength="2000"></textarea>
        <div class="lb-comment-actions">
          <button class="portal-btn ghost" data-cb="cancel">Cancelar</button>
          <button class="portal-btn" data-cb="save">Salvar comentário</button>
        </div>
      </div>
      <div id="lb-share" class="lb-share" hidden>
        <button class="portal-btn" data-share="whatsapp">Compartilhar no WhatsApp</button>
        <button class="portal-btn" data-share="download">Baixar imagem</button>
        <button class="portal-btn ghost" data-share="close">Fechar</button>
      </div>
    </div>

    <footer class="portal-footer">
      <p>© Luan Rodrigues Fotografia</p>
      <p class="footer-note">Sem cookies, sem tracking pessoal. Fotos privadas, não indexadas.</p>
    </footer>
  `;

  // Gather all photos in a flat list for lightbox navigation
  const allPhotos = [];
  for (const e of ensaios) {
    for (const p of e.photos || []) {
      allPhotos.push({ ...p, ensaio_id: e.id });
    }
  }

  wireGridClicks(slug, allPhotos);
  wireLightbox(slug, allPhotos);
}

function renderEnsaio(e) {
  const dateStr = e.ensaio_date ? formatDate(e.ensaio_date) : '';
  const photos = e.photos || [];
  const total = photos.length;
  return `
    <section class="ensaio-block" data-ensaio-id="${e.id}">
      <div class="ensaio-heading">
        <h2 class="ensaio-name">${escapeHtml(e.title)}</h2>
        ${dateStr ? `<span class="ensaio-date">${dateStr}</span>` : ''}
      </div>
      ${e.description ? `<p class="ensaio-desc">${escapeHtml(e.description)}</p>` : ''}
      ${photos.length ? `
        <div class="portal-grid" role="list">
          ${photos.map((p, i) => renderThumb(p, e.id, e.title, i + 1, total)).join('')}
        </div>
      ` : '<p class="portal-empty small">Sem fotos neste ensaio.</p>'}
    </section>
  `;
}

function renderThumb(p, ensaioId, ensaioTitle, position, total) {
  const badges = [
    p.likes ? `<span class="thumb-badge liked" aria-label="${p.likes} curtida${p.likes > 1 ? 's' : ''}">♥ ${p.likes}</span>` : '',
    p.has_comment ? '<span class="thumb-badge" aria-label="Comentada">💬</span>' : '',
    p.print_selected ? '<span class="thumb-badge" aria-label="Selecionada para impressão">🖨</span>' : ''
  ].filter(Boolean).join('');
  const label = `Foto ${position} de ${total}, ${ensaioTitle}. Abrir em tela cheia.`;
  return `
    <button type="button" class="portal-thumb" data-photo-id="${p.id}" data-ensaio-id="${ensaioId}" aria-label="${escapeHtml(label)}">
      <img src="${p.signed_url}" alt="" loading="lazy">
      ${badges ? `<div class="thumb-badges" aria-hidden="true">${badges}</div>` : ''}
    </button>
  `;
}

function wireGridClicks(slug, allPhotos) {
  document.querySelectorAll('.portal-thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      const photoId = btn.dataset.photoId;
      const idx = allPhotos.findIndex((p) => p.id === photoId);
      openLightbox(idx, slug, allPhotos);
    });
  });
}

let lbIndex = 0;
let lbPhotos = [];
let lbSlug = null;
let lbLastFocus = null;

function wireLightbox(slug, allPhotos) {
  lbSlug = slug;
  lbPhotos = allPhotos;
  const lb = document.getElementById('lightbox');
  const closeBtn = lb.querySelector('.lb-close');
  const prevBtn = lb.querySelector('.lb-prev');
  const nextBtn = lb.querySelector('.lb-next');

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));

  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') { closeLightbox(); return; }
    if (e.key === 'ArrowLeft') { navigate(-1); return; }
    if (e.key === 'ArrowRight') { navigate(1); return; }
    if (e.key === 'Tab') trapFocus(e, lb);
  });

  // Swipe on mobile
  let touchStartX = 0;
  lb.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 60) navigate(dx > 0 ? -1 : 1);
  }, { passive: true });

  lb.querySelectorAll('.lb-action').forEach((btn) => {
    btn.addEventListener('click', () => handleLbAction(btn.dataset.kind));
  });

  lb.querySelectorAll('[data-cb]').forEach((btn) => {
    btn.addEventListener('click', () => handleCommentBtn(btn.dataset.cb));
  });
  lb.querySelectorAll('[data-share]').forEach((btn) => {
    btn.addEventListener('click', () => handleShareBtn(btn.dataset.share));
  });
}

function openLightbox(idx, slug, photos) {
  lbIndex = idx;
  lbPhotos = photos;
  lbSlug = slug;
  lbLastFocus = document.activeElement;
  showCurrentPhoto();
  const lb = document.getElementById('lightbox');
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
  // Focus close button so keyboard users start inside the modal
  requestAnimationFrame(() => lb.querySelector('.lb-close')?.focus());
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.hidden = true;
  document.body.style.overflow = '';
  document.getElementById('lb-comment').hidden = true;
  document.getElementById('lb-share').hidden = true;
  // Return focus to the thumb that opened the lightbox
  if (lbLastFocus && typeof lbLastFocus.focus === 'function') lbLastFocus.focus();
}

function trapFocus(e, container) {
  const focusables = container.querySelectorAll(
    'button:not([hidden]):not([disabled]), textarea:not([hidden]):not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
  );
  const visible = Array.from(focusables).filter((el) => el.offsetParent !== null || el.tagName === 'TEXTAREA');
  if (!visible.length) return;
  const first = visible[0];
  const last = visible[visible.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function navigate(dir) {
  lbIndex = (lbIndex + dir + lbPhotos.length) % lbPhotos.length;
  showCurrentPhoto();
  document.getElementById('lb-comment').hidden = true;
  document.getElementById('lb-share').hidden = true;
}

function showCurrentPhoto() {
  const p = lbPhotos[lbIndex];
  const lbImg = document.getElementById('lb-img');
  lbImg.src = p.signed_url;
  lbImg.alt = `Foto ${lbIndex + 1} de ${lbPhotos.length}`;
  const likeBtn = document.querySelector('.lb-action[data-kind="like"]');
  likeBtn.querySelector('.count').textContent = p.likes || 0;
  likeBtn.classList.toggle('active', hasLikedLocal(p.id));
  likeBtn.setAttribute('aria-pressed', hasLikedLocal(p.id) ? 'true' : 'false');
  const printBtn = document.querySelector('.lb-action[data-kind="print_select"]');
  printBtn.classList.toggle('active', !!p.print_selected);
  printBtn.setAttribute('aria-pressed', p.print_selected ? 'true' : 'false');
  const commentBtn = document.querySelector('.lb-action[data-kind="comment"]');
  commentBtn.classList.toggle('active', !!p.has_comment);
  commentBtn.setAttribute('aria-pressed', p.has_comment ? 'true' : 'false');
  const lb = document.getElementById('lightbox');
  lb.setAttribute('aria-label', `Foto ${lbIndex + 1} de ${lbPhotos.length}`);
}

async function handleLbAction(kind) {
  if (kind === 'share') {
    document.getElementById('lb-share').hidden = false;
    return;
  }
  if (kind === 'comment') {
    const commentEl = document.getElementById('lb-comment');
    commentEl.hidden = !commentEl.hidden;
    if (!commentEl.hidden) commentEl.querySelector('textarea').focus();
    return;
  }
  const p = lbPhotos[lbIndex];
  if (kind === 'like') {
    if (hasLikedLocal(p.id)) return; // dedupe per browser
    markLikedLocal(p.id);
    p.likes = (p.likes || 0) + 1;
    showCurrentPhoto();
    await sendAction(kind, p);
    return;
  }
  if (kind === 'print_select') {
    if (p.print_selected) return; // already selected
    p.print_selected = true;
    showCurrentPhoto();
    await sendAction(kind, p);
    return;
  }
}

async function handleCommentBtn(cb) {
  const commentEl = document.getElementById('lb-comment');
  const textarea = commentEl.querySelector('textarea');
  if (cb === 'cancel') {
    textarea.value = '';
    commentEl.hidden = true;
    return;
  }
  if (cb === 'save') {
    const content = textarea.value.trim();
    if (!content) return;
    const p = lbPhotos[lbIndex];
    await sendAction('comment', p, content);
    p.has_comment = true;
    showCurrentPhoto();
    textarea.value = '';
    commentEl.hidden = true;
    flashPortalToast('Comentário salvo. Obrigado!');
    return;
  }
}

function handleShareBtn(action) {
  const shareEl = document.getElementById('lb-share');
  const p = lbPhotos[lbIndex];
  if (action === 'close') {
    shareEl.hidden = true;
    return;
  }
  if (action === 'whatsapp') {
    const text = `Olha essa foto minha com o Luan Rodrigues Fotografia: ${p.signed_url}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    shareEl.hidden = true;
    return;
  }
  if (action === 'download') {
    const a = document.createElement('a');
    a.href = p.signed_url;
    a.download = `luanrodrigues-${p.id.slice(0, 8)}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    shareEl.hidden = true;
    return;
  }
}

async function sendAction(kind, photo, content) {
  try {
    const body = {
      type: 'action',
      slug: lbSlug,
      ensaio_id: photo.ensaio_id,
      photo_id: photo.id,
      kind
    };
    if (content) body.content = content;
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    });
    if (!res.ok) console.warn(`action ${kind} failed:`, res.status);
  } catch (e) {
    console.error(`action ${kind}:`, e);
  }
}

// ---------------------------------------------------------------------------

function hasLikedLocal(photoId) {
  try {
    const raw = localStorage.getItem('lr_client_liked');
    if (!raw) return false;
    return !!JSON.parse(raw)[photoId];
  } catch { return false; }
}

function markLikedLocal(photoId) {
  try {
    const raw = localStorage.getItem('lr_client_liked') || '{}';
    const obj = JSON.parse(raw);
    obj[photoId] = true;
    localStorage.setItem('lr_client_liked', JSON.stringify(obj));
  } catch { /* noop */ }
}

function renderError(msg) {
  root.innerHTML = `
    <div class="portal-message">
      <h1>Ops.</h1>
      <p>${escapeHtml(msg)}</p>
    </div>
  `;
}

function renderReal404() {
  root.innerHTML = `
    <div class="portal-message">
      <h1>Página não encontrada</h1>
      <p>Volte pra <a href="/">luanrodrigues.photography</a>.</p>
    </div>
  `;
}

function flashPortalToast(msg) {
  let t = document.querySelector('.portal-toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'portal-toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function formatDate(iso) {
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
