/* Anonymous likes: commit locally only after the server confirms the count. */
(() => {
  if(window.LR_LIKES)return;
  const {url,key}=window.LR_CONFIG;
  const lang=document.documentElement.lang.slice(0,2);
  const t=({pt:['Curtir','Remover curtida','Não foi possível salvar. Tente novamente.'],en:['Like','Unlike','Could not save. Please try again.'],es:['Me gusta','Quitar me gusta','No se pudo guardar. Inténtalo de nuevo.']})[lang]||[];
  const cache={},revisions={},pending=new Set();let liked={};
  try{liked=JSON.parse(localStorage.getItem('lr_liked_v1')||'{}')||{};}catch{}
  function attachToLightbox({lightbox,getImage}){
    if(lightbox.dataset.lrLikeAttached)return;lightbox.dataset.lrLikeAttached='1';
    const holder=lightbox.querySelector('.lightbox-likes');if(!holder)return;
    const button=document.createElement('button');button.className='lr-like';button.type='button';holder.append(button);
    const status=document.createElement('span');status.className='lr-like-status';status.setAttribute('role','status');holder.append(status);
    const id=()=>getImage().dataset.photoId||'';
    function paint(){const photo=id();holder.hidden=!photo;button.disabled=pending.has(photo);button.setAttribute('aria-pressed',String(!!liked[photo]));button.setAttribute('aria-label',liked[photo]?t[1]:t[0]);button.textContent=`${liked[photo]?'♥':'♡'} ${cache[photo]??''}`;}
    async function update(){status.textContent='';paint();const photo=id(),revision=revisions[id()]||0;if(!photo)return;try{const res=await fetch(`${url}/rest/v1/photo_likes?select=count&photo_id=eq.${encodeURIComponent(photo)}`,{headers:{apikey:key},signal:AbortSignal.timeout(8000)});if(!res.ok)throw Error();const rows=await res.json();if(!pending.has(photo)&&(revisions[photo]||0)===revision)cache[photo]=rows[0]?.count||0;if(id()===photo)paint();}catch{}}
    button.addEventListener('click',async()=>{
      const photo=id();if(!photo||pending.has(photo))return;
      const before=!!liked[photo];revisions[photo]=(revisions[photo]||0)+1;pending.add(photo);status.textContent='';paint();
      try{const response=await fetch(`${url}/rest/v1/rpc/increment_like`,{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify({p_photo_id:photo,p_delta:before?-1:1}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const count=await response.json();if(typeof count!=='number')throw Error();cache[photo]=count;if(before)delete liked[photo];else liked[photo]=true;try{localStorage.setItem('lr_liked_v1',JSON.stringify(liked));}catch{}}
      catch{if(id()===photo)status.textContent=t[2];}
      finally{pending.delete(photo);paint();}
    });
    lightbox.addEventListener('lr:photochanged',update);
    lightbox.addEventListener('lr:photo-changed',update);
    update();
  }
  window.LR_LIKES={attachToLightbox};
})();
