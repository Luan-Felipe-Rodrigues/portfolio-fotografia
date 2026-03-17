/* ==========================================================================
   Luan Rodrigues — Portfolio JS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initLazyLoad();
  initScrollReveal();
  initLightbox();
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
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });

    // Close menu on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
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

/* --- Lazy Loading with fade-in --- */
function initLazyLoad() {
  const images = document.querySelectorAll('.gallery-item img[data-src]');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.onload = () => img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });

    images.forEach(img => observer.observe(img));
  } else {
    // Fallback
    images.forEach(img => {
      img.src = img.dataset.src;
      img.classList.add('loaded');
    });
  }
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

  let currentImages = [];
  let currentIndex = 0;

  // Open lightbox on image click
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const grid = item.closest('.gallery-grid, .series-detail-grid');
      if (!grid) return;

      currentImages = Array.from(grid.querySelectorAll('.gallery-item img'))
        .map(img => img.src || img.dataset.src);
      currentIndex = currentImages.indexOf(item.querySelector('img').src || item.querySelector('img').dataset.src);

      showImage();
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  function showImage() {
    if (currentImages[currentIndex]) {
      lightboxImg.src = currentImages[currentIndex];
    }
  }

  function navigate(direction) {
    currentIndex = (currentIndex + direction + currentImages.length) % currentImages.length;
    showImage();
  }

  // Controls
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', () => navigate(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigate(1));

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  // Click outside
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }
}
