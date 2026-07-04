/* ==========================================================================
   Luan Rodrigues — Portfolio JS
   ========================================================================== */

// Load the likes module on every page (no-op on pages without a lightbox).
// Done once at script eval time so DOMContentLoaded handlers can rely on it.
(function loadLikes() {
  if (window.LR_LIKES || document.getElementById('lr-likes-loader')) return;
  const isSubdir = window.location.pathname.includes('/en/') || window.location.pathname.includes('/es/');
  const s = document.createElement('script');
  s.id = 'lr-likes-loader';
  s.src = (isSubdir ? '../' : '') + 'js/likes.js';
  s.async = false;
  document.head.appendChild(s);
})();

// Load analytics placeholder on every page. Sprint 2 turns the console.debug
// calls into real beacons; contract stays stable so callers don't change.
(function loadAnalytics() {
  if (window.LR_ANALYTICS || document.getElementById('lr-analytics-loader')) return;
  const isSubdir = window.location.pathname.includes('/en/') || window.location.pathname.includes('/es/');
  const s = document.createElement('script');
  s.id = 'lr-analytics-loader';
  s.src = (isSubdir ? '../' : '') + 'js/analytics.js';
  s.async = false;
  document.head.appendChild(s);
})();

// Load Supabase public client + dynamic-render module. Both are no-op unless
// LR_DYNAMIC.isEnabled() is true (?dynamic=1 or the post-switchover default).
(function loadDynamic() {
  const isSubdir = window.location.pathname.includes('/en/') || window.location.pathname.includes('/es/');
  const prefix = isSubdir ? '../' : '';
  if (!window.LR_SUPABASE && !document.getElementById('lr-supabase-loader')) {
    const s1 = document.createElement('script');
    s1.id = 'lr-supabase-loader';
    s1.src = prefix + 'js/supabase-public.js';
    s1.async = false;
    document.head.appendChild(s1);
  }
  if (!window.LR_DYNAMIC && !document.getElementById('lr-dynamic-loader')) {
    const s2 = document.createElement('script');
    s2.id = 'lr-dynamic-loader';
    s2.src = prefix + 'js/dynamic-render.js';
    s2.async = false;
    document.head.appendChild(s2);
  }
})();

function whenDynamicReady(cb) {
  if (window.LR_DYNAMIC && window.LR_SUPABASE) return cb();
  const seen = { d: !!window.LR_DYNAMIC, s: !!window.LR_SUPABASE };
  function check() { if (seen.d && seen.s) cb(); }
  if (!seen.d) document.addEventListener('lr:dynamic-ready', () => { seen.d = true; check(); }, { once: true });
  if (!seen.s) document.addEventListener('lr:supabase-ready', () => { seen.s = true; check(); }, { once: true });
}

// Runs cb once dynamic-render.js has loaded (LR_DYNAMIC defined). Does NOT
// wait for the Supabase client. Useful when we only need to check the flag
// (isEnabled) before deciding between dynamic and static paths.
function whenDynamicLoaded(cb) {
  if (window.LR_DYNAMIC) return cb();
  document.addEventListener('lr:dynamic-ready', () => cb(), { once: true });
}

function whenLikesReady(cb) {
  if (window.LR_LIKES) cb();
  else document.addEventListener('lr:likes-ready', cb, { once: true });
}

document.addEventListener('DOMContentLoaded', () => {
  initHomeGallery();
  initSeriesDynamic();
  initSeriesIndexDynamic();
  initAboutDecoration();
  initFooterNote();
  initNav();
  initLocationNav();
  initMasonry();
  initImageLoading();
  initScrollReveal();
  initHeroAnimation();
  initScatterToGrid();
  initScrollVideo();
  initLightbox();
  initSwipe();
});



/* --- Home Gallery: random selection + parallax --- */
function initHomeGallery() {
  const top = document.getElementById('showcase-top');
  const bottom = document.getElementById('showcase-bottom');
  if (!top || !bottom) return;

  // Wait for dynamic-render.js to load, then decide. Without this wait, the
  // check would fall through to the static path because dynamic-render.js is
  // loaded asynchronously and DOMContentLoaded fires first.
  whenDynamicLoaded(() => {
    if (window.LR_DYNAMIC && window.LR_DYNAMIC.isEnabled()) {
      initHomeGalleryDynamic(top, bottom);
    } else {
      initHomeGalleryStatic(top, bottom);
    }
  });
}

