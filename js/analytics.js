/* One event ID per document. Duration updates that same visit, never inserts a second visit. */
(() => {
 if(window.LR_ANALYTICS)return;
 const config=window.LR_CONFIG||{url:'https://junfgutjyicdrvpoyuzz.supabase.co'};
 const params=new URLSearchParams(location.search),key='lr_no_track';
 try{if(params.get('no_track')==='1')localStorage.setItem(key,'1');if(params.get('no_track')==='0')localStorage.removeItem(key);}catch{}
 let disabled=false;
 function optedOut(){try{return disabled||localStorage.getItem(key)==='1'||navigator.doNotTrack==='1';}catch{return disabled;}}
 const box=document.querySelector('#analytics-opt-out');
 if(box){box.checked=optedOut();box.addEventListener('change',()=>{disabled=box.checked;try{if(disabled)localStorage.setItem(key,'1');else localStorage.removeItem(key);}catch{};});}
 let session=crypto.randomUUID();try{session=sessionStorage.getItem('lr_session_v1')||session;sessionStorage.setItem('lr_session_v1',session);}catch{}
 const event=crypto.randomUUID();let referrer=null;try{referrer=new URL(document.referrer).origin;}catch{}
 const base={session_id:session,event_id:event,path:location.pathname,locale:document.documentElement.lang.slice(0,2),referrer};
 for(const k of ['utm_source','utm_medium','utm_campaign'])if(params.has(k))base[k]=params.get(k).slice(0,120);
 function send(payload){if(optedOut())return;fetch(config.url+'/functions/v1/ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});}
 let elapsed=0,started=document.hidden?null:performance.now();
 function flush(){if(started!=null){elapsed+=performance.now()-started;started=null;}send({...base,type:'page_duration',duration_ms:Math.round(elapsed)});}
 function photo(id,source='lightbox'){if(!id||!/^[-a-f0-9]{36}$/i.test(id))return;send({type:'photo_view',session_id:session,photo_id:id,source});}
 let sent=false;function page(){if(sent)return;sent=true;send({...base,type:'pageview'});}
 page();document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();else started=performance.now();});
 window.addEventListener('pagehide',flush);window.addEventListener('pageshow',()=>{if(!document.hidden&&started==null)started=performance.now();});
 window.LR_ANALYTICS={trackPhotoView:photo,trackPageview:page,trackSessionEnd:flush};
})();
