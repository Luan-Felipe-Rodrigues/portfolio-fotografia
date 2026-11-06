import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateSchedule,STYLES} from '../supabase/functions/submit-quote-request/validation.mjs';
const today=new Date('2026-11-06T15:00:00Z');
const valid={ensaio_type:'eventos',duration_hours:1.5,preferred_date:'2026-11-07',styles:['candid']};
test('quote rejects invalid durations, dates, incompatible styles and IDs',()=>{
 assert.equal(validateSchedule(valid,today),null);
 for(const duration_hours of [0,-1,.25,1.3,24.5,99,Infinity,'2'])assert.equal(validateSchedule({...valid,duration_hours},today),'duration_hours');
 for(const preferred_date of ['2026-11-05','2026-02-30','2027-02-29','2026-13-01','2026-1-1'])assert.equal(validateSchedule({...valid,preferred_date},today),'preferred_date');
 assert.equal(validateSchedule({...valid,preferred_date:'2026-11-06'},today),null);
 assert.equal(validateSchedule({...valid,preferred_date:null,duration_hours:null},today),null);
 assert.equal(validateSchedule({...valid,styles:['romântico']},today),'styles');
 assert.equal(validateSchedule({...valid,request_id:'invalid'},today),'request_id');
 assert.equal(Object.keys(STYLES).length,5);
});
test('published artifact excludes source, credentials and repository internals',()=>{
 for(const file of ['supabase','scripts','.git','.env','data','node_modules','tests'])assert.equal(fs.existsSync('dist/'+file),false,file);
 assert.ok(fs.existsSync('dist/sitemap.xml'));
 const entries=[];function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=dir+'/'+e.name;if(e.isDirectory())visit(file);else entries.push(file);}}visit('dist');
 for(const file of entries.filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(file,'utf8');for(const match of html.matchAll(/(?:src|href)="(\/(?!\/)[^"#?]*)(?:[?#][^"]*)?"/g)){const pathname=decodeURIComponent(match[1]);const target='dist'+pathname+(pathname.endsWith('/')?'index.html':'');assert.ok(fs.existsSync(target),`${file}: ${pathname}`);}}
});
test('static catalogue contains every photograph once and meaningful descriptions',()=>{
 const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
 for(const [lang,route] of [['pt','trabalho.html'],['en','en/trabalho.html'],['es','es/trabajo.html']]){
  const html=fs.readFileSync('dist/'+route,'utf8');const ids=[...html.matchAll(/class="photo-link gallery-item"[^>]*data-id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,catalog.photos.length);assert.equal(new Set(ids).size,ids.length);
  for(const p of catalog.photos){assert.ok(p['alt_'+lang].length>12);for(const source of p.sources)assert.ok(fs.existsSync('dist'+source.src));}
  assert.equal((html.match(/id="main-content"/g)||[]).length,1);assert.ok(html.includes('property="og:image"'));
 }
});