function initHomeGalleryStatic(top, bottom) {
  const isSubdir = window.location.pathname.includes('/en/') || window.location.pathname.includes('/es/');
  const prefix = isSubdir ? '../' : '';
  const lang = document.documentElement.lang;

  let lugaresLink = lang === 'en' ? 'series-lugares.html' : 'series-lugares.html';
  let preweddingLink = 'series-prewedding.html';
  let autoralLink = lang === 'en' ? 'series-autoral.html' : 'series-autoral.html';

  const collections = [
    { link: lugaresLink, photos: ['images/lugares/cinque-terre/IMG_5895.jpeg', 'images/lugares/cinque-terre/IMG_5896.jpeg', 'images/lugares/cinque-terre/IMG_5897.jpeg'] },
    { link: lugaresLink, photos: ['images/lugares/toscana/IMG_5881.jpeg', 'images/lugares/toscana/IMG_5883.jpeg', 'images/lugares/toscana/IMG_5886.jpeg'] },
    { link: lugaresLink, photos: ['images/lugares/roma/IMG_5889.jpeg', 'images/lugares/roma/IMG_5891.jpeg', 'images/lugares/roma/IMG_5893.jpeg'] },
    { link: lugaresLink, photos: ['images/lugares/santos/IMG_2948.jpg', 'images/lugares/santos/IMG_2965.jpg', 'images/lugares/santos/IMG_3179.jpg'] },
    { link: lugaresLink, photos: ['images/lugares/serra-negra/IMG_7608.jpg', 'images/lugares/serra-negra/IMG_7657.jpg', 'images/lugares/serra-negra/IMG_7682.jpg', 'images/lugares/serra-negra/IMG_7703.jpg'] },
    { link: lugaresLink, photos: ['images/lugares/nova-york/IMG_4480.jpg', 'images/lugares/nova-york/IMG_4481.jpg'] },
    { link: lugaresLink, photos: ['images/lugares/rio-de-janeiro/IMG-20221112-WA0001.jpg', 'images/lugares/rio-de-janeiro/IMG-20221112-WA0003.jpg'] },
    { link: autoralLink, photos: ['images/autoral/maio-2026/IMG_6345.jpg', 'images/autoral/maio-2026/IMG_7385.jpg', 'images/autoral/maio-2026/IMG_7399.jpg', 'images/autoral/maio-2026/IMG_7406.jpg', 'images/autoral/maio-2026/IMG_7417.jpg', 'images/autoral/maio-2026/IMG_7452.jpg', 'images/autoral/maio-2026/IMG_7460.jpg', 'images/autoral/maio-2026/IMG_7479.jpg', 'images/autoral/maio-2026/IMG_7501.jpg', 'images/autoral/maio-2026/IMG_7546.jpg', 'images/autoral/maio-2026/IMG_7555.jpg', 'images/autoral/maio-2026/IMG_7561.jpg', 'images/autoral/maio-2026/IMG_7593.jpg', 'images/autoral/maio-2026/IMG_7597.jpg', 'images/autoral/maio-2026/IMG_7598.jpg', 'images/autoral/maio-2026/IMG_7600.jpg', 'images/autoral/maio-2026/IMG_7601.jpg', 'images/autoral/maio-2026/IMG_7706.jpg', 'images/autoral/maio-2026/IMG_7707.jpg', 'images/autoral/maio-2026/IMG_7713.jpg', 'images/autoral/maio-2026/IMG_7714.jpg', 'images/autoral/maio-2026/IMG_7716.jpg', 'images/autoral/abril-2026/IMG_7287.jpg', 'images/autoral/abril-2026/IMG_7289.jpg', 'images/autoral/abril-2026/IMG_7291.jpg', 'images/autoral/abril-2026/IMG_7294.jpg', 'images/autoral/abril-2026/IMG_7339.jpg', 'images/autoral/abril-2026/IMG_7347.jpg', 'images/autoral/abril-2026/IMG_7370.jpg', 'images/autoral/abril-2026/IMG_7374.jpg', 'images/autoral/marco-2026/IMG_7208.jpg', 'images/autoral/marco-2026/IMG_7213.jpg', 'images/autoral/marco-2026/IMG_7229.jpg', 'images/autoral/marco-2026/IMG_7234.jpg', 'images/autoral/marco-2026/IMG_7248.jpg', 'images/autoral/marco-2026/IMG_7255.jpg', 'images/autoral/2024-2025/IMG_3192.jpg', 'images/autoral/2024-2025/IMG_4400.jpg', 'images/autoral/2024-2025/IMG_4518.jpg', 'images/autoral/2024-2025/IMG_2850.jpg', 'images/autoral/2024-2025/autoral_01.jpg', 'images/autoral/2024-2025/autoral_02.jpg', 'images/autoral/2024-2025/autoral_03.jpg', 'images/autoral/2024-2025/autoral_04.jpg', 'images/autoral/2024-2025/autoral_05.jpg', 'images/autoral/2024-2025/autoral_06.jpg', 'images/autoral/2024-2025/autoral_07.jpg', 'images/autoral/2024-2025/autoral_08.jpg', 'images/autoral/2024-2025/autoral_09.jpg', 'images/autoral/2024-2025/autoral_10.jpg', 'images/autoral/2024-2025/autoral_11.jpg', 'images/autoral/2024-2025/autoral_12.jpg', 'images/autoral/2024-2025/autoral_13.jpg', 'images/autoral/2024-2025/autoral_14.jpg', 'images/autoral/2024-2025/autoral_15.jpg', 'images/autoral/2024-2025/autoral_16.jpg', 'images/autoral/2024-2025/autoral_17.jpg', 'images/autoral/2024-2025/autoral_18.jpg', 'images/autoral/2024-2025/autoral_19.jpg', 'images/autoral/2024-2025/autoral_20.jpg'] },
    { link: preweddingLink, photos: ['images/prewedding/IMG_5147.jpg', 'images/prewedding/IMG_5298.jpg', 'images/prewedding/IMG_6052.jpg', 'images/prewedding/IMG_6192.jpg', 'images/prewedding/IMG_6193.jpg', 'images/prewedding/IMG_7191.jpg'] },
  ];

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Pick 1 random photo from each collection, shuffle, split into 2 groups
  const selected = shuffle(
    collections.map(c => ({
      src: c.photos[Math.floor(Math.random() * c.photos.length)],
      link: c.link,
    }))
  );

  const half = Math.ceil(selected.length / 2);
  const topItems = selected.slice(0, half);
  const bottomItems = selected.slice(half);

  function buildItems(container, items) {
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'showcase-item reveal';
      const a = document.createElement('a');
      a.href = item.link;
      const img = document.createElement('img');
      img.src = prefix + item.src;
      img.alt = '';
      img.loading = 'lazy';
      a.appendChild(img);
      div.appendChild(a);
      container.appendChild(div);
    });
  }

  buildItems(top, topItems);
  buildItems(bottom, bottomItems);

  // Re-init scroll reveal for new items
  initScrollReveal();
}

