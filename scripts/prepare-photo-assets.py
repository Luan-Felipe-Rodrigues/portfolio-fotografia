#!/usr/bin/env python3
"""Refresh the public-only photo snapshot and create responsive, metadata-free WebP assets.

Uses the public publishable key only. Never requests private client tables/buckets.
All originals are left untouched. Descriptions are maintained in photo-descriptions.json.
Run from any directory: python3 scripts/prepare-photo-assets.py
"""
import argparse
import concurrent.futures
import datetime
import json
import pathlib
import re
import subprocess
import urllib.parse
from PIL import Image, ImageOps, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = pathlib.Path('/private/tmp/photography-assets-cache')
OUT = ROOT / 'images/optimized'
API = 'https://junfgutjyicdrvpoyuzz.supabase.co'
PUBLIC_KEY = 'sb_publishable_GY-aCPbwOTu_BXGGGNx5rQ_Rmc_Nddb'
HERO_STORAGE = 'lugares-toscana/2026/55f25b4e-40f8-49ae-ad2a-c2da03f6d5be.jpg'
WIDTHS = (480, 960, 1600)

def fetch(url, target, authenticated=False):
    target.parent.mkdir(parents=True, exist_ok=True)
    args = ['curl', '--fail', '--silent', '--show-error', '--location', '--retry', '2', '--max-time', '90']
    if authenticated:
        args += ['--header', 'apikey: ' + PUBLIC_KEY]
    subprocess.run(args + [url, '--output', str(target)], check=True)

def metadata():
    query = urllib.parse.urlencode({
        'select': 'id,collection_id,storage_path,width,height,alt_pt,alt_en,alt_es,display_order,is_home_featured,is_published,is_archived,taken_at,collection:collections(id,slug,parent_slug,name_pt,name_en,name_es,display_order)',
        'is_published': 'eq.true', 'is_archived': 'eq.false', 'order': 'display_order.asc,id.asc', 'limit': '500'
    })
    photos=[]
    for offset in range(0,100000,500):
        fetch(API + '/rest/v1/photos?' + query + '&offset=' + str(offset), CACHE / 'photo-page.json', True)
        batch=json.loads((CACHE/'photo-page.json').read_text())
        if not isinstance(batch,list): raise ValueError('Invalid catalogue response')
        photos.extend(batch)
        if len(batch)<500: break
    else: raise ValueError('Catalogue exceeded safe pagination limit')
    (CACHE/'photos.json').write_text(json.dumps(photos,ensure_ascii=False))
    fetch(API + '/rest/v1/collections?select=id,slug,parent_slug,name_pt,name_en,name_es,display_order&order=display_order.asc', CACHE / 'collections.json', True)
    photos = json.loads((CACHE / 'photos.json').read_text())
    collections = json.loads((CACHE / 'collections.json').read_text())
    if not isinstance(photos, list) or not photos:
        raise ValueError('Public photo snapshot is empty or invalid; refusing to overwrite.')
    if not all(p['is_published'] and not p['is_archived'] for p in photos):
        raise ValueError('Unexpected unpublished/archived record.')
    return photos, collections

def download(photo):
    if photo.get('source') == 'legacy-public':
        return ROOT / photo['legacy_path']
    path = CACHE / (photo['id'] + '.jpg')
    if not path.exists():
        url = API + '/storage/v1/render/image/public/photos/' + urllib.parse.quote(photo['storage_path']) + '?width=2200&height=2200&resize=contain&quality=90'
        fetch(url, path)
    with Image.open(path) as im:
        im.verify()
    return path

def variants(source, name):
    with Image.open(source) as original:
        im = ImageOps.exif_transpose(original).convert('RGB')
        w, h = im.size
        optimized, dimensions, sources = {}, {}, []
        seen_widths = set()
        for width, quality, byte_budget in zip(WIDTHS, (72, 76, 78), (70000, 180000, 350000)):
            actual_width = min(width, w)
            size = (actual_width, max(1, round(h * actual_width / w)))
            resized = im.resize(size, Image.Resampling.LANCZOS) if size != im.size else im
            target = OUT / (name + '-' + str(width) + '.webp')
            if not target.exists() or target.stat().st_mtime < max(pathlib.Path(source).stat().st_mtime, pathlib.Path(__file__).stat().st_mtime):
                resized.save(target, 'WEBP', quality=quality, method=6)
                # Detailed photographs may exceed the soft budget. Preserve quality
                # at 72 rather than damaging texture to meet an arbitrary byte cap.
                if target.stat().st_size > byte_budget and quality > 72:
                    resized.save(target, 'WEBP', quality=72, method=6)
            url = '/images/optimized/' + target.name
            optimized[str(width)] = url
            dimensions[str(width)] = {'width': size[0], 'height': size[1]}
            if actual_width not in seen_widths:
                sources.append({'src': url, 'width': size[0], 'height': size[1]})
                seen_widths.add(actual_width)
        return {'optimized': optimized, 'variant_dimensions': dimensions, 'sources': sources, 'width': w, 'height': h}

