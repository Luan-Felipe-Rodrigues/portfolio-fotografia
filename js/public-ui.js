/* Progressive enhancement: content remains useful without JavaScript. */
(() => {
  'use strict';
  const lang = document.documentElement.lang.slice(0, 2);
  const copy = {
    pt: {open:'Abrir menu',close:'Fechar menu',copied:'Link copiado',copyError:'Copie o endereço da página para compartilhar esta foto.',photo:'Fotografia',loading:'Carregando fotografia…',error:'Não foi possível carregar esta fotografia. Tente novamente.',of:'de',locations:'Locais e coleções'},
    en: {open:'Open menu',close:'Close menu',copied:'Link copied',copyError:'Copy the page address to share this photo.',photo:'Photograph',loading:'Loading photograph…',error:'This photograph could not be loaded. Please try again.',of:'of',locations:'Places and collections'},
    es: {open:'Abrir menú',close:'Cerrar menú',copied:'Enlace copiado',copyError:'Copia la dirección de la página para compartir esta foto.',photo:'Fotografía',loading:'Cargando fotografía…',error:'No se pudo cargar esta fotografía. Inténtalo de nuevo.',of:'de',locations:'Lugares y colecciones'}
  }[lang];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const nav = document.querySelector('.site-nav');
  const toggle = nav?.querySelector('.nav-toggle');
  const panel = nav?.querySelector('.nav-panel');
  const mobile = matchMedia('(max-width: 768px)');
  let menuOpen = false;
  const background = () => [...document.querySelectorAll('body > main, body > footer')];
  function closeMenu(restore = true) {
    menuOpen = false;
    nav?.classList.remove('menu-open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', copy.open);
    background().forEach(el => { el.inert = false; });
    document.body.classList.remove('menu-locked');
    if (restore && mobile.matches) toggle?.focus();
  }
  toggle?.addEventListener('click', () => {
    if (menuOpen) return closeMenu();
    menuOpen = true;
    nav.classList.add('menu-open');
    toggle.setAttribute('aria-expanded','true');
    toggle.setAttribute('aria-label',copy.close);
    background().forEach(el => { el.inert = true; });
    document.body.classList.add('menu-locked');
    panel.querySelector('a')?.focus();
  });
  nav?.addEventListener('keydown', e => {
    if (!menuOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    if (e.key === 'Tab') {
      const links = [...nav.querySelectorAll('a,button')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
      const first=links[0], last=links.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  panel?.addEventListener('click',e => { if (e.target.closest('a')) closeMenu(false); });
  mobile.addEventListener('change', () => closeMenu(false));
  document.querySelector('.skip-link')?.addEventListener('click', () => document.querySelector('main')?.focus({preventScroll:true}));

  // A native modal dialog contains focus and makes the background inert.
  const viewer = document.querySelector('#lightbox');
  let selected=[], index=0, opener=null, ownsHistory=false;
  const image=viewer?.querySelector('.lightbox-image');
  const caption=viewer?.querySelector('.lightbox-caption');
  const status=viewer?.querySelector('.lightbox-status');
  const counter=viewer?.querySelector('.lightbox-counter');
  let requestVersion=0;
  function photoLinks() { return [...document.querySelectorAll('.photo-link')].filter(el => !el.closest('[hidden]')); }
  function photoHash(id) { return '#photo='+encodeURIComponent(id); }
  function showPhoto(updateHistory = true) {
    const link=selected[index];
    if (!link || !viewer) return;
    const thumb=link.querySelector('img');
    const version=++requestVersion;
    image.alt=thumb?.alt || copy.photo;
    image.dataset.photoId=link.dataset.photoId || '';
    image.hidden=false;
    image.src=thumb?.currentSrc || link.href;
    caption.textContent=thumb?.alt || copy.photo;
    counter.textContent=`${index+1} ${copy.of} ${selected.length}`;
    status.textContent=copy.loading;
    viewer.querySelector('.lightbox-retry').hidden=true;
    const full=new Image();
    full.onload=()=>{ if(version!==requestVersion)return; image.src=full.src; status.textContent=''; };
    full.onerror=()=>{ if(version!==requestVersion)return; status.textContent=copy.error; viewer.querySelector('.lightbox-retry').hidden=false; };
    full.src=link.href;
    if(updateHistory) history.replaceState(history.state,'',photoHash(link.dataset.id));
    viewer.dispatchEvent(new Event('lr:photo-changed'));
    if(link.dataset.photoId) window.LR_ANALYTICS?.trackPhotoView(link.dataset.photoId,'lightbox');
  }
  function openPhoto(link, fromHistory=false) {
    if(!viewer)return;
    opener=link;
    const group=link.closest('.gallery-section');
    selected=group ? [...group.querySelectorAll('.photo-link')] : photoLinks();
    index=Math.max(0,selected.indexOf(link));
    if(!viewer.open) {
      closeMenu(false);
      viewer.showModal();
      document.body.classList.add('viewer-open');
      if(!fromHistory) {history.pushState({lrPhoto:true},'',photoHash(link.dataset.id));ownsHistory=true;}
    }
    showPhoto(!fromHistory);
    viewer.querySelector('.lightbox-close').focus();
  }
  function syncHash() {
    const id=new URLSearchParams(location.hash.slice(1)).get('photo');
    const link=photoLinks().find(el=>el.dataset.id===id);
    if(link && !(viewer?.open && selected[index]?.dataset.id===id))openPhoto(link,true);
    else if(viewer?.open){ownsHistory=false;viewer.close();}
  }
  document.addEventListener('click',e=>{
    const link=e.target.closest('.photo-link');
    if(!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button!==0)return;
    e.preventDefault();openPhoto(link);
  });
  if(viewer) {
    viewer.querySelector('.lightbox-close').addEventListener('click',()=>viewer.close());
    const navigate=direction=>{index=(index+direction+selected.length)%selected.length;showPhoto();};
    viewer.querySelector('.lightbox-prev').addEventListener('click',()=>navigate(-1));
    viewer.querySelector('.lightbox-next').addEventListener('click',()=>navigate(1));
    viewer.querySelector('.lightbox-retry').addEventListener('click',()=>showPhoto());
    viewer.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'){e.preventDefault();navigate(1);}
      if(e.key==='ArrowLeft'){e.preventDefault();navigate(-1);}
    });
    viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});
    viewer.addEventListener('close',()=>{
      ++requestVersion;document.body.classList.remove('viewer-open');
      if(ownsHistory){ownsHistory=false;history.back();}
      else if(location.hash.startsWith('#photo='))history.replaceState(history.state,'',location.pathname+location.search);
      if(opener?.isConnected)opener.focus({preventScroll:true});
    });
    let touch=null;
    image.addEventListener('touchstart',e=>{touch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
    image.addEventListener('touchend',e=>{if(!touch||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5)navigate(dx<0?1:-1);},{passive:true});
    viewer.querySelector('.lightbox-share').addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(location.href);status.textContent=copy.copied;}
      catch{status.textContent=copy.copyError;}
    });
    if(window.LR_LIKES)window.LR_LIKES.attachToLightbox({lightbox:viewer,getCurrentSrc:()=>image.src,getImage:()=>image});
    addEventListener('popstate',syncHash);
    addEventListener('hashchange',syncHash);
    syncHash();
  }

  // One statically-rendered collection navigator; data refreshes never append clones.
  const locationNav=document.querySelector('.location-nav');
  const beacon=document.querySelector('.location-beacon');
  if(locationNav && beacon) {
    const button=beacon.querySelector('button');
    const menu=beacon.querySelector('.location-beacon-menu');
    const setOpen=open=>{beacon.classList.toggle('open',open);button.setAttribute('aria-expanded',String(open));menu.hidden=!open;};
    button.addEventListener('click',()=>setOpen(menu.hidden));
    beacon.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);button.focus();}});
    beacon.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false);});
    document.addEventListener('click',e=>{if(!beacon.contains(e.target))setOpen(false);});
    new IntersectionObserver(entries=>{const visible=!entries[0].isIntersecting && locationNav.getBoundingClientRect().top<0;beacon.hidden=!visible;if(!visible)setOpen(false);},{rootMargin:'-80px 0px 0px'}).observe(locationNav);
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){button.querySelector('span').textContent=entry.target.querySelector('h2')?.textContent || copy.locations;}},{rootMargin:'-20% 0px -60% 0px'});
    document.querySelectorAll('.gallery-section').forEach(el=>observer.observe(el));
  }

  // Keep the portrait poster until the visitor explores the desktop animation.
  const video=document.querySelector('#about-video');
  if(video) {
    const large=matchMedia('(min-width: 1025px)');
    const wrap=video.closest('.about-video-wrap');
    const enable=()=>{
      if(!large.matches||reduced.matches){wrap.classList.remove('video-started');return;}
      if(!video.src){video.src=video.dataset.src;video.load();}
    };
    let ticking=false;
    const scrub=()=>{
      ticking=false;if(!large.matches||reduced.matches||scrollY<60){wrap.classList.remove('video-started');return;}if(!video.duration)return;
      const section=document.querySelector('#about-section');
      const range=Math.max(1,section.offsetHeight-innerHeight);
      video.currentTime=Math.min(.99,Math.max(.12,(scrollY-section.offsetTop)/range))*video.duration;
      // Show a decoded frame, keeping the poster while a seek is pending.
    };
    video.addEventListener('loadedmetadata',scrub);
    video.addEventListener('seeked',()=>{if(large.matches&&!reduced.matches&&scrollY>=60)wrap.classList.add('video-started');});
    addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(()=>{enable();scrub();});}},{passive:true});
    large.addEventListener('change',enable);reduced.addEventListener('change',enable);
  }
})();