/* --- Footer privacy note (LGPD-friendly reassurance) --- */
function initFooterNote() {
  const footers = document.querySelectorAll('footer');
  if (!footers.length) return;
  const locale = (window.LR_DYNAMIC && window.LR_DYNAMIC.locale) ? window.LR_DYNAMIC.locale() :
    (window.location.pathname.startsWith('/en/') ? 'en' :
     window.location.pathname.startsWith('/es/') ? 'es' : 'pt');
  const NOTE = {
    pt: 'Sem cookies, sem tracking pessoal — apenas contagem anônima de visitas.',
    en: 'No cookies, no personal tracking — anonymous visit counts only.',
    es: 'Sin cookies, sin tracking personal — solo conteo anónimo de visitas.'
  };
  footers.forEach((f) => {
    if (f.querySelector('.footer-note')) return;
    const p = document.createElement('p');
    p.className = 'footer-note';
    p.textContent = NOTE[locale] || NOTE.pt;
    f.appendChild(p);
  });
}

/* --- About page decoration photos (dynamic) --- */
function initAboutDecoration() {
  const imgs = document.querySelectorAll('.about-stack-item img');
  if (!imgs.length) return;
  whenDynamicLoaded(() => {
    if (!window.LR_DYNAMIC || !window.LR_DYNAMIC.isEnabled()) return;
    runAboutDecoration(imgs);
  });
}

