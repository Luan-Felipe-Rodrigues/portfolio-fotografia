#!/usr/bin/env node
/*
 * reconcile-likes.js
 *
 * After S1.11 migration, existing rows in public.photo_likes are keyed by
 * the OLD photo path (e.g. "images/lugares/roma/IMG_5888.jpeg"). New photos
 * have UUID primary keys and different storage_paths, so those likes are
 * orphaned.
 *
 * This script maps each old like row to the corresponding new photo row by:
 *   1. Normalizing the old path (italia→toscana, rio-de-janeiro alias)
 *   2. Reading the local file for width/height
 *   3. Querying public.photos in the target collection with matching dims
 *   4. Inserting a new photo_likes row keyed by the new UUID
 *   5. Deleting the old row
 *
 * Also deletes obvious test rows (photo_id starting with 'test/').
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run reconcile-likes:dry
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run reconcile-likes
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

// Match the aliases from migrate-photos.js
const LUGARES_SUB_ALIASES = { 'rio-de-janeiro': 'rio' };
const HAS_SUBCOLLECTIONS = new Set(['autoral', 'lugares']);
const TOP_COLLECTION_BY_FOLDER = {
  autoral: 'autoral',
  prewedding: 'prewedding',
  lugares: 'lugares',
  eventos: 'eventos',
  'eventos-fimdeano': 'eventos',
  'eventos-fimdeano-2024': 'eventos'
};

function localPathFromOldId(oldId) {
  // oldId format: 'images/lugares/italia/IMG_5886.jpeg'
  // After the S1.11 rename, italia lives at toscana on disk.
  let local = oldId
    .replace('/lugares/italia/', '/lugares/toscana/');
  return path.join(REPO_ROOT, local);
}

function collectionSlugForOldId(oldId) {
  // Strip 'images/' prefix, split
  const rel = oldId.startsWith('images/') ? oldId.slice(7) : oldId;
  const parts = rel.split('/');
  const topFolder = parts[0];
  const topSlug = TOP_COLLECTION_BY_FOLDER[topFolder];
  if (!topSlug) return null;

  if (!HAS_SUBCOLLECTIONS.has(topSlug)) return topSlug;

  if (parts.length < 3) return topSlug;

  let sub = parts[1];
  // Apply alias for italia (folder renamed) and rio-de-janeiro (slug alias)
  if (topSlug === 'lugares') {
    if (sub === 'italia') sub = 'toscana';
    else if (LUGARES_SUB_ALIASES[sub]) sub = LUGARES_SUB_ALIASES[sub];
  }
  return `${topSlug}-${sub}`;
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN' : 'REAL'}\n`);

  const { data: likes, error: likesErr } = await supabase
    .from('photo_likes')
    .select('*');
  if (likesErr) throw likesErr;
  console.log(`photo_likes: ${likes.length} rows`);

  // Load collections map
  const { data: cols, error: colsErr } = await supabase
    .from('collections')
    .select('id, slug');
  if (colsErr) throw colsErr;
  const collectionIdBySlug = new Map(cols.map((c) => [c.slug, c.id]));

  const stats = {
    testDeleted: 0,
    reconciled: 0,
    ambiguous: 0,
    fileMissing: 0,
    collectionMissing: 0,
    noMatch: 0,
    alreadyDone: 0
  };

  for (const like of likes) {
    const oldId = like.photo_id;

    // Skip already-reconciled rows (UUID-keyed)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oldId)) {
      stats.alreadyDone++;
      continue;
    }

    // Delete test rows
    if (oldId.startsWith('test/')) {
      console.log(`[test] deletando ${oldId} (count=${like.count})`);
      if (!DRY_RUN) {
        const { error } = await supabase.from('photo_likes').delete().eq('photo_id', oldId);
        if (error) console.error('  falha delete:', error.message);
      }
      stats.testDeleted++;
      continue;
    }

    const localPath = localPathFromOldId(oldId);
    let dims;
    try {
      const buf = await fs.readFile(localPath);
      dims = imageSize(buf);
    } catch {
      console.log(`[no-file] ${oldId} — arquivo local não existe (${path.relative(REPO_ROOT, localPath)})`);
      stats.fileMissing++;
      continue;
    }

    const targetSlug = collectionSlugForOldId(oldId);
    if (!targetSlug) {
      console.log(`[no-collection-inference] ${oldId}`);
      stats.collectionMissing++;
      continue;
    }
    const collectionId = collectionIdBySlug.get(targetSlug);
    if (!collectionId) {
      console.log(`[no-collection-in-db] ${oldId} → ${targetSlug}`);
      stats.collectionMissing++;
      continue;
    }

    // Query photos in this collection with matching dimensions
    const { data: candidates, error: candErr } = await supabase
      .from('photos')
      .select('id, width, height, taken_at, storage_path')
      .eq('collection_id', collectionId)
      .eq('width', dims.width)
      .eq('height', dims.height);
    if (candErr) throw candErr;

    if (!candidates.length) {
      console.log(`[no-match] ${oldId} → ${targetSlug} sem foto ${dims.width}x${dims.height}`);
      stats.noMatch++;
      continue;
    }

    let matched = candidates[0];

    if (candidates.length > 1) {
      // Tiebreak by EXIF DateTimeOriginal from local file.
      let localTaken = null;
      try {
        const exif = await exifr.parse(localPath, { pick: ['DateTimeOriginal', 'CreateDate'] });
        const dt = exif?.DateTimeOriginal || exif?.CreateDate;
        if (dt instanceof Date && !isNaN(dt.getTime())) {
          localTaken = dt.toISOString().split('T')[0];
        }
      } catch { /* noop */ }

      if (localTaken) {
        const narrow = candidates.filter((c) => c.taken_at === localTaken);
        if (narrow.length === 1) {
          matched = narrow[0];
        } else if (narrow.length > 1) {
          console.log(`[ambiguous] ${oldId} → ${targetSlug} ${candidates.length} matches, ${narrow.length} bate no dia ${localTaken}`);
          stats.ambiguous++;
          continue;
        } else {
          console.log(`[ambiguous] ${oldId} → ${targetSlug} EXIF ${localTaken} não bate nenhuma taken_at (${candidates.map((c) => c.taken_at).join(', ')})`);
          stats.ambiguous++;
          continue;
        }
      } else {
        console.log(`[ambiguous] ${oldId} → ${targetSlug} ${candidates.length} matches sem EXIF pra desempatar`);
        stats.ambiguous++;
        continue;
      }
    }

    const newId = matched.id;
    console.log(`OK ${oldId} → ${newId} (${targetSlug}, count=${like.count})`);

    if (!DRY_RUN) {
      // Upsert new row (count from old like)
      const { error: insErr } = await supabase
        .from('photo_likes')
        .upsert({ photo_id: newId, count: like.count }, { onConflict: 'photo_id' });
      if (insErr) {
        console.error('  falha insert:', insErr.message);
        continue;
      }
      // Delete old row
      const { error: delErr } = await supabase.from('photo_likes').delete().eq('photo_id', oldId);
      if (delErr) {
        console.error('  falha delete:', delErr.message);
        continue;
      }
    }
    stats.reconciled++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('Reconciliation report:');
  console.log(`  Reconciled: ${stats.reconciled}`);
  console.log(`  Test rows deletadas: ${stats.testDeleted}`);
  console.log(`  Ambiguous (múltiplos matches): ${stats.ambiguous}`);
  console.log(`  Sem arquivo local: ${stats.fileMissing}`);
  console.log(`  Coleção não encontrada: ${stats.collectionMissing}`);
  console.log(`  Sem match no banco: ${stats.noMatch}`);
  console.log(`  Já UUID-keyed (skipped): ${stats.alreadyDone}`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
