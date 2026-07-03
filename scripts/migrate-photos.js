#!/usr/bin/env node
/*
 * migrate-photos.js
 *
 * Sprint 1 · S1.10: One-shot migration of the ~80 photos hardcoded in the
 * repo into Supabase Storage + public.photos.
 *
 * See ~/Bunker/Profissional/Rodrigues Studio/Projetos/Portfolio Fotografia/
 *     _Notas de Migracao.md
 * for the mapping and decisions this script encodes (D6, D18, D21, D22, D23).
 *
 * Usage:
 *   npm install
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:dry
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate
 *
 * Options: --dry-run, --verbose, --limit=N
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import exifr from 'exifr';
import imageSize from 'image-size';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(REPO_ROOT, 'images');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const LIMIT_ARG = args.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERRO: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ---------------------------------------------------------------------------
// Collections mapping (see _Notas de Migracao.md and Spec D21/D22)
// ---------------------------------------------------------------------------

// Top-level collection per top folder in images/
const TOP_COLLECTION_BY_FOLDER = {
  autoral: 'autoral',
  prewedding: 'prewedding',
  lugares: 'lugares',
  eventos: 'eventos',
  'eventos-fimdeano': 'eventos',
  'eventos-fimdeano-2024': 'eventos'
};

// Folders whose sub-directories become sub-collections (parent_slug = top)
const HAS_SUBCOLLECTIONS = new Set(['autoral', 'lugares']);

// Alias for lugares sub-folder → seeded collection slug suffix
const LUGARES_SUB_ALIASES = {
  'rio-de-janeiro': 'rio'
};

// Translations for auto-created sub-collection names (autoral pattern)
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_SLUG_TO_IDX = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
};

function inferSubcollectionNames(subSlug, parentSlug) {
  // For autoral: "marco-2026" → PT "Março 2026", EN/ES translated
  if (parentSlug === 'autoral') {
    const rangeMatch = subSlug.match(/^(\d{4})-(\d{4})$/);
    if (rangeMatch) {
      return { pt: `${rangeMatch[1]}-${rangeMatch[2]}`, en: `${rangeMatch[1]}-${rangeMatch[2]}`, es: `${rangeMatch[1]}-${rangeMatch[2]}` };
    }
    const monthMatch = subSlug.match(/^([a-z]+)-(\d{4})$/);
    if (monthMatch && MONTH_SLUG_TO_IDX[monthMatch[1]] !== undefined) {
      const idx = MONTH_SLUG_TO_IDX[monthMatch[1]];
      return {
        pt: `${MONTHS_PT[idx]} ${monthMatch[2]}`,
        en: `${MONTHS_EN[idx]} ${monthMatch[2]}`,
        es: `${MONTHS_ES[idx]} ${monthMatch[2]}`
      };
    }
    // Fallback: use the slug as-is capitalized
    const cap = subSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { pt: cap, en: cap, es: cap };
  }

  // For lugares: seeded collections already have names, but if we hit an
  // unseeded sub-folder (ex: italia) create with same name for all langs.
  const cap = subSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { pt: cap, en: cap, es: cap };
}

// ---------------------------------------------------------------------------
// HTML parsing for visual order (D23)
// ---------------------------------------------------------------------------

async function readHtml(relPath) {
  return await fs.readFile(path.join(REPO_ROOT, relPath), 'utf8');
}

/** Extract flat order of `<img src="...">` in a document. Returns Map<src, order*10>. */
function extractFlatOrder(html) {
  const map = new Map();
  const regex = /<img[^>]+src="([^"]+)"/g;
  let match;
  let position = 0;
  while ((match = regex.exec(html)) !== null) {
    // Ignore admin thumbnails or absolute URLs
    if (match[1].startsWith('http') || match[1].startsWith('data:')) continue;
    if (!match[1].startsWith('images/')) continue;
    if (!map.has(match[1])) {
      map.set(match[1], position * 10);
      position++;
    }
  }
  return map;
}

/** For pages with `<section id="...">` grouping (series-lugares.html). Returns
 *  Map<src, { subSlug, order }>. */