function runAboutDecoration(imgs) {

  // Infer target collection from the existing static src.
  function collectionFor(src) {
    if (!src) return null;
    const m = src.match(/lugares\/([^/]+)\//);
    if (!m) return null;
    const sub = m[1] === 'rio-de-janeiro' ? 'rio' : m[1];
    return `lugares-${sub}`;
  }

  whenDynamicReady(async () => {
    for (const img of imgs) {
      const slug = collectionFor(img.getAttribute('src'));
      if (!slug) continue;
      try {
        const sb = window.LR_SUPABASE;
        const { data: col } = await sb.from('collections').select('id').eq('slug', slug).maybeSingle();
        if (!col) continue;
        const { data: photos } = await sb.from('photos')
          .select('storage_path')
          .eq('collection_id', col.id)
          .eq('is_published', true)
          .eq('is_archived', false)
          .order('display_order')
          .limit(1);
        if (photos && photos.length) {
          img.src = window.LR_DYNAMIC.imageUrl(photos[0].storage_path, { width: 1400, quality: 82 });
        }
      } catch (e) {
        console.error(`[about-deco] ${slug}:`, e);
      }
    }
  });
}

/* --- Series index cards (dynamic) --- */
function initSeriesIndexDynamic() {
  const cards = document.querySelectorAll('.series-card');
  if (!cards.length) return;
  whenDynamicLoaded(() => {
    if (!window.LR_DYNAMIC || !window.LR_DYNAMIC.isEnabled()) return;
    runSeriesIndexDynamic(cards);
  });
}

function runSeriesIndexDynamic(cards) {

  const SLUG_BY_HREF = {
    'series-lugares.html': 'lugares',
    'series-autoral.html': 'autoral',
    'series-prewedding.html': 'prewedding',
    'series-eventos.html': 'eventos'
  };

  whenDynamicReady(async () => {
    for (const card of cards) {
      const href = (card.getAttribute('href') || '').split('/').pop();
      const parentSlug = SLUG_BY_HREF[href];
      if (!parentSlug) continue;
      try {
        const sb = window.LR_SUPABASE;
        // Pick a home_featured photo of any leaf collection under this parent.
        const { data: subs } = await sb.from('collections').select('id, slug').or(`slug.eq.${parentSlug},parent_slug.eq.${parentSlug}`);
        const ids = (subs || []).map((s) => s.id);
        if (!ids.length) continue;
        let { data: photos } = await sb.from('photos').select('storage_path').eq('is_home_featured', true).eq('is_published', true).eq('is_archived', false).in('collection_id', ids).limit(1);
        if (!photos || !photos.length) {
          // fallback: any published photo
          ({ data: photos } = await sb.from('photos').select('storage_path').eq('is_published', true).eq('is_archived', false).in('collection_id', ids).order('display_order').limit(1));
        }
        if (!photos || !photos.length) continue;
        const img = card.querySelector('img');
        if (img) img.src = window.LR_DYNAMIC.imageUrl(photos[0].storage_path, { width: 1200, quality: 82 });
      } catch (e) {
        console.error(`[series-index] falha em ${href}:`, e);
      }
    }
  });
}

/* --- Series pages (dynamic, ?dynamic=1) --- */
function initSeriesDynamic() {
  const path = window.location.pathname;
  let type = null;
  if (path.includes('series-autoral')) type = 'autoral';
  else if (path.includes('series-prewedding')) type = 'prewedding';
  else if (path.includes('series-lugares')) type = 'lugares';
  else if (path.includes('series-eventos')) type = 'eventos';
  if (!type) return;

  whenDynamicLoaded(() => {
    if (!window.LR_DYNAMIC || !window.LR_DYNAMIC.isEnabled()) return;
    runSeriesDynamic(type);
  });
}

function runSeriesDynamic(type) {

  whenDynamicReady(async () => {
    try {
      if (type === 'prewedding') {
        await renderFlatSeries('prewedding');
      } else if (type === 'eventos') {
        await renderEventosSeries();
      } else {
        await renderGroupedSeries(type);
      }
      // Re-init effects that depend on DOM. Each of these is idempotent —
      // initLightbox skips items already flagged via dataset.
      initMasonry();
      initImageLoading();
      initScrollReveal();
      initLocationNav();
      initLightbox();
    } catch (err) {
      console.error('[series dynamic] falhou:', err);
    }
  });
}

function galleryItemFor(p) {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  const img = document.createElement('img');
  img.src = window.LR_DYNAMIC.imageUrl(p.storage_path, { width: 1400, quality: 82 });
  img.dataset.fullSrc = window.LR_DYNAMIC.imageUrl(p.storage_path, { width: 2200, quality: 85 });
  img.alt = window.LR_DYNAMIC.altFor(p);
  img.loading = 'lazy';
  img.dataset.photoId = p.id;
  item.appendChild(img);
  return item;
}

async function renderFlatSeries(slug) {
  const result = await window.LR_DYNAMIC.fetchByCollectionSlug(slug);
  const grid = document.querySelector('.gallery-section .gallery-grid') || document.querySelector('.gallery-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const p of result.photos) grid.appendChild(galleryItemFor(p));
}

async function renderGroupedSeries(parentSlug) {
  const groups = await window.LR_DYNAMIC.fetchByParentSlug(parentSlug);

  // Sort groups by "most recent first". Two-step key:
  // 1. If the sub-collection name encodes a date ("Maio 2026", "2024-2025"),
  //    use that as the sort date. This respects the photographer's folder
  //    labels even when EXIF taken_at is misleading (old photos reprocessed
  //    in a "Abril 2026" folder still belong to that period label).
  // 2. Otherwise use MAX(taken_at) across the group's photos.
  const MONTHS_PT = { janeiro: '01', fevereiro: '02', 'março': '03', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };

  function nameSortKey(name) {
    if (!name) return null;
    const low = name.toLowerCase().trim();
    const monthYear = low.match(/^([a-zãç]+)\s+(\d{4})$/i);
    if (monthYear && MONTHS_PT[monthYear[1]]) {
      return `${monthYear[2]}-${MONTHS_PT[monthYear[1]]}-31`;
    }
    const range = low.match(/^(\d{4})[-–](\d{4})$/);
    if (range) return `${range[2]}-12-31`;
    const singleYear = low.match(/^(\d{4})$/);
    if (singleYear) return `${singleYear[1]}-12-31`;
    return null;
  }

  function maxTaken(group) {
    let max = null;
    for (const p of group.photos) {
      if (p.taken_at && (!max || p.taken_at > max)) max = p.taken_at;
    }
    return max;
  }

  function sortKey(group) {
    return nameSortKey(group.collection.name_pt) || maxTaken(group);
  }

  groups.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka && kb) return kb.localeCompare(ka);
    if (ka) return -1;
    if (kb) return 1;
    return 0;
  });

  // Sections live directly under <main> or <body>. Capture the anchor and
  // the element that FOLLOWS the last section so new sections keep their
  // place (before footer / lightbox / trailing scripts).
  const sections = document.querySelectorAll('.gallery-section');
  if (!sections.length) return;
  const lastSection = sections[sections.length - 1];
  const anchor = lastSection.parentElement;
  const before = lastSection.nextSibling;
  sections.forEach((s) => s.remove());

  const locNav = document.querySelector('.location-nav-inner');
  if (locNav) locNav.innerHTML = '';

  const loc = window.LR_DYNAMIC.locale();
  for (const g of groups) {
    if (!g.photos.length) continue;
    const col = g.collection;
    const prefix = `${parentSlug}-`;
    const sectionId = col.slug.startsWith(prefix) ? col.slug.slice(prefix.length) : col.slug;

    const section = document.createElement('section');
    section.className = 'gallery-section';
    section.id = sectionId;
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    for (const p of g.photos) grid.appendChild(galleryItemFor(p));
    section.appendChild(grid);
    anchor.insertBefore(section, before);

    if (locNav) {
      const link = document.createElement('a');
      link.className = 'location-nav-item';
      link.href = `#${sectionId}`;
      link.textContent = loc === 'en' ? (col.name_en || col.name_pt) : loc === 'es' ? (col.name_es || col.name_pt) : col.name_pt;
      locNav.appendChild(link);
    }
  }
}

