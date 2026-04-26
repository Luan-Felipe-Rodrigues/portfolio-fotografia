/* ==========================================================================
   All Work — Draggable photo grid (seamless infinite horizontal loop)
   ========================================================================== */

(function() {
  const grid = document.getElementById('all-work-grid');
  const container = document.getElementById('all-work-container');
  const workspace = document.getElementById('all-work');
  const hint = document.getElementById('all-work-hint');
  if (!grid || !container || !workspace) return;

  // Detect path prefix
  const isSubdir = window.location.pathname.includes('/en/') || window.location.pathname.includes('/es/');
  const prefix = isSubdir ? '../' : '';

  // All photos (no corporate events)
  const photos = [
    // Cinque Terre
    'images/lugares/cinque-terre/IMG_5895.jpeg',
    'images/lugares/cinque-terre/IMG_5896.jpeg',
    'images/lugares/cinque-terre/IMG_5897.jpeg',
    // Toscana
    'images/lugares/italia/IMG_5855.jpeg',
    'images/lugares/italia/IMG_5857.jpeg',
    'images/lugares/italia/IMG_5858.jpeg',
    'images/lugares/italia/IMG_5880.jpeg',
    'images/lugares/italia/IMG_5881.jpeg',
    'images/lugares/italia/IMG_5883.jpeg',
    'images/lugares/italia/IMG_5885.jpeg',
    'images/lugares/italia/IMG_5886.jpeg',
    'images/lugares/italia/IMG_5898.jpeg',
    'images/lugares/italia/IMG_5900.jpeg',
    'images/lugares/italia/IMG_5902.jpeg',
    'images/lugares/italia/IMG_5905.jpeg',
    // Roma
    'images/lugares/roma/IMG_5888.jpeg',
    'images/lugares/roma/IMG_5889.jpeg',
    'images/lugares/roma/IMG_5890.jpeg',
    'images/lugares/roma/IMG_5891.jpeg',
    'images/lugares/roma/IMG_5892.jpeg',
    'images/lugares/roma/IMG_5893.jpeg',
    'images/lugares/roma/IMG_5894.jpeg',
    // Santos
    'images/lugares/santos/IMG_2917.jpg',
    'images/lugares/santos/IMG_2933.jpg',
    'images/lugares/santos/IMG_2941.jpg',
    'images/lugares/santos/IMG_2948.jpg',
    'images/lugares/santos/IMG_2957.jpg',
    'images/lugares/santos/IMG_2965.jpg',
    'images/lugares/santos/IMG_2991.jpg',
    'images/lugares/santos/IMG_3005.jpg',
    'images/lugares/santos/IMG_3039.jpg',
    'images/lugares/santos/IMG_3054.jpg',
    'images/lugares/santos/IMG_3080.jpg',
    'images/lugares/santos/IMG_3107.jpg',
    'images/lugares/santos/IMG_3148.jpg',
    'images/lugares/santos/IMG_3179.jpg',
    'images/lugares/santos/IMG_4396.jpg',
    'images/lugares/santos/IMG_4473.jpg',
    'images/lugares/santos/IMG_5876.jpeg',
    'images/lugares/santos/IMG_5877.jpeg',
    // Nova York
    'images/lugares/nova-york/IMG_4480.jpg',
    'images/lugares/nova-york/IMG_4481.jpg',
    'images/lugares/nova-york/IMG_5860.jpg.jpg',
    'images/lugares/nova-york/IMG_5861.jpg.jpg',
    // Mexico
    'images/lugares/mexico/IMG_5863.jpeg',
    'images/lugares/mexico/IMG_5864.jpeg',
    'images/lugares/mexico/IMG_5866.jpeg',
    'images/lugares/mexico/IMG_5868.jpeg',
    'images/lugares/mexico/IMG_5870.jpeg',
    'images/lugares/mexico/IMG_5871.jpeg',
    'images/lugares/mexico/IMG_5874.jpeg',
    // Rio de Janeiro
    'images/lugares/rio-de-janeiro/IMG-20221112-WA0001.jpeg.jpg',
    'images/lugares/rio-de-janeiro/IMG-20221112-WA0003.jpg.jpg',
    // Pre-Wedding
    'images/prewedding/IMG_4449.jpg',
    'images/prewedding/IMG_4944.jpg',
    'images/prewedding/IMG_4980.jpg',
    'images/prewedding/IMG_5147.jpg',
    'images/prewedding/IMG_5190.jpg',
    'images/prewedding/IMG_5298.jpg',
    'images/prewedding/IMG_5429.jpg',
    'images/prewedding/IMG_5431.jpg',
    'images/prewedding/IMG_5741.jpg',
    'images/prewedding/IMG_6052.jpg',
    'images/prewedding/IMG_6192.jpg',
    'images/prewedding/IMG_6193.jpg',
    'images/prewedding/IMG_6360.jpg',
    'images/prewedding/IMG_7191.jpg',
    // Autoral - Abril 2026
    'images/autoral/abril-2026/IMG_7287.jpg',
    'images/autoral/abril-2026/IMG_7289.jpg',
    'images/autoral/abril-2026/IMG_7291.jpg',
    'images/autoral/abril-2026/IMG_7294.jpg',
    'images/autoral/abril-2026/IMG_7339.jpg',
    'images/autoral/abril-2026/IMG_7347.jpg',
    'images/autoral/abril-2026/IMG_7370.jpg',
    'images/autoral/abril-2026/IMG_7374.jpg',
    // Autoral - Março 2026
    'images/autoral/marco-2026/IMG_7208.jpg',
    'images/autoral/marco-2026/IMG_7213.jpg',
    'images/autoral/marco-2026/IMG_7229.jpg',
    'images/autoral/marco-2026/IMG_7234.jpg',
    'images/autoral/marco-2026/IMG_7248.jpg',
    'images/autoral/marco-2026/IMG_7255.jpg',
    // Autoral - 2024-2025
    'images/autoral/2024-2025/IMG_3192.jpeg.jpg',
    'images/autoral/2024-2025/IMG_4400.jpeg.jpg',
    'images/autoral/2024-2025/IMG_4518.HEIC.jpg',
    'images/autoral/2024-2025/IMG_2850.jpg',
    'images/autoral/2024-2025/autoral_01.jpg',
    'images/autoral/2024-2025/autoral_02.jpg',
    'images/autoral/2024-2025/autoral_03.jpg',
    'images/autoral/2024-2025/autoral_04.jpg',
    'images/autoral/2024-2025/autoral_05.jpg',
    'images/autoral/2024-2025/autoral_06.jpg',
    'images/autoral/2024-2025/autoral_07.jpg',
    'images/autoral/2024-2025/autoral_08.jpg',
    'images/autoral/2024-2025/autoral_09.jpg',
    'images/autoral/2024-2025/autoral_10.jpg',
    'images/autoral/2024-2025/autoral_11.jpg',
    'images/autoral/2024-2025/autoral_12.jpg',
    'images/autoral/2024-2025/autoral_13.jpg',
    'images/autoral/2024-2025/autoral_14.jpg',
    'images/autoral/2024-2025/autoral_15.jpg',
    'images/autoral/2024-2025/autoral_16.jpg',
    'images/autoral/2024-2025/autoral_17.jpg',
    'images/autoral/2024-2025/autoral_18.jpg',
    'images/autoral/2024-2025/autoral_19.jpg',
    'images/autoral/2024-2025/autoral_20.jpg',
  ];

  // Shuffle
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Build grid with staggered entrance
  const shuffled = shuffle(photos);
  shuffled.forEach(function(src, i) {
    var item = document.createElement('div');
    item.className = 'all-work-item';
    item.style.animationDelay = (0.1 + i * 0.015) + 's';
    var img = document.createElement('img');
    img.src = prefix + src;
    img.alt = '';
    img.loading = 'lazy';
    img.draggable = false;
    item.appendChild(img);
    grid.appendChild(item);
  });

  // Clone grid horizontally for seamless infinite loop. The clone shows
  // already-faded-in items so the join between original and clone is invisible.
  var grid2 = grid.cloneNode(true);
  grid2.querySelectorAll('.all-work-item').forEach(function(item) {
    item.style.animation = 'none';
    item.style.opacity = '1';
    item.style.transform = 'none';
  });
  container.appendChild(grid2);
  container.style.display = 'flex';
  container.style.flexDirection = 'row';

  // --- Drag / drift state ---
  var isDragging = false;
  var hasInteracted = false;
  var startX = 0, startY = 0;
  var translateX = 0, translateY = 0;
  var currentX = 0, currentY = 0;
  var hasMoved = false;

  // Center the grid (single grid in viewport), then normalize X into the
  // wrap-safe range (-gridW, 0].
  function centerGrid() {
    var gridW = grid.offsetWidth;
    var gridH = grid.offsetHeight;
    var viewW = workspace.offsetWidth;
    var viewH = workspace.offsetHeight;
    translateX = -(gridW - viewW) / 2;
    translateY = -(gridH - viewH) / 2;
    while (translateX <= -gridW) translateX += gridW;
    while (translateX > 0) translateX -= gridW;
    currentX = translateX;
    currentY = translateY;
    container.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px)';
  }

  centerGrid();

  // Debounced resize so initial-paint reflows don't trigger multiple snap-backs
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(centerGrid, 150);
  });

  // Y is finite (clamped); X wraps infinitely.
  function clampY() {
    var gridH = grid.offsetHeight;
    var viewH = workspace.offsetHeight;
    var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
    var minY = -(gridH - viewH + navH + 16);
    var maxY = navH;
    translateY = Math.max(minY, Math.min(maxY, translateY));
  }

  // Wrap translateX into (-gridW, 0]. Adjusts currentX (so the visual jump
  // lands on identical content in the clone) and startX (so an in-progress
  // drag continues smoothly across the seam).
  function wrapX() {
    var gridW = grid.offsetWidth;
    while (translateX <= -gridW) {
      translateX += gridW;
      currentX += gridW;
      startX -= gridW;
    }
    while (translateX > 0) {
      translateX -= gridW;
      currentX -= gridW;
      startX += gridW;
    }
  }

  // Auto-drift: ambient leftward motion, only until the user takes over.
  // Deferred 1.2s so it doesn't fight the initial center / entrance animations.
  var autoDrift = false;
  var driftSpeed = -0.3;
  setTimeout(function() {
    if (!hasInteracted) autoDrift = true;
  }, 1200);

  function markInteraction() {
    hasInteracted = true;
    autoDrift = false;
    if (hint && !hint.classList.contains('hidden')) hint.classList.add('hidden');
  }

  // Mouse
  workspace.addEventListener('mousedown', function(e) {
    isDragging = true;
    hasMoved = false;
    markInteraction();
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
  });
  window.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    hasMoved = true;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    clampY();
  });
  window.addEventListener('mouseup', function() {
    isDragging = false;
  });

  // Touch
  workspace.addEventListener('touchstart', function(e) {
    isDragging = true;
    hasMoved = false;
    markInteraction();
    var touch = e.touches[0];
    startX = touch.clientX - translateX;
    startY = touch.clientY - translateY;
  }, { passive: true });
  workspace.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    hasMoved = true;
    var touch = e.touches[0];
    translateX = touch.clientX - startX;
    translateY = touch.clientY - startY;
    clampY();
  }, { passive: true });
  workspace.addEventListener('touchend', function() {
    isDragging = false;
  }, { passive: true });

  // Keyboard arrows: tuned to ~8 px/frame so holding a key feels like panning,
  // not teleporting (was 80 — ~75 viewports/sec).
  var arrowSpeed = 8;
  var keysDown = {};
  document.addEventListener('keydown', function(e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) === -1) return;
    if (lightbox && lightbox.classList.contains('active')) return;
    e.preventDefault();
    keysDown[e.key] = true;
    markInteraction();
  });
  document.addEventListener('keyup', function(e) {
    delete keysDown[e.key];
  });

  // Single animation loop
  function animate() {
    if (keysDown['ArrowLeft'])  translateX += arrowSpeed;
    if (keysDown['ArrowRight']) translateX -= arrowSpeed;
    if (keysDown['ArrowUp'])    { translateY += arrowSpeed; clampY(); }
    if (keysDown['ArrowDown'])  { translateY -= arrowSpeed; clampY(); }

    if (autoDrift && !isDragging) {
      translateX += driftSpeed;
    }

    wrapX();

    currentX += (translateX - currentX) * 0.15;
    currentY += (translateY - currentY) * 0.15;
    container.style.transform = 'translate(' + currentX + 'px, ' + currentY + 'px)';
    requestAnimationFrame(animate);
  }
  animate();

  // --- Lightbox ---
  var lightbox = document.createElement('div');
  lightbox.className = 'allwork-lightbox';
  lightbox.innerHTML = '<img src="" alt="">' +
    '<button class="allwork-lb-close">&times;</button>' +
    '<button class="allwork-lb-prev">&#8249;</button>' +
    '<button class="allwork-lb-next">&#8250;</button>' +
    '<div class="allwork-lb-counter"></div>';
  document.body.appendChild(lightbox);

  var lbImg = lightbox.querySelector('img');
  var lbCounter = lightbox.querySelector('.allwork-lb-counter');
  var lbIndex = 0;
  var lbPhotos = shuffled.map(function(s) { return prefix + s; });

  function lbShow() {
    lbImg.src = lbPhotos[lbIndex];
    lbCounter.textContent = (lbIndex + 1) + ' / ' + lbPhotos.length;
    lightbox.dispatchEvent(new Event('lr:photo-changed'));
  }

  function lbOpen(src) {
    lbIndex = lbPhotos.indexOf(src);
    if (lbIndex === -1) lbIndex = 0;
    lbShow();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function lbClose() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function lbNav(dir) {
    lbIndex = (lbIndex + dir + lbPhotos.length) % lbPhotos.length;
    lbShow();
  }

  // Click on photo (not drag). Listens on container so clone clicks also work.
  container.addEventListener('click', function(e) {
    if (hasMoved) return;
    var item = e.target.closest('.all-work-item');
    if (!item) return;
    var img = item.querySelector('img');
    if (img) lbOpen(img.src);
  });

  lightbox.querySelector('.allwork-lb-close').addEventListener('click', lbClose);
  lightbox.querySelector('.allwork-lb-prev').addEventListener('click', function(e) { e.stopPropagation(); lbNav(-1); });
  lightbox.querySelector('.allwork-lb-next').addEventListener('click', function(e) { e.stopPropagation(); lbNav(1); });
  lightbox.addEventListener('click', function(e) { if (e.target === lightbox) lbClose(); });

  document.addEventListener('keydown', function(e) {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') lbClose();
    if (e.key === 'ArrowLeft') lbNav(-1);
    if (e.key === 'ArrowRight') lbNav(1);
  });

  // Swipe (mobile)
  var touchStartX = 0, touchStartY = 0, touchDistX = 0, touchDistY = 0;
  lightbox.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  lightbox.addEventListener('touchmove', function(e) {
    touchDistX = e.touches[0].clientX - touchStartX;
    touchDistY = e.touches[0].clientY - touchStartY;
  }, { passive: true });
  lightbox.addEventListener('touchend', function() {
    if (Math.abs(touchDistX) > Math.abs(touchDistY) && Math.abs(touchDistX) > 60) {
      lbNav(touchDistX > 0 ? -1 : 1);
    } else if (touchDistY > 60) {
      lbClose();
    }
    touchDistX = 0; touchDistY = 0;
  }, { passive: true });

  // Attach the like button. main.js has already kicked off the likes.js loader,
  // so we just wait for it to be ready before wiring up.
  function attachLikes() {
    if (!window.LR_LIKES) return;
    window.LR_LIKES.attachToLightbox({
      lightbox: lightbox,
      getCurrentSrc: function() { return lbImg.src; },
      getImage: function() { return lbImg; },
    });
  }
  if (window.LR_LIKES) attachLikes();
  else document.addEventListener('lr:likes-ready', attachLikes, { once: true });
})();