def contact_sheets(photos):
    for start in range(0, len(photos), 24):
        batch = photos[start:start+24]
        canvas = Image.new('RGB', (1400, 6 * 230), 'white')
        draw = ImageDraw.Draw(canvas)
        for j, photo in enumerate(batch):
            x, y = (j % 4) * 350, (j // 4) * 230
            with Image.open(ROOT/photo['legacy_path'] if photo.get('source')=='legacy-public' else CACHE / (photo['id'] + '.jpg')) as original:
                im = ImageOps.exif_transpose(original).convert('RGB')
                im.thumbnail((340, 192))
                canvas.paste(im, (x + (350-im.width)//2, y))
            label = f"{start+j:03} {photo['collection']['slug']}"
            draw.text((x+5,y+195), label, fill='black')
            draw.text((x+5,y+212), photo['id'][:8], fill='black')
        canvas.save(CACHE / f'sheet-{start//24+1:02}.jpg', quality=90)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cached-metadata', action='store_true')
    parser.add_argument('--sheets-only', action='store_true')
    parser.add_argument('--draft', action='store_true', help='Allow missing descriptions during preparation; never used by the publication build.')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    (ROOT/'data').mkdir(exist_ok=True)
    if args.cached_metadata:
        photos = json.loads((CACHE/'photos.json').read_text())
        collections = json.loads((CACHE/'collections.json').read_text())
    else:
        photos, collections = metadata()
    # Only images already visible on the public Events page are included here.
    # This migration snapshot has no Supabase rows for those legacy photos.
    legacy_sections = [
        ('dia-mulher', 'Dia da Mulher 2024', "Women's Day 2024", 'Día de la Mujer 2024'),
        ('fimdeano-2023', 'Final de Ano 2023', 'Year-end celebration 2023', 'Fiesta de fin de año 2023'),
        ('fimdeano-2024', 'Final de Ano 2024', 'Year-end celebration 2024', 'Fiesta de fin de año 2024'),
    ]
    events_html=(ROOT/'series-eventos.html').read_text()
    existing_catalog=ROOT/'data/catalog.json'
    previous=json.loads(existing_catalog.read_text()) if existing_catalog.exists() else {}
    for order,(section,pt,en,es) in enumerate(legacy_sections):
        col={'id':'legacy-events-'+section,'slug':'eventos-'+section,'parent_slug':'eventos','name_pt':pt,'name_en':en,'name_es':es,'display_order':order}
        collections.append(col)
        match=re.search(r'<section[^>]+id="'+section+r'"[^>]*>(.*?)</section>',events_html,re.S)
        paths=re.findall(r'<img[^>]+src="(images/[^\"]+)"',match.group(1)) if match else []
        if not paths:
            paths=[p['legacy_path'] for p in previous.get('photos',[]) if p.get('source')=='legacy-public' and p['collection']['id']==col['id']]
        for n,path in enumerate(paths):
            import hashlib
            pid='legacy-'+hashlib.sha256(path.encode()).hexdigest()[:20]
            photos.append({'id':pid,'source':'legacy-public','legacy_path':path,'storage_path':None,'collection_id':col['id'],'collection':col,'width':None,'height':None,'alt_pt':'','alt_en':'','alt_es':'','display_order':n,'is_home_featured':n==0,'is_published':True,'is_archived':False,'taken_at':None})
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(download, photos))
    contact_sheets(photos)
    if args.sheets_only:
        print(json.dumps({'photos':len(photos),'sheets':str(CACHE)}))
        return
    desc_path = ROOT/'scripts/photo-descriptions.json'
    descriptions = json.loads(desc_path.read_text()) if desc_path.exists() else {}
    missing = [p['id'] for p in photos if any(not descriptions.get(p['id'],{}).get('alt_'+lang) and not p.get('alt_'+lang) for lang in ('pt','en','es'))]
    if missing and not args.draft:
        raise ValueError(f'{len(missing)} photos still need descriptions; originals and existing catalog remain unchanged.')
    def process(photo):
        photo = dict(photo)
        photo.update(variants(ROOT/photo['legacy_path'] if photo.get('source')=='legacy-public' else CACHE/(photo['id']+'.jpg'),photo['id']))
        for lang in ('pt','en','es'):
            key='alt_'+lang
            photo[key]=descriptions.get(photo['id'],{}).get(key) or photo.get(key) or ''
        return photo
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        photos = list(pool.map(process, photos))
    hero = next(p for p in photos if p['storage_path']==HERO_STORAGE)
    poster = variants(ROOT/'images/about-poster.jpg','about-poster')
    result={'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'photos':photos,'collections':collections,'media':{'hero':hero,'about_poster':poster}}
    (ROOT/'data/catalog.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'photos':len(photos),'missing_descriptions':len(missing),'bytes':sum(p.stat().st_size for p in OUT.glob('*.webp')),'hero_id':hero['id'],'hero_dimensions':[hero['width'],hero['height']]}))

if __name__ == '__main__':
    main()
