/* ==========================================================================
   Luan Rodrigues — Portfolio JS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initHomeGallery();
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

  const isSubdir = window.location.pathname.includes('/en/') || window.location.pathname.includes('/es/');
  const prefix = isSubdir ? '../' : '';
  const lang = document.documentElement.lang;

  let lugaresLink = lang === 'en' ? 'series-places.html' : 'series-lugares.html';
  let preweddingLink = 'series-prewedding.html';
  let autoralLink = lang === 'en' ? 'series-personal.html' : 'series-autoral.html';

  const collections = [
    { link: lugaresLink, photos: ['images/lugares/cinque-terre/IMG_5895.jpeg', 'images/lugares/cinque-terre/IMG_5896.jpeg', 'images/lugares/cinque-terre/IMG_5897.jpeg'] },
    { link: lugaresLink, photos: ['images/lugares/italia/IMG_5881.jpeg', 'images/lugares/italia/IMG_5883.jpeg', 'images/lugares/italia/IMG_5886.jpeg'] },
    { link: lugaresLink, photos: ['images/lugares/roma/IMG_5889.jpeg', 'images/lugares/roma/IMG_5891.jpeg', 'images/lugares/roma/IMG_5893.jpeg'] },
    { link: lugaresLink, photos: ['images/lugares/santos/IMG_2948.jpg', 'images/lugares/santos/IMG_2965.jpg', 'images/lugares/santos/IMG_3179.jpg'] },
    { link: lugaresLink, photos: ['images/lugares/nova-york/IMG_4480.jpg', 'images/lugares/nova-york/IMG_4481.jpg'] },
    { link: lugaresLink, photos: ['images/lugares/rio-de-janeiro/IMG-20221112-WA0001.jpeg.jpg', 'images/lugares/rio-de-janeiro/IMG-20221112-WA0003.jpg.jpg'] },
    { link: autoralLink, photos: ['images/autoral/IMG_3192.jpeg.jpg', 'images/autoral/IMG_4400.jpeg.jpg', 'images/autoral/IMG_4518.HEIC.jpg', 'images/autoral/IMG_2850.jpg', 'images/autoral/autoral_01.jpg', 'images/autoral/autoral_02.jpg', 'images/autoral/autoral_03.jpg', 'images/autoral/autoral_04.jpg', 'images/autoral/autoral_05.jpg', 'images/autoral/autoral_06.jpg', 'images/autoral/autoral_07.jpg', 'images/autoral/autoral_08.jpg', 'images/autoral/autoral_09.jpg', 'images/autoral/autoral_10.jpg', 'images/autoral/autoral_11.jpg', 'images/autoral/autoral_12.jpg', 'images/autoral/autoral_13.jpg', 'images/autoral/autoral_14.jpg', 'images/autoral/autoral_15.jpg', 'images/autoral/autoral_16.jpg', 'images/autoral/autoral_17.jpg', 'images/autoral/autoral_18.jpg', 'images/autoral/autoral_19.jpg', 'images/autoral/autoral_20.jpg'] },
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

  // Open lightbox on image click (skip items that are links to series)
  document.querySelectorAll('.gallery-item:not(.gallery-link)').forEach(item => {
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
  if (!video || typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  function setup() {
    const duration = video.duration;
    if (!duration || isNaN(duration)) return;

    const section = document.getElementById('about-section');
    if (!section) return;

    // Video scrubs across the entire about section scroll
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

  if (video.readyState >= 1) {
    setup();
  } else {
    video.addEventListener('loadedmetadata', setup);
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
