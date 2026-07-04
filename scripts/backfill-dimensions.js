#!/usr/bin/env node
/*
 * backfill-dimensions.js
 *
 * The migrate-photos.js script recorded raw pixel dimensions from image-size,
 * which ignores the EXIF orientation flag. For photos captured landscape but
 * meant to display portrait (orientation 6 or 8), the stored width/height
 * are swapped relative to what the browser (and Supabase transform) actually
 * render. That mismatch caused thumbnails to render as vertical strips
 * (Supabase interprets our width=200 without a matching height as "clip to
 * 200 wide, keep original height").
 *
 * This script re-reads each local file, applies EXIF orientation to compute
 * the *rendered* dimensions, and updates public.photos where the DB values
 * differ.
 *
 * Usage:
 *   npm run backfill-dimensions:dry
 *   npm run backfill-dimensions
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import imageSize from 'image-size';
import exifr from 'exifr';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERRO: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Reconstruct the local file path from storage_path. The migration mapped
// filesystem folder → collection slug, so we can reverse it for lookup.
const SUB_TO_FOLDER = {
  // No autoral aliases (folder = slug suffix)
  'lugares-rio': 'lugares/rio-de-janeiro'
};

function collectionSlugToFolder(slug) {
  if (SUB_TO_FOLDER[slug]) return SUB_TO_FOLDER[slug];
  // autoral-marco-2026 → autoral/marco-2026
  const parts = slug.split('-');
  if (parts[0] === 'autoral' && parts.length > 1) return `autoral/${parts.slice(1).join('-')}`;
  if (parts[0] === 'lugares' && parts.length > 1) return `lugares/${parts.slice(1).join('-')}`;
  return parts.join('/');
}

async function findLocalPath(storagePath) {
  // storage_path like: autoral-2024-2025/2022/uuid.jpg — but the UUID has
  // nothing to do with the original filename. We can't recover the exact
  // local file from storage_path alone. Instead, we need to match against
  // photos by unique metadata.
  return null;
}

// Alternative approach: walk local files, match against DB by
// (collection_slug, dimensions in either orientation).
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

async function realDimensions(absPath) {
  const buf = await fs.readFile(absPath);
  const raw = imageSize(buf);
  let orientation = 1;
  try {
    orientation = await exifr.orientation(absPath);
  } catch { /* noop */ }
  const rotated = orientation && orientation >= 5 && orientation <= 8;
  if (rotated) return { width: raw.height, height: raw.width, orientation };
  return { width: raw.width, height: raw.height, orientation };
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN' : 'REAL'}\n`);

  // 1. Walk local files and compute (path → { rawW, rawH, realW, realH }).
  const localFiles = await walkImages(path.join(REPO_ROOT, 'images'));
  const skipTop = new Set(['home', 'hero']);
  const filtered = localFiles.filter((f) => !skipTop.has(f.parts[0]));
  console.log(`Local files to check: ${filtered.length}`);

  // 2. Load all photos with collection slug.
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, storage_path, width, height, collection:collections(slug)');
  if (error) throw error;
  console.log(`Photos in DB: ${photos.length}\n`);

  // 3. Group DB photos by collection slug.
  const bySlug = new Map();
  for (const p of photos) {
    const slug = p.collection?.slug;
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(p);
  }

  const stats = {
    filesChecked: 0,
    filesRotated: 0,
    filesNormal: 0,
    photosToSwap: new Set(),
    updated: 0,
    unmatched: 0
  };

  // Pass 1: collect distinct (slug, rawWidth, rawHeight) tuples for rotated
  // files. Photos in DB with those raw dims need to be swapped.
  const swapTargets = new Map(); // key: `${slug}|${rawW}x${rawH}` → { slug, rawW, rawH, realW, realH }

  for (const file of filtered) {
    stats.filesChecked++;
    const parts = file.parts;
    const topFolder = parts[0];
    let slug = null;
    if (topFolder === 'autoral' && parts.length >= 3) slug = `autoral-${parts[1]}`;
    else if (topFolder === 'lugares' && parts.length >= 3) {
      const sub = parts[1] === 'rio-de-janeiro' ? 'rio' : parts[1];
      slug = `lugares-${sub}`;
    } else if (topFolder === 'prewedding') slug = 'prewedding';
    else if (topFolder.startsWith('eventos')) slug = 'eventos';
    if (!slug) continue;

    const dims = await realDimensions(file.absPath);
    const rotated = dims.orientation >= 5 && dims.orientation <= 8;
    if (!rotated) {
      stats.filesNormal++;
      continue;
    }
    stats.filesRotated++;

    // The migration stored raw dims (swapped from real). So DB row will have
    // (rawWidth, rawHeight) = (realHeight, realWidth). We want to update it
    // to (realWidth, realHeight).
    const rawW = dims.height;
    const rawH = dims.width;
    const key = `${slug}|${rawW}x${rawH}`;
    if (!swapTargets.has(key)) {
      swapTargets.set(key, { slug, rawW, rawH, realW: dims.width, realH: dims.height });
    }
  }

  console.log(`Files: total=${stats.filesChecked}, rotated=${stats.filesRotated}, normal=${stats.filesNormal}`);
  console.log(`Swap targets (slug × dims): ${swapTargets.size}\n`);

  // Pass 2: update DB photos matching any swap target.
  for (const target of swapTargets.values()) {
    const candidates = bySlug.get(target.slug) || [];
    const matches = candidates.filter((p) => p.width === target.rawW && p.height === target.rawH);
    if (!matches.length) {
      console.log(`[none] ${target.slug} ${target.rawW}×${target.rawH} → não encontrou photos com esses dims`);
      stats.unmatched++;
      continue;
    }
    for (const p of matches) {
      stats.photosToSwap.add(p.id);
      if (DRY_RUN) {
        console.log(`[DRY] ${target.slug} id=${p.id.slice(0, 8)} ${p.width}x${p.height} → ${target.realW}x${target.realH}`);
      } else {
        const { error: upErr } = await supabase
          .from('photos')
          .update({ width: target.realW, height: target.realH })
          .eq('id', p.id);
        if (upErr) console.error(`  falha id=${p.id}: ${upErr.message}`);
        else stats.updated++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Files rotated (orient 5-8): ${stats.filesRotated}`);
  console.log(`Distinct DB photos to swap: ${stats.photosToSwap.size}`);
  if (!DRY_RUN) console.log(`Updated: ${stats.updated}`);
  console.log(`Swap targets with no DB match: ${stats.unmatched}`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
