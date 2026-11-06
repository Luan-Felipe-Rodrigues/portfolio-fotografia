/* Reconcile fresh CMS metadata without downloading a second set of photographs.
 * On timeout/error the complete static snapshot remains usable. */
(async()=>{
 if(location.hostname.endsWith('.')){const u=new URL(location.href);u.hostname=u.hostname.slice(0,-1);location.replace(u.href);return;}
 if(new URLSearchParams(location.search).get('dynamic')==='0')return;
 const config=window.LR_CONFIG,snapshotNode=document.querySelector('#page-catalog');if(!config||!snapshotNode)return;
 const snapshot=JSON.parse(snapshotNode.textContent),known=new Map(snapshot.metadata.map(p=>[p.id,p]));
 const lang=document.documentElement.lang.slice(0,2),page=document.body.dataset.page;
 const category=p=>p.collection?.parent_slug||p.collection?.slug;
 const render=(p,size)=>`${config.url}/storage/v1/render/image/public/photos/${p.storage_path.split('/').map(encodeURIComponent).join('/')}?width=${size}&height=${size}&resize=contain&quality=78`;
 const storage=p=>`${config.url}/storage/v1/object/public/photos/${p.storage_path.split('/').map(encodeURIComponent).join('/')}`;
 let photos=[];
 try{
  for(let offset=0;;offset+=500){const response=await fetch(`${config.url}/rest/v1/photos?select=id,storage_path,width,height,alt_pt,alt_en,alt_es,display_order,is_home_featured,updated_at,collection:collections(slug,parent_slug,name_pt,name_en,name_es,display_order)&is_published=eq.true&is_archived=eq.false&order=display_order.asc,id.asc&offset=${offset}&limit=500`,{headers:{apikey:config.key},signal:AbortSignal.timeout(5000)});if(!response.ok)return;const batch=await response.json();if(!Array.isArray(batch))return;photos.push(...batch);if(batch.length<500)break;}
 }catch{return;}
 const byId=new Map(photos.map(p=>[p.id,p]));
 for(const link of document.querySelectorAll('.photo-link[data-photo-id]')){
  const id=link.dataset.photoId;if(!id)continue;const p=byId.get(id);
  if(!p){link.remove();continue;}
  if(page.startsWith('series-')&&category(p)!==page.slice(7)){link.remove();continue;}
  link.dataset.category=category(p);
  const previous=known.get(id);
  if(previous?.path!==p.storage_path){const img=link.querySelector('img');img.removeAttribute('srcset');img.src=render(p,960);link.href=render(p,1600);}
  if(p.updated_at>snapshot.generated_at){const img=link.querySelector('img');img.alt=p['alt_'+lang]||p.alt_pt||img.alt;}
 }
 function makeLink(p){
  const a=document.createElement('a');a.className='photo-link gallery-item';a.href=render(p,1600);a.dataset.id=p.id;a.dataset.photoId=p.id;a.dataset.category=category(p);a.dataset.collection=p.collection.slug;
  const image=document.createElement('img');image.width=p.width||1200;image.height=p.height||800;image.loading='lazy';image.decoding='async';image.alt=p['alt_'+lang]||p.alt_pt||p.collection['name_'+lang]||p.collection.name_pt;image.src=render(p,960);a.style.setProperty('--ratio',`${image.width}/${image.height}`);a.append(image);return a;
 }
 if(page==='portfolio'||page.startsWith('series-')){
  for(const p of photos){
   if(document.querySelector(`.photo-link[data-photo-id="${p.id}"]`))continue;
   if(page.startsWith('series-')&&category(p)!==page.slice(7))continue;
   let grid=document.querySelector('.portfolio-grid');
   if(!grid){let group=[...document.querySelectorAll('.gallery-section')].find(g=>g.id===p.collection?.slug);if(!group){group=document.createElement('section');group.className='gallery-section';group.id=p.collection.slug;const h=document.createElement('h2');h.textContent=p.collection['name_'+lang]||p.collection.name_pt;grid=document.createElement('div');grid.className='gallery-grid';group.append(h,grid);document.querySelector('.series-galleries').append(group);const nav=document.querySelector('.location-nav');if(nav){const link=document.createElement('a');link.href='#'+group.id;link.textContent=h.textContent;nav.append(link);document.querySelector('.location-beacon-menu')?.append(link.cloneNode(true));}}else grid=group.querySelector('.gallery-grid');}
   grid.append(makeLink(p));
  }
  for(const group of document.querySelectorAll('.gallery-section'))if(!group.querySelector('.photo-link')){document.querySelectorAll(`a[href="#${CSS.escape(group.id)}"]`).forEach(a=>a.remove());group.remove();}
 }
 // Update selected covers when an editor withdraws or replaces a photograph.
 for(const image of document.querySelectorAll('.showcase img[data-catalog-id],.series-card img[data-catalog-id]')){
  const oldId=image.dataset.catalogId,old=known.get(oldId);if(!old||oldId.startsWith('legacy-'))continue;
  let replacement=byId.get(oldId);
  if(!replacement||(!replacement.is_home_featured&&photos.some(p=>p.collection?.slug===old.collection&&p.is_home_featured)))replacement=photos.find(p=>p.collection?.slug===old.collection&&p.is_home_featured)||photos.find(p=>p.collection?.slug===old.collection);
  if(!replacement){image.closest('.showcase-item,.series-card')?.remove();continue;}
  if(replacement.id!==oldId||replacement.storage_path!==old.path){image.dataset.catalogId=replacement.id;image.removeAttribute('srcset');image.src=known.has(replacement.id)?`/images/optimized/${replacement.id}-960.webp`:render(replacement,960);image.width=replacement.width||1200;image.height=replacement.height||800;image.alt=replacement['alt_'+lang]||replacement.alt_pt||replacement.collection['name_'+lang];}
 }
 document.dispatchEvent(new CustomEvent('lr:catalog-updated'));
})();
