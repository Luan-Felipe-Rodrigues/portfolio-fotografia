/* ==========================================================================
   Luan Rodrigues — Portfolio JS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initImageLoading();
  initScrollReveal();
  initLightbox();
  initSwipe();
});

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
    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.classList.toggle('active', isOpen);
      toggle.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // Set active link
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === current || (current === 'index.html' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

/* --- Image Loading (lazy + direct src) --- */
function initImageLoading() {
  const allImages = document.querySelectorAll('.gallery-item img');

  allImages.forEach(img => {
    // Image has data-src: lazy load
    if (img.dataset.src) {
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const target = entry.target;
              target.src = target.dataset.src;
              target.onload = () => target.classList.add('loaded');
              obs.unobserve(target);
            }
          });
        }, { rootMargin: '300px' });
        observer.observe(img);
      } else {
        img.src = img.dataset.src;
        img.classList.add('loaded');
      }
    }
    // Image has src directly: fade in when loaded
    else if (img.src || img.getAttribute('src')) {
      if (img.complete && img.naturalHeight > 0) {
        img.classList.add('loaded');
      } else {
        img.onload = () => img.classList.add('loaded');
        img.onerror = () => img.classList.add('loaded'); // show broken state vs invisible
      }
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

  // Open lightbox on image click
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      if (!img) return;

      const grid = item.closest('.gallery-grid, .series-detail-grid');
      if (!grid) return;

      currentImages = Array.from(grid.querySelectorAll('.gallery-item img'))
        .map(i => i.src || i.dataset.src)
        .filter(Boolean);

      const clickedSrc = img.src || img.dataset.src;
      currentIndex = currentImages.indexOf(clickedSrc);
      if (currentIndex === -1) currentIndex = 0;

      showImage();
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  function showImage() {
    if (currentImages[currentIndex]) {
      lightboxImg.src = currentImages[currentIndex];
      counter.textContent = (currentIndex + 1) + ' / ' + currentImages.length;
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
}

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
