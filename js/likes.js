/* ==========================================================================
   Likes module — anonymous heart on lightbox photos
   - Hits the Cloudflare Worker for global counts (graceful no-op if unset)
   - localStorage prevents re-liking the same photo on the same browser
   - Click triggers a camera-flash + photo shake + heart pulse, all CSS keyframes
   ========================================================================== */

(function() {
  if (window.LR_LIKES) return;

  // Supabase backend. The publishable key is safe in the frontend because
  // RLS keeps the photo_likes table read-only for anon and writes go through
  // the SECURITY DEFINER function `increment_like` which clamps deltas.
  const SUPABASE_URL = 'https://junfgutjyicdrvpoyuzz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_GY-aCPbwOTu_BXGGGNx5rQ_Rmc_Nddb';
  const ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);

  function authHeaders() {
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    };
  }

  const LS_KEY = 'lr_liked_v1';
  const cache = Object.create(null);

  const PROMPTS = {
    pt: 'Gostou?',
    en: 'Liked it?',
    es: '¿Te gusta?',
  };

  function getLang() {
    const lang = (document.documentElement.lang || '').toLowerCase();
    if (lang.indexOf('en') === 0) return 'en';
    if (lang.indexOf('es') === 0) return 'es';
    return 'pt';
  }

  function loadLiked() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function saveLiked(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function normalizeId(src) {
    if (!src) return '';
    try {
      const u = new URL(src, window.location.href);
      const m = u.pathname.match(/\/images\/(.+)$/);
      return m ? 'images/' + m[1] : u.pathname.replace(/^\/+/, '');
    } catch (e) {
      return String(src);
    }
  }

  async function fetchCounts(ids) {
    if (!ENABLED || !ids || !ids.length) return {};
    try {
      const idsParam = ids.map(encodeURIComponent).join(',');
      const url = SUPABASE_URL + '/rest/v1/photo_likes?select=photo_id,count&photo_id=in.(' + idsParam + ')';
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return {};
      const rows = await res.json();
      const counts = {};
      rows.forEach(function(r) { counts[r.photo_id] = r.count; });
      Object.assign(cache, counts);
      return counts;
    } catch (e) {
      return {};
    }
  }

  async function postLike(id, action) {
    if (!ENABLED) return null;
    try {
      const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/increment_like', {
        method: 'POST',
        headers: Object.assign({}, authHeaders(), { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          p_photo_id: id,
          p_delta: action === 'add' ? 1 : -1,
        }),
      });
      if (!res.ok) return null;
      const value = await res.json();
      // RPC returning integer comes back as a bare number
      const count = typeof value === 'number' ? value : (value && value.count) || 0;
      cache[id] = count;
      return { id, count: count };
    } catch (e) {
      return null;
    }
  }

  function buildButton() {
    const btn = document.createElement('button');
    btn.className = 'lr-like';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Like');
    btn.setAttribute('aria-pressed', 'false');
    // Single path: camera body silhouette (with viewfinder bump) + lens circle.
    // fill-rule: evenodd makes the lens render as a hole when the body is
    // filled, so the same path reads as a clean camera in both states.
    btn.innerHTML =
      '<svg class="lr-like-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
        '<path class="lr-like-path" fill-rule="evenodd" ' +
          'd="M5 8 H8 L9.5 5.5 H14.5 L16 8 H19 A2 2 0 0 1 21 10 V18 A2 2 0 0 1 19 20 H5 A2 2 0 0 1 3 18 V10 A2 2 0 0 1 5 8 Z ' +
              'M8.5 14 A3.5 3.5 0 1 0 15.5 14 A3.5 3.5 0 1 0 8.5 14 Z" ' +
          'fill="none" stroke="currentColor" stroke-width="1.4" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg>' +
      '<span class="lr-like-count" aria-live="polite"></span>';
    return btn;
  }

  function buildFlash() {
    const flash = document.createElement('div');
    flash.className = 'lr-flash';
    flash.setAttribute('aria-hidden', 'true');
    return flash;
  }

  function attachToLightbox(opts) {
    const lightbox = opts && opts.lightbox;
    const getCurrentSrc = opts && opts.getCurrentSrc;
    const getImage = (opts && opts.getImage) || function() { return lightbox.querySelector('img'); };
    if (!lightbox || typeof getCurrentSrc !== 'function') return;
    if (lightbox.dataset.lrLikeAttached === '1') return;
    lightbox.dataset.lrLikeAttached = '1';

    // Wrap the img so the cluster (prompt + heart) is anchored to the photo
    // bounds rather than the viewport. The wrapper auto-sizes to the rendered
    // image because img has max-width/max-height and object-fit: contain.
    const img = getImage();
    let wrap = lightbox.querySelector('.lr-photo-wrap');
    if (img && !wrap) {
      wrap = document.createElement('div');
      wrap.className = 'lr-photo-wrap';
      img.parentElement.insertBefore(wrap, img);
      wrap.appendChild(img);
    }

    const cluster = document.createElement('div');
    cluster.className = 'lr-like-cluster';
    const prompt = document.createElement('span');
    prompt.className = 'lr-like-prompt';
    prompt.textContent = PROMPTS[getLang()] || PROMPTS.pt;
    const btn = buildButton();
    cluster.appendChild(prompt);
    cluster.appendChild(btn);
    (wrap || lightbox).appendChild(cluster);

    const flash = buildFlash();
    lightbox.appendChild(flash);

    const liked = loadLiked();

    function update() {
      const src = getCurrentSrc();
      if (!src) return;
      const id = normalizeId(src);
      btn.dataset.id = id;
      const isLiked = !!liked[id];
      btn.classList.toggle('liked', isLiked);
      btn.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
      const count = cache[id] || 0;
      const countEl = btn.querySelector('.lr-like-count');
      countEl.textContent = count > 0 ? String(count) : '';
    }

    function playFlash() {
      flash.classList.remove('lr-flashing');
      void flash.offsetWidth;
      flash.classList.add('lr-flashing');

      const img = getImage();
      if (img) {
        img.classList.remove('lr-shaking');
        void img.offsetWidth;
        img.classList.add('lr-shaking');
      }

      btn.classList.remove('lr-pulsing');
      void btn.offsetWidth;
      btn.classList.add('lr-pulsing');

      setTimeout(function() {
        flash.classList.remove('lr-flashing');
        if (img) img.classList.remove('lr-shaking');
        btn.classList.remove('lr-pulsing');
      }, 700);
    }

    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      const src = getCurrentSrc();
      if (!src) return;
      const id = normalizeId(src);
      const wasLiked = !!liked[id];

      if (wasLiked) {
        delete liked[id];
        cache[id] = Math.max(0, (cache[id] || 1) - 1);
      } else {
        liked[id] = true;
        cache[id] = (cache[id] || 0) + 1;
        playFlash();
      }
      saveLiked(liked);
      update();

      const result = await postLike(id, wasLiked ? 'remove' : 'add');
      if (result) update();
    });

    lightbox.addEventListener('lr:photo-changed', function() {
      update();
      const id = btn.dataset.id;
      if (id && ENABLED) fetchCounts([id]).then(update);
    });

    const obs = new MutationObserver(function() {
      if (lightbox.classList.contains('active')) {
        update();
        const id = btn.dataset.id;
        if (id && ENABLED) fetchCounts([id]).then(update);
      }
    });
    obs.observe(lightbox, { attributes: true, attributeFilter: ['class'] });
  }

  window.LR_LIKES = {
    attachToLightbox: attachToLightbox,
    fetchCounts: fetchCounts,
    normalizeId: normalizeId,
  };

  document.dispatchEvent(new Event('lr:likes-ready'));
})();
