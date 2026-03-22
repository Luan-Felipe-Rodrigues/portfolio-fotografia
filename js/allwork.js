/* ==========================================================================
   All Work — Draggable photo grid
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
    // Autoral
    'images/autoral/IMG_3192.jpeg.jpg',
    'images/autoral/IMG_4400.jpeg.jpg',
    'images/autoral/IMG_4518.HEIC.jpg',
    'images/autoral/IMG_2850.jpg',
    'images/autoral/autoral_01.jpg',
    'images/autoral/autoral_02.jpg',
    'images/autoral/autoral_03.jpg',
    'images/autoral/autoral_04.jpg',
    'images/autoral/autoral_05.jpg',
    'images/autoral/autoral_06.jpg',
    'images/autoral/autoral_07.jpg',
    'images/autoral/autoral_08.jpg',
    'images/autoral/autoral_09.jpg',
    'images/autoral/autoral_10.jpg',
    'images/autoral/autoral_11.jpg',
    'images/autoral/autoral_12.jpg',
    'images/autoral/autoral_13.jpg',
    'images/autoral/autoral_14.jpg',
    'images/autoral/autoral_15.jpg',
    'images/autoral/autoral_16.jpg',
    'images/autoral/autoral_17.jpg',
    'images/autoral/autoral_18.jpg',
    'images/autoral/autoral_19.jpg',
    'images/autoral/autoral_20.jpg',
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

  // --- Drag to pan ---
  var isDragging = false;
  var startX = 0, startY = 0;
  var translateX = 0, translateY = 0;
  var currentX = 0, currentY = 0;
  var hasMoved = false;

  // Center the grid initially
  function centerGrid() {
    var gridW = grid.offsetWidth;
    var gridH = grid.offsetHeight;
    var viewW = workspace.offsetWidth;
    var viewH = workspace.offsetHeight;
    translateX = -(gridW - viewW) / 2;
    translateY = -(gridH - viewH) / 2;
    currentX = translateX;
    currentY = translateY;
    container.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px)';
  }

  // Wait for a few images then center
  var loadCount = 0;
  var imgs = grid.querySelectorAll('img');
  function checkCenter() {
    loadCount++;
    if (loadCount >= Math.min(8, imgs.length)) centerGrid();
  }
  imgs.forEach(function(img) {
    if (img.complete) checkCenter();
    else img.addEventListener('load', checkCenter);
  });
  // Fallback
  setTimeout(centerGrid, 500);

  // Clamp bounds
  function clamp() {
    var gridW = grid.offsetWidth;
    var gridH = grid.offsetHeight;
    var viewW = workspace.offsetWidth;
    var viewH = workspace.offsetHeight;
    var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;

    var minX = -(gridW - viewW + 16);
    var maxX = 16;
    var minY = -(gridH - viewH + navH + 16);
    var maxY = navH;

    translateX = Math.max(minX, Math.min(maxX, translateX));
    translateY = Math.max(minY, Math.min(maxY, translateY));
  }

  // Auto-drift until user interacts
  var autoDrift = true;
  var driftSpeed = -0.3; // px per frame, negative = moves left

  // Smooth animation
  var animId;
  function animate() {
    if (autoDrift && !isDragging) {
      translateX += driftSpeed;
      clamp();
    }
    currentX += (translateX - currentX) * 0.15;
    currentY += (translateY - currentY) * 0.15;
    container.style.transform = 'translate(' + currentX + 'px, ' + currentY + 'px)';
    animId = requestAnimationFrame(animate);
  }
  animate();

  function stopDrift() {
    autoDrift = false;
  }

  // Mouse events
  workspace.addEventListener('mousedown', function(e) {
    isDragging = true;
    hasMoved = false;
    stopDrift();
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
  });

  window.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    hasMoved = true;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    clamp();
    // Hide hint on first drag
    if (hint && !hint.classList.contains('hidden')) {
      hint.classList.add('hidden');
    }
  });

  window.addEventListener('mouseup', function() {
    isDragging = false;
  });

  // Touch events
  workspace.addEventListener('touchstart', function(e) {
    isDragging = true;
    hasMoved = false;
    stopDrift();
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
    clamp();
    if (hint && !hint.classList.contains('hidden')) {
      hint.classList.add('hidden');
    }
  }, { passive: true });

  workspace.addEventListener('touchend', function() {
    isDragging = false;
  }, { passive: true });

  // Recenter on resize
  window.addEventListener('resize', centerGrid);
})();
