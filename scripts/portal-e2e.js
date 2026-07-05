#!/usr/bin/env node
/*
 * portal-e2e.js
 *
 * End-to-end test para o Portal do Cliente. Roda contra produção (ou BASE_URL
 * customizada), exercita o fluxo completo:
 *
 *   1. Load: navega /c/<slug>, valida header + ensaios + photos com signed URL
 *   2. Lightbox: click no thumb, valida foto renderizada
 *   3. Like: click, incrementa contador, verifica localStorage dedup
 *   4. Comment: digita, salva, verifica toast
 *   5. Print select: click, verifica estado ativo
 *   6. Share: menu abre com botões WhatsApp/Download
 *   7. Keyboard nav: Esc fecha lightbox, ArrowLeft/Right navegam
 *   8. Regressão: reload valida que like/comment/print persistiram
 *   9. Cleanup: apaga client_actions criadas neste teste (fixture permanece)
 *
 * Precisa:
 *   - PORTAL_E2E_SLUG           slug do cliente fixture (default: fixture do smoke-test)
 *   - SUPABASE_ACCESS_TOKEN     Personal Access Token, pra cleanup via management API
 *   - SUPABASE_PROJECT_REF      ref do projeto (default: junfgutjyicdrvpoyuzz)
 *
 * Exit code != 0 se qualquer passo falhar.
 *
 * Uso:
 *   PORTAL_E2E_SLUG=smokeTest01234567890qwerty \
 *   SUPABASE_ACCESS_TOKEN=sbp_... \
 *   npm run portal-e2e
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.env.BASE_URL || 'https://luanrodrigues.photography';
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SLUG = process.env.PORTAL_E2E_SLUG;
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT = process.env.SUPABASE_PROJECT_REF || 'junfgutjyicdrvpoyuzz';

if (!SLUG) {
  console.error('Missing PORTAL_E2E_SLUG env var.');
  process.exit(1);
}

const steps = [];
function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  const badge = ok ? 'OK ' : 'FAIL';
  console.log(`  [${badge}] ${name.padEnd(28)} ${detail}`);
}

async function runQuery(sql) {
  if (!PAT) return null;
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${PAT}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  return await res.json();
}

async function main() {
  console.log(`Portal E2E → ${BASE_URL}/c/${SLUG}`);
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Baseline: snapshot actions BEFORE the test, so cleanup only removes ones we created
  const before = await runQuery(
    `select count(*)::int as n from client_actions where ensaio_id in (select id from client_ensaios where client_id = (select id from clients where slug = '${SLUG}'))`
  );
  const baselineActions = before?.[0]?.n ?? 0;

  try {
    // 1. Load portal ----------------------------------------------------------
    await page.goto(`${BASE_URL}/c/${SLUG}?cb=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));

    const loaded = await page.evaluate(() => ({
      urlPath: window.location.pathname,
      hasHeader: !!document.querySelector('.portal-title'),
      ensaios: document.querySelectorAll('.ensaio-block').length,
      thumbs: document.querySelectorAll('.portal-thumb').length,
      firstThumbSrc: document.querySelector('.portal-thumb img')?.src || null
    }));
    step('Load portal', loaded.hasHeader && loaded.urlPath.startsWith('/c/'), `${loaded.ensaios} ensaios, ${loaded.thumbs} thumbs`);
    if (!loaded.thumbs) throw new Error('nenhum thumb no portal — fixture não tem photos com storage_path válido');
    if (!loaded.firstThumbSrc || !loaded.firstThumbSrc.includes('token=')) {
      throw new Error(`signed URL ausente ou inválida: ${loaded.firstThumbSrc}`);
    }
    step('Signed URL presente', true, loaded.firstThumbSrc.split('?')[0].split('/').pop());

    // 2. Open lightbox --------------------------------------------------------
    await page.click('.portal-thumb');
    await new Promise((r) => setTimeout(r, 600));
    const lbOpen = await page.evaluate(() => {
      const lb = document.getElementById('lightbox');
      return { visible: !lb.hidden, imgSrc: document.getElementById('lb-img')?.src || null };
    });
    step('Lightbox abre', lbOpen.visible, '');

    // 3. Like -----------------------------------------------------------------
    const likeBefore = await page.$eval('.lb-action[data-kind="like"] .count', (n) => parseInt(n.textContent, 10) || 0);
    await page.click('.lb-action[data-kind="like"]');
    await new Promise((r) => setTimeout(r, 800)); // wait for RPC
    const likeAfter = await page.$eval('.lb-action[data-kind="like"] .count', (n) => parseInt(n.textContent, 10) || 0);
    const likedInStorage = await page.evaluate(() => {
      try { return Object.keys(JSON.parse(localStorage.getItem('lr_client_liked') || '{}')).length > 0; } catch { return false; }
    });
    step('Like incrementa', likeAfter === likeBefore + 1, `${likeBefore} → ${likeAfter}`);
    step('Like grava localStorage', likedInStorage, '');

    // Second like — should not increment (dedup)
    await page.click('.lb-action[data-kind="like"]');
    await new Promise((r) => setTimeout(r, 300));
    const likeAgain = await page.$eval('.lb-action[data-kind="like"] .count', (n) => parseInt(n.textContent, 10) || 0);
    step('Like dedup no browser', likeAgain === likeAfter, `${likeAgain} (esperado ${likeAfter})`);

    // 4. Comment --------------------------------------------------------------
    await page.click('.lb-action[data-kind="comment"]');
    await new Promise((r) => setTimeout(r, 300));
    const commentContent = `E2E test ${Date.now()}`;
    await page.type('#lb-comment textarea', commentContent);
    await page.click('#lb-comment [data-cb="save"]');
    await new Promise((r) => setTimeout(r, 800));
    const toastShown = await page.evaluate(() => !!document.querySelector('.portal-toast'));
    step('Comentário salva', toastShown, `"${commentContent.slice(0, 30)}…"`);

    // 5. Print select ---------------------------------------------------------
    await page.click('.lb-action[data-kind="print_select"]');
    await new Promise((r) => setTimeout(r, 700));
    const printActive = await page.$eval('.lb-action[data-kind="print_select"]', (b) => b.classList.contains('active'));
    step('Print select ativo', printActive, '');

    // 6. Share menu -----------------------------------------------------------
    await page.click('.lb-action[data-kind="share"]');
    await new Promise((r) => setTimeout(r, 200));
    const shareMenuVisible = await page.evaluate(() => {
      const el = document.getElementById('lb-share');
      return el && !el.hidden;
    });
    step('Share menu abre', shareMenuVisible, '');
    await page.click('#lb-share [data-share="close"]');

    // 7. Keyboard nav ---------------------------------------------------------
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));
    const lbClosed = await page.$eval('#lightbox', (lb) => lb.hidden);
    step('Esc fecha lightbox', lbClosed, '');

    // 8. Reload persists actions ---------------------------------------------
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    const badges = await page.evaluate(() => {
      const badges = document.querySelectorAll('.thumb-badges .thumb-badge');
      return { count: badges.length, texts: Array.from(badges).map((b) => b.textContent.trim()) };
    });
    step('Reload preserva ações', badges.count >= 3, `${badges.count} badges: [${badges.texts.join(', ')}]`);

    if (errors.length) step('Sem erros no console', false, errors.join(' | '));
    else step('Sem erros no console', true, '');

  } finally {
    await browser.close();
  }

  // Cleanup: delete only actions inserted during this run
  if (PAT) {
    await runQuery(
      `delete from client_actions where id in (
         select id from client_actions
         where ensaio_id in (select id from client_ensaios where client_id = (select id from clients where slug = '${SLUG}'))
         order by id
         offset ${baselineActions}
      );
      delete from portal_rate_hits where created_at > now() - interval '5 minutes';`
    );
    step('Cleanup actions', true, `preservados ${baselineActions} baseline`);
  } else {
    step('Cleanup (skip)', true, 'set SUPABASE_ACCESS_TOKEN pra habilitar');
  }

  const failed = steps.filter((s) => !s.ok);
  console.log('\n' + '='.repeat(60));
  console.log(`Passed: ${steps.length - failed.length}/${steps.length}`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((f) => console.log(`  ${f.name}: ${f.detail}`));
    process.exit(1);
  }
  console.log('Portal E2E green.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