function extractSectionedOrder(html) {
  const map = new Map();
  const sectionRegex = /<section[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g;
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(html)) !== null) {
    const subSlug = sectionMatch[1];
    const content = sectionMatch[2];
    const imgRegex = /<img[^>]+src="([^"]+)"/g;
    let imgMatch;
    let position = 0;
    while ((imgMatch = imgRegex.exec(content)) !== null) {
      const src = imgMatch[1];
      if (src.startsWith('http') || src.startsWith('data:')) continue;
      if (!src.startsWith('images/')) continue;
      if (!map.has(src)) {
        map.set(src, { subSlug, order: position * 10 });
        position++;
      }
    }
  }
  return map;
}

async function loadAllOrders() {
  const autoralOrder = extractFlatOrder(await readHtml('series-autoral.html'));
  const preweddingOrder = extractFlatOrder(await readHtml('series-prewedding.html'));
  const lugaresOrder = extractSectionedOrder(await readHtml('series-lugares.html'));
  const eventosOrder = extractSectionedOrder(await readHtml('series-eventos.html'));

  // Home pool: parse main.js for `images/...` strings inside the collections
  // array. Anything that shows up is a home_featured candidate.
  const mainJs = await fs.readFile(path.join(REPO_ROOT, 'js/main.js'), 'utf8');
  const homePool = new Set(
    [...mainJs.matchAll(/'(images\/[^']+\.(?:jpg|jpeg|png|webp))'/g)].map((m) => m[1])
  );

  return { autoralOrder, preweddingOrder, lugaresOrder, eventosOrder, homePool };
}

// ---------------------------------------------------------------------------
// Filesystem walk
// ---------------------------------------------------------------------------

async function walkImages(dir, prefix = '') {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await walkImages(abs, rel)));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      out.push({ absPath: abs, relPath: `images/${rel}`, parts: rel.split('/') });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

function inferCollectionFromParts(parts) {
  // parts = ['autoral', 'marco-2026', 'IMG_7208.jpg']
  const topFolder = parts[0];
  const topCollection = TOP_COLLECTION_BY_FOLDER[topFolder];
  if (!topCollection) return null;

  // No sub-collection axis
  if (!HAS_SUBCOLLECTIONS.has(topCollection)) {
    return { topSlug: topCollection, subSlug: null, subFolder: null };
  }

  // Has sub-collections but photo is directly under top folder (no sub-folder)
  if (parts.length === 2) {
    return { topSlug: topCollection, subSlug: null, subFolder: null };
  }

  // Sub-folder exists
  const subFolder = parts[1];
  let subSuffix = subFolder;
  if (topCollection === 'lugares' && LUGARES_SUB_ALIASES[subFolder]) {
    subSuffix = LUGARES_SUB_ALIASES[subFolder];
  }
  const subSlug = `${topCollection}-${subSuffix}`;
  return { topSlug: topCollection, subSlug, subFolder };
}

async function extractDimensions(absPath) {
  const buf = await fs.readFile(absPath);
  const dims = imageSize(buf);
  return { width: dims.width, height: dims.height };
}