async function renderEventosSeries() {
  const result = await window.LR_DYNAMIC.fetchByCollectionSlug('eventos');
  const byYear = new Map();
  for (const p of result.photos) {
    const year = p.taken_at ? p.taken_at.slice(0, 4) : 'sem-data';
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(p);
  }
  const years = Array.from(byYear.keys()).sort().reverse();

  const sections = document.querySelectorAll('.gallery-section');
  if (!sections.length) return;
  const lastSection = sections[sections.length - 1];
  const anchor = lastSection.parentElement;
  const before = lastSection.nextSibling;
  sections.forEach((s) => s.remove());

  const locNav = document.querySelector('.location-nav-inner');
  if (locNav) locNav.innerHTML = '';

  for (const year of years) {
    const sectionId = year === 'sem-data' ? 'sem-data' : `y${year}`;
    const section = document.createElement('section');
    section.className = 'gallery-section';
    section.id = sectionId;
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    for (const p of byYear.get(year)) grid.appendChild(galleryItemFor(p));
    section.appendChild(grid);
    anchor.insertBefore(section, before);

    if (locNav) {
      const link = document.createElement('a');
      link.className = 'location-nav-item';
      link.href = `#${sectionId}`;
      link.textContent = year === 'sem-data' ? 'Sem data' : year;
      locNav.appendChild(link);
    }
  }
}

/* --- Home Gallery (dynamic, ?dynamic=1) --- */
function initHomeGalleryDynamic(top, bottom) {
  whenDynamicReady(async () => {
    try {
      const photos = await window.LR_DYNAMIC.fetchHomePhotos();
      if (!photos.length) {
        top.innerHTML = '<p class="placeholder">Nenhuma foto marcada como home.</p>';
        return;
      }

      // Group by collection slug and pick 1 random per group, mimicking the
      // static behavior. Fall back to individual photos if grouping is empty.
      const byCollection = new Map();
      for (const p of photos) {
        const slug = p.collection?.slug || p.collection?.parent_slug || 'other';
        if (!byCollection.has(slug)) byCollection.set(slug, []);
        byCollection.get(slug).push(p);
      }
      const picked = [];
      for (const group of byCollection.values()) {
        picked.push(group[Math.floor(Math.random() * group.length)]);
      }

      // Shuffle across collections
      for (let i = picked.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [picked[i], picked[j]] = [picked[j], picked[i]];
      }

      const half = Math.ceil(picked.length / 2);
      const isSubdir = window.location.pathname.includes('/en/') || window.location.pathname.includes('/es/');
      const prefix = isSubdir ? '' : ''; // series links are relative to the current dir

      function linkFor(photo) {
        const parent = photo.collection?.parent_slug || photo.collection?.slug;
        if (parent === 'autoral') return 'series-autoral.html';
        if (parent === 'prewedding') return 'series-prewedding.html';
        if (parent === 'eventos') return 'series-eventos.html';
        return 'series-lugares.html'; // default for lugares and unknown
      }

      function buildItems(container, items) {
        items.forEach((p) => {
          const div = document.createElement('div');
          div.className = 'showcase-item reveal';
          const a = document.createElement('a');
          a.href = linkFor(p);
          const img = document.createElement('img');
          img.src = window.LR_DYNAMIC.imageUrl(p.storage_path, { width: 1200, quality: 80 });
          img.alt = window.LR_DYNAMIC.altFor(p);
          img.loading = 'lazy';
          img.dataset.photoId = p.id;
          a.appendChild(img);
          div.appendChild(a);
          container.appendChild(div);
        });
      }

      buildItems(top, picked.slice(0, half));
      buildItems(bottom, picked.slice(half));
      initScrollReveal();
    } catch (err) {
      console.error('[home dynamic] falhou, mantendo vazio:', err);
    }
  });
}

