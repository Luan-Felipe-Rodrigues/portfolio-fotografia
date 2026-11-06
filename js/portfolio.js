/* Accessible grid first, optional draggable canvas; no duplicate photographs. */
(() => {
  const workspace=document.querySelector('.portfolio-workspace');
  if(!workspace)return;
  const grid=workspace.querySelector('.portfolio-grid');
  const filter=document.querySelector('#portfolio-filter');
  const mode=document.querySelector('#portfolio-mode');
  const count=document.querySelector('#portfolio-count');
  const hint=document.querySelector('.all-work-hint');
  let x=0,y=0,drag=null,moved=false;
  const texts={pt:{grid:'Ver em grade',explore:'Explorar livremente',photos:'fotografias'},en:{grid:'Grid view',explore:'Explore freely',photos:'photographs'},es:{grid:'Ver cuadrícula',explore:'Explorar libremente',photos:'fotografías'}};
  const text=texts[document.documentElement.lang.slice(0,2)]||texts.pt;
  function transform(){
    x=Math.min(0,Math.max(workspace.clientWidth-grid.scrollWidth,x));
    y=Math.min(0,Math.max(workspace.clientHeight-grid.scrollHeight,y));
    grid.style.transform=workspace.classList.contains('immersive')?`translate(${x}px,${y}px)`:'';
  }
  function applyFilter(){
    let visible=0;
    for(const link of grid.querySelectorAll('.photo-link')){
      link.hidden=filter.value!=='all'&&link.dataset.category!==filter.value;
      if(!link.hidden)visible++;
    }
    count.textContent=`${visible} ${text.photos}`;
    const url=new URL(location.href);if(filter.value==='all')url.searchParams.delete('collection');else url.searchParams.set('collection',filter.value);
    history.replaceState(history.state,'',url);
    x=y=0;transform();
  }
  const requested=new URLSearchParams(location.search).get('collection');
  if([...filter.options].some(o=>o.value===requested))filter.value=requested;
  filter.addEventListener('change',applyFilter);
  document.addEventListener('lr:catalog-updated',applyFilter);
  mode.addEventListener('click',()=>{
    const active=workspace.classList.toggle('immersive');
    mode.setAttribute('aria-pressed',String(active));mode.textContent=active?text.grid:text.explore;
    hint.hidden=!active;workspace.tabIndex=active?0:-1;
    x=y=0;transform();if(active)workspace.focus({preventScroll:true});
  });
  workspace.addEventListener('pointerdown',e=>{
    if(!workspace.classList.contains('immersive')||e.button!==0)return;
    drag={x:e.clientX,y:e.clientY,ox:x,oy:y,id:e.pointerId};moved=false;
  });
  workspace.addEventListener('pointermove',e=>{
    if(!drag)return;
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7){moved=true;workspace.setPointerCapture(e.pointerId);}
    if(moved){x=drag.ox+e.clientX-drag.x;y=drag.oy+e.clientY-drag.y;transform();}
  });
  workspace.addEventListener('pointerup',()=>{drag=null;setTimeout(()=>{moved=false;},0);});
  workspace.addEventListener('pointercancel',()=>{drag=null;moved=false;});
  workspace.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation();}},true);
  workspace.addEventListener('keydown',e=>{
    if(!workspace.classList.contains('immersive')||e.target!==workspace)return;
    const delta={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]}[e.key];
    if(delta){e.preventDefault();x+=delta[0];y+=delta[1];transform();}
    if(e.key==='Escape'){mode.click();mode.focus();}
  });
  grid.addEventListener('focusin',()=>{
    if(workspace.classList.contains('immersive')){workspace.classList.remove('immersive');mode.setAttribute('aria-pressed','false');mode.textContent=text.explore;hint.hidden=true;transform();}
  });
  addEventListener('resize',transform);
  applyFilter();
})();