async function extractTakenAt(absPath, folderParts) {
  // Try EXIF
  try {
    const exif = await exifr.parse(absPath, { pick: ['DateTimeOriginal', 'CreateDate'] });
    const dt = exif?.DateTimeOriginal || exif?.CreateDate;
    if (dt instanceof Date && !isNaN(dt.getTime())) {
      return { date: dt, source: 'exif' };
    }
  } catch {
    // fall through
  }

  // Fallback: parse folder name (e.g. "marco-2026" or "2024-2025")
  for (const part of folderParts) {
    const rangeMatch = part.match(/^(\d{4})-(\d{4})$/);
    if (rangeMatch) {
      // Range: pick middle
      return { date: new Date(`${rangeMatch[0].slice(0, 4)}-06-01`), source: 'folder' };
    }
    const monthMatch = part.match(/^([a-z]+)-(\d{4})$/);
    if (monthMatch && MONTH_SLUG_TO_IDX[monthMatch[1]] !== undefined) {
      const idx = MONTH_SLUG_TO_IDX[monthMatch[1]];
      return { date: new Date(Date.UTC(parseInt(monthMatch[2], 10), idx, 1)), source: 'folder' };
    }
    if (/^\d{4}$/.test(part)) {
      return { date: new Date(Date.UTC(parseInt(part, 10), 0, 1)), source: 'folder' };
    }
  }

  return { date: null, source: 'null' };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function loadExistingCollections() {
  const { data, error } = await supabase.from('collections').select('id, slug, parent_slug');
  if (error) throw error;
  const bySlug = new Map();
  for (const c of data) bySlug.set(c.slug, c);
  return bySlug;
}

async function ensureCollection(slug, parentSlug, names, bySlug) {
  if (bySlug.has(slug)) return bySlug.get(slug);
  if (DRY_RUN) {
    console.log(`[DRY] criaria collection: ${slug} (parent=${parentSlug}, name_pt=${names.pt})`);
    const stub = { id: `stub-${slug}`, slug, parent_slug: parentSlug };
    bySlug.set(slug, stub);
    return stub;
  }
  const { data, error } = await supabase
    .from('collections')
    .insert({
      slug,
      parent_slug: parentSlug,
      name_pt: names.pt,
      name_en: names.en,
      name_es: names.es,
      display_order: 100 // append at end of siblings; user can reorder in admin
    })
    .select('id, slug, parent_slug')
    .single();
  if (error) throw new Error(`falha ao criar collection ${slug}: ${error.message}`);
  bySlug.set(slug, data);
  console.log(`OK collection criada: ${slug}`);
  return data;
}

async function photoExistsForPath(storagePath) {
  const { data, error } = await supabase.from('photos').select('id').eq('storage_path', storagePath).maybeSingle();
  if (error) throw error;
  return !!data;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN' : 'REAL'} · limite: ${LIMIT === Infinity ? 'sem' : LIMIT}`);
  console.log('Carregando ordem visual de HTML...');
  const orders = await loadAllOrders();
  console.log(`  autoral: ${orders.autoralOrder.size} · prewedding: ${orders.preweddingOrder.size} · lugares: ${orders.lugaresOrder.size} · eventos: ${orders.eventosOrder.size} · home pool: ${orders.homePool.size}`);

  console.log('Carregando collections existentes...');
  const collectionsBySlug = await loadExistingCollections();
  console.log(`  ${collectionsBySlug.size} collections no banco`);

  console.log('Andando images/...');
  const allFiles = await walkImages(IMAGES_DIR);
  console.log(`  ${allFiles.length} arquivos de imagem`);

  const skipTopFolders = new Set(['home', 'hero']);
  const skipNames = new Set(['about.png', 'about_original.png', 'about-poster.jpg']);

  const stats = {
    processed: 0,
    skipped: 0,
    errored: 0,
    byTopCollection: {},
    bySubCollection: {},
    bySource: { exif: 0, folder: 0, null: 0 },
    homeFeatured: 0,
    duplicatesSkipped: 0
  };

  let count = 0;
  for (const file of allFiles) {
    if (count >= LIMIT) break;

    if (skipTopFolders.has(file.parts[0])) {
      stats.skipped++;
      continue;
    }
    if (skipNames.has(file.parts[file.parts.length - 1])) {
      stats.skipped++;
      continue;
    }

    try {
      const collection = inferCollectionFromParts(file.parts);
      if (!collection) {
        console.warn(`[SKIP] sem coleção pra ${file.relPath}`);
        stats.skipped++;
        continue;
      }

      const dims = await extractDimensions(file.absPath);
      const takenAt = await extractTakenAt(file.absPath, file.parts);

      // Ensure sub-collection exists if applicable
      let leafCollection;
      if (collection.subSlug) {
        const names = inferSubcollectionNames(
          collection.subSlug.replace(`${collection.topSlug}-`, ''),
          collection.topSlug
        );
        leafCollection = await ensureCollection(collection.subSlug, collection.topSlug, names, collectionsBySlug);
      } else {
        leafCollection = collectionsBySlug.get(collection.topSlug);
        if (!leafCollection) {
          console.warn(`[SKIP] top collection não seeded: ${collection.topSlug} — corrija seed em 0003`);
          stats.skipped++;
          continue;
        }
      }

      // Determine display_order and is_home_featured
      let displayOrder = 999;
      let sectionSubSlug = null;
      if (collection.topSlug === 'autoral') {
        displayOrder = orders.autoralOrder.get(file.relPath) ?? 999;
      } else if (collection.topSlug === 'prewedding') {
        displayOrder = orders.preweddingOrder.get(file.relPath) ?? 999;
      } else if (collection.topSlug === 'lugares') {
        const info = orders.lugaresOrder.get(file.relPath);
        if (info) {
          displayOrder = info.order;
          sectionSubSlug = info.subSlug;
        }
      } else if (collection.topSlug === 'eventos') {
        const info = orders.eventosOrder.get(file.relPath);
        if (info) displayOrder = info.order;
      }

      const isHomeFeatured = orders.homePool.has(file.relPath);
      if (isHomeFeatured) stats.homeFeatured++;

      // Storage path
      const year = takenAt.date ? takenAt.date.getUTCFullYear() : new Date().getUTCFullYear();
      const ext = path.extname(file.absPath).toLowerCase().replace('.jpeg', '.jpg') || '.jpg';
      const uuid = randomUUID();
      const storagePath = `${leafCollection.slug}/${year}/${uuid}${ext}`;

      // Idempotency check
      if (!DRY_RUN) {
        const exists = await photoExistsForPath(storagePath);
        if (exists) {
          stats.duplicatesSkipped++;
          if (VERBOSE) console.log(`[dup] pulando ${storagePath}`);
          continue;
        }
      }

      if (DRY_RUN || VERBOSE) {
        console.log(`${DRY_RUN ? '[DRY]' : 'OK'} ${file.relPath} → ${leafCollection.slug} · ${dims.width}×${dims.height} · ${takenAt.source} · order=${displayOrder}${isHomeFeatured ? ' · HOME' : ''}`);
      }

      if (!DRY_RUN) {
        // Upload to storage
        const buf = await fs.readFile(file.absPath);
        const { error: upErr } = await supabase.storage
          .from('photos')
          .upload(storagePath, buf, {
            contentType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
            upsert: false
          });
        if (upErr && !upErr.message?.includes('already exists')) {
          throw new Error(`upload falhou: ${upErr.message}`);
        }

        // Insert photo row
        const { error: dbErr } = await supabase.from('photos').insert({
          collection_id: leafCollection.id,
          storage_path: storagePath,
          width: dims.width,
          height: dims.height,
          alt_pt: null,
          alt_en: null,
          alt_es: null,
          display_order: displayOrder,
          is_published: true,
          is_home_featured: isHomeFeatured,
          taken_at: takenAt.date ? takenAt.date.toISOString().split('T')[0] : null
        });
        if (dbErr) throw new Error(`insert falhou: ${dbErr.message}`);
      }

      stats.processed++;
      stats.byTopCollection[collection.topSlug] = (stats.byTopCollection[collection.topSlug] || 0) + 1;
      if (collection.subSlug) {
        stats.bySubCollection[collection.subSlug] = (stats.bySubCollection[collection.subSlug] || 0) + 1;
      }
      stats.bySource[takenAt.source]++;
      count++;
    } catch (err) {
      stats.errored++;
      console.error(`ERRO em ${file.relPath}: ${err.message}`);
    }
  }

  // Report
  console.log('\n' + '='.repeat(60));
  console.log(`Fotos processadas: ${stats.processed}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Puladas: ${stats.skipped}`);
  console.log(`Erros: ${stats.errored}`);
  console.log(`Duplicatas encontradas: ${stats.duplicatesSkipped}`);
  console.log('\nPor coleção top-level:');
  for (const [k, v] of Object.entries(stats.byTopCollection)) console.log(`  ${k}: ${v}`);
  console.log('\nPor sub-coleção:');
  for (const [k, v] of Object.entries(stats.bySubCollection)) console.log(`  ${k}: ${v}`);
  console.log('\nFonte de taken_at:');
  console.log(`  EXIF: ${stats.bySource.exif}`);
  console.log(`  Pasta: ${stats.bySource.folder}`);
  console.log(`  null: ${stats.bySource.null}`);
  console.log(`\nHome featured: ${stats.homeFeatured}`);
  console.log('='.repeat(60));

  if (stats.bySource.null > stats.processed * 0.5) {
    console.warn('\nATENÇÃO: mais de 50% das fotos ficaram sem taken_at. Investigar EXIF/pastas.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