/* --- Navigation --- */
function initNav() {
  const nav = document.querySelector('nav');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  // Shrink nav on scroll
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  // Mobile menu
  if (toggle && links) {
    // Move menu overlay to body so it escapes nav's stacking context
    const langSwitcher = document.querySelector('.nav-lang');
    if (window.innerWidth <= 768) {
      document.body.appendChild(links);
      if (langSwitcher) document.body.appendChild(langSwitcher);
    }

    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.classList.toggle('active', isOpen);
      toggle.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
      if (langSwitcher) langSwitcher.classList.toggle('open', isOpen);
    });

    // Close menu on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        if (langSwitcher) langSwitcher.classList.remove('open');
      });
    });
  }

  // Set active link
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    const isMatch = href === current
      || (current.startsWith('series') && href.startsWith('series.'))
      || (current.startsWith('trabalho') && href.startsWith('trabalho'))
      || (current.startsWith('work') && href.startsWith('work'))
      || (current.startsWith('trabajo') && href.startsWith('trabajo'));
    if (isMatch) a.classList.add('active');
  });
}

/* --- Location Nav (smooth scroll + floating beacon) --- */
function initLocationNav() {
  const locNav = document.querySelector('.location-nav');
  if (!locNav) return;

  const links = locNav.querySelectorAll('a');

  // Build sections list from links
  const sections = [];
  links.forEach(link => {
    const id = link.getAttribute('href').replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      const label = link.textContent.trim();
      sections.push({ id, el, label });
    }
  });

  // Smooth scroll on link click
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('href').replace('#', '');
      const target = document.getElementById(id);
      if (!target) return;

      const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
      const y = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;

      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  // Create floating beacon with expandable menu (left side)
  if (!sections.length) return;

  const beacon = document.createElement('div');
  beacon.className = 'location-beacon';

  let menuHTML = '<div class="location-beacon-menu">';
  menuHTML += `<a href="#location-index" data-id="location-index" class="beacon-index">Menu</a>`;
  sections.forEach(s => {
    menuHTML += `<a href="#${s.id}" data-id="${s.id}">${s.label}</a>`;
  });
  menuHTML += '</div>';

  beacon.innerHTML = menuHTML +
    '<button class="location-beacon-toggle">' +
    '<span class="location-beacon-current"></span>' +
    '<span class="location-beacon-arrow">&#9650;</span>' +
    '</button>';

  document.body.appendChild(beacon);

  const toggle = beacon.querySelector('.location-beacon-toggle');
  const currentLabel = beacon.querySelector('.location-beacon-current');
  const menuLinks = beacon.querySelectorAll('.location-beacon-menu a');

  toggle.addEventListener('click', () => {
    beacon.classList.toggle('open');
  });

  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      beacon.classList.remove('open');

      if (link.dataset.id === 'location-index') {
        const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
        const y = locNav.getBoundingClientRect().top + window.scrollY - navHeight - 16;
        window.scrollTo({ top: y, behavior: 'smooth' });
        return;
      }

      const target = document.getElementById(link.dataset.id);
      if (!target) return;

      const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
      const y = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  document.addEventListener('click', (e) => {
    if (!beacon.contains(e.target)) {
      beacon.classList.remove('open');
    }
  });

  let ticking = false;
  function onScroll() {
    const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
    const locNavBottom = locNav.getBoundingClientRect().bottom;
    const pastMenu = locNavBottom < navHeight;

    beacon.classList.toggle('visible', pastMenu);

    if (pastMenu) {
      const offset = navHeight + 100;
      let activeId = sections[0].id;
      for (const s of sections) {
        if (s.el.getBoundingClientRect().top <= offset) {
          activeId = s.id;
        }
      }

      const active = sections.find(s => s.id === activeId);
      if (active) currentLabel.textContent = active.label;

      menuLinks.forEach(link => {
        link.classList.toggle('beacon-active', link.dataset.id === activeId);
      });
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });

  onScroll();
}

