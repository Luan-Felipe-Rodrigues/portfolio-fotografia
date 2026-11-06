/* Package the authored site without generating pages, selecting photographs,
 * replacing layouts or injecting a different navigation system. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const files=JSON.parse(fs.readFileSync(path.join(root,'scripts/public-files.json'),'utf8'));
const sources=files.filter(f=>/\.(?:html|css|js)$/.test(f));
const version=crypto.createHash('sha256').update(sources.map(f=>fs.readFileSync(path.join(root,f))).join('')).digest('hex').slice(0,12);
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
for(const file of files){
 if(file.includes('..')||path.isAbsolute(file))throw Error('Invalid public path');
 const target=path.join(dist,file);fs.mkdirSync(path.dirname(target),{recursive:true});
 if(file.endsWith('.html')){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  fs.writeFileSync(target,html.replace(/((?:src|href)="(?!https?:)[^"?]+\.(?:css|js))(?:\?v=[^"&]+)?"/g,`$1?v=${version}"`));
 }else if(file.endsWith('.js')){
  const code=fs.readFileSync(path.join(root,file),'utf8');
  fs.writeFileSync(target,code.replace(/(['"])((?:\.\.\/|\.\/)?(?:js|css)\/[a-zA-Z0-9._/-]+\.(?:js|css))\1/g,`$1$2?v=${version}$1`));
 }else fs.copyFileSync(path.join(root,file),target);
}
fs.writeFileSync(path.join(dist,'version.json'),JSON.stringify({version,interface_baseline:'e9b113f',generated_at:new Date().toISOString()}));
console.log(`Packaged ${files.length} authored files; original interface preserved (${version}).`);