/* --- Masonry Layout --- */
function initMasonry() {
  const grids = document.querySelectorAll('.gallery-grid');
  if (!grids.length) return;

  const ROW_HEIGHT = 4; // matches grid-auto-rows: 4px

  function resizeItem(item) {
    const img = item.querySelector('img');
    if (!img) return;

    const setSpan = () => {
      const colWidth = item.offsetWidth;
      if (!colWidth || !img.naturalWidth) return;
      const gap = parseFloat(getComputedStyle(item.parentElement).columnGap) || 4;
      const imgHeight = (img.naturalHeight / img.naturalWidth) * colWidth;
      const span = Math.ceil((imgHeight + gap) / ROW_HEIGHT);
      item.style.gridRowEnd = 'span ' + span;
    };

    if (img.complete && img.naturalHeight > 0) {
      setSpan();
    } else {
      img.addEventListener('load', setSpan);
    }
  }

  function layoutGrid() {
    grids.forEach(grid => {
      grid.querySelectorAll('.gallery-item').forEach(resizeItem);
    });
  }

  layoutGrid();
  window.addEventListener('resize', layoutGrid);
}

/* --- Image Loading + Scroll Reveal for Gallery Items --- */
function initImageLoading() {
  const items = document.querySelectorAll('.gallery-item');
  // Skip scroll reveal for items inside scatter-active grids (GSAP handles those)
  const scatterActive = document.querySelector('.gallery-grid.scatter-active');

  let revealQueue = [];
  let revealTimer = null;

  function processQueue() {
    revealQueue.forEach((item, i) => {
      setTimeout(() => item.classList.add('visible'), i * 80);
    });
    revealQueue = [];
    revealTimer = null;
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        revealQueue.push(entry.target);
        revealObserver.unobserve(entry.target);
        if (!revealTimer) {
          revealTimer = setTimeout(processQueue, 50);
        }
      }
    });
  }, { threshold: 0.1, rootMargin: '50px' });

  items.forEach(item => {
    const img = item.querySelector('img');
    if (!img) return;

    // Set up image loading (always needed)
    if (img.dataset.src) {
      const loadObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.src = entry.target.dataset.src;
            entry.target.onload = () => initMasonry();
            obs.unobserve(entry.target);
          }
        });
      }, { rootMargin: '300px' });
      loadObserver.observe(img);
    } else if (img.src) {
      if (!img.complete) {
        img.onload = () => initMasonry();
      }
    }

    // Only use CSS reveal for items NOT in scatter grid
    if (!scatterActive || !scatterActive.contains(item)) {
      revealObserver.observe(item);
    }
  });
}

/* --- Scroll Reveal --- */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    elements.forEach(el => observer.observe(el));
  } else {
    elements.forEach(el => el.classList.add('visible'));
  }
}

/* --- Lightbox --- */
function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const lightboxImg = lightbox.querySelector('img');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');

  // Create counter element
  let counter = lightbox.querySelector('.lightbox-counter');
  if (!counter) {
    counter = document.createElement('div');
    counter.className = 'lightbox-counter';
    lightbox.appendChild(counter);
  }

  let currentImages = [];
  let currentIndex = 0;

  // Open lightbox on image click (skip items that are links to series).
  // Idempotent: dataset flag prevents double-attaching when re-init runs
  // after dynamic render.
  document.querySelectorAll('.gallery-item:not(.gallery-link)').forEach(item => {
    if (item.dataset.lbAttached === '1') return;
    item.dataset.lbAttached = '1';
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      if (!img) return;

      const grid = item.closest('.gallery-grid, .series-detail-grid');
      if (!grid) return;

      currentImages = Array.from(grid.querySelectorAll('.gallery-item img'))
        .filter(i => i.src || i.dataset.src || i.dataset.fullSrc)
        .map(i => ({
          src: i.dataset.fullSrc || i.src || i.dataset.src,
          photoId: i.dataset.photoId || null
        }));

      const clickedSrc = img.dataset.fullSrc || img.src || img.dataset.src;
      currentIndex = currentImages.findIndex(it => it.src === clickedSrc);
      if (currentIndex === -1) currentIndex = 0;

      showImage();
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  function showImage() {
    const item = currentImages[currentIndex];
    if (item) {
      lightboxImg.src = item.src;
      if (item.photoId) lightboxImg.dataset.photoId = item.photoId;
      else delete lightboxImg.dataset.photoId;
      counter.textContent = (currentIndex + 1) + ' / ' + currentImages.length;
      lightbox.dispatchEvent(new Event('lr:photo-changed'));
      if (item.photoId && window.LR_ANALYTICS) {
        window.LR_ANALYTICS.trackPhotoView(item.photoId, 'lightbox');
      }
    }
  }

  function navigate(direction) {
    currentIndex = (currentIndex + direction + currentImages.length) % currentImages.length;
    showImage();
  }

  // Controls
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigate(-1); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigate(1); });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  // Click outside image
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Expose navigate for swipe
  lightbox._navigate = navigate;
  lightbox._close = closeLightbox;

  // Attach the like button (no-op if the likes module isn't ready or API isn't set)
  whenLikesReady(() => {
    window.LR_LIKES.attachToLightbox({
      lightbox: lightbox,
      getCurrentSrc: () => lightboxImg.src,
      getImage: () => lightboxImg,
    });
  });
}

/* --- Hero Text Animation (sequential word fade-in) --- */
function initHeroAnimation() {
  const title = document.querySelector('.hero-title');
  if (!title) return;

  // Split title into word spans
  const text = title.textContent.trim();
  title.innerHTML = text.split(/\s+/).map(word =>
    `<span class="word">${word}</span>`
  ).join(' ');

  const words = title.querySelectorAll('.word');

  // Words fade in sequentially
  words.forEach((word, i) => {
    setTimeout(() => {
      word.classList.add('visible');
    }, 300 + i * 280);
  });

  // Phrase fades in after all words
  const phrase = document.querySelector('.hero-phrase');
  if (phrase) {
    setTimeout(() => {
      phrase.classList.add('visible');
    }, 300 + words.length * 280 + 400);
  }
}

/* --- Scatter-to-Grid Animation (GSAP ScrollTrigger) --- */
function initScatterToGrid() {
  // Only run on home page (has .hero + .gallery-grid)
  if (!document.querySelector('.hero') || typeof gsap === 'undefined') return;

  const grid = document.querySelector('.gallery-grid');
  if (!grid) return;

  const items = grid.querySelectorAll('.gallery-item');
  if (!items.length) return;

  // Mark grid as scatter-active (overrides default reveal animation)
  grid.classList.add('scatter-active');

  gsap.registerPlugin(ScrollTrigger);

  // Wait for images to load so masonry positions are set
  function onReady() {
    // Mark items for GSAP control, removing CSS overrides
    items.forEach(item => item.classList.add('gsap-animated'));

    items.forEach((item, i) => {
      // Random scatter values — like photos tossed on a table
      const randomX = gsap.utils.random(-120, 120);
      const randomY = gsap.utils.random(-60, 60);
      const randomRotation = gsap.utils.random(-12, 12);

      gsap.fromTo(item,
        {
          x: randomX,
          y: randomY,
          rotation: randomRotation,
          opacity: 0,
        },
        {
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: item,
            start: 'top 92%',
            end: 'top 55%',
            toggleActions: 'play none none none',
          },
          delay: (i % 3) * 0.1,
        }
      );
    });
  }

  // Check if all home gallery images are loaded
  const images = grid.querySelectorAll('img');
  let loaded = 0;
  const total = images.length;

  if (total === 0) { onReady(); return; }

  images.forEach(img => {
    if (img.complete && img.naturalHeight > 0) {
      loaded++;
      if (loaded >= total) onReady();
    } else {
      img.addEventListener('load', () => {
        loaded++;
        if (loaded >= total) onReady();
      });
      img.addEventListener('error', () => {
        loaded++;
        if (loaded >= total) onReady();
      });
    }
  });
}

/* --- Scroll-driven Video (About page) --- */
function initScrollVideo() {
  const video = document.getElementById('about-video');
  if (!video) return;

  // Mobile: no video, poster image shown via CSS
  if (window.innerWidth <= 1024) return;

  if (typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  function attachScrub() {
    const duration = video.duration;
    if (!duration || isNaN(duration)) return;

    const section = document.getElementById('about-section');
    if (!section) return;

    gsap.to(video, {
      currentTime: duration,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.5,
      },
    });
  }

  // Wait until first frame is decoded so scrubbing doesn't briefly blank the video
  if (video.readyState >= 3) {
    attachScrub();
  } else {
    video.addEventListener('canplay', attachScrub, { once: true });
  }
}

/* --- Scroll Indicator (hide on scroll) --- */
(function() {
  var indicator = document.getElementById('scroll-indicator');
  if (!indicator) return;
  window.addEventListener('scroll', function hide() {
    if (window.scrollY > 30) {
      indicator.classList.add('hidden');
      window.removeEventListener('scroll', hide);
    }
  }, { passive: true });
})();

/* --- Swipe support for lightbox on mobile --- */
function initSwipe() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  let startX = 0;
  let startY = 0;
  let distX = 0;
  let distY = 0;

  lightbox.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });

  lightbox.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    distX = touch.clientX - startX;
    distY = touch.clientY - startY;
  }, { passive: true });

  lightbox.addEventListener('touchend', () => {
    const threshold = 60;
    const isHorizontal = Math.abs(distX) > Math.abs(distY);

    if (isHorizontal && Math.abs(distX) > threshold) {
      if (distX > 0) {
        lightbox._navigate && lightbox._navigate(-1); // swipe right = prev
      } else {
        lightbox._navigate && lightbox._navigate(1);  // swipe left = next
      }
    } else if (!isHorizontal && distY > threshold) {
      // swipe down = close
      lightbox._close && lightbox._close();
    }

    distX = 0;
    distY = 0;
  }, { passive: true });
}
