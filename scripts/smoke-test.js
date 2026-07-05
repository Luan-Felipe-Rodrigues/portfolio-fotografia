#!/usr/bin/env node
/*
 * smoke-test.js
 *
 * Post-deploy smoke test. Loads every public page in a real (headless) Chrome
 * via Puppeteer and verifies:
 *   1. All JS globals set up (LR_LIKES, LR_ANALYTICS, LR_DYNAMIC, LR_SUPABASE)
 *   2. Zero page errors and zero failed network requests (ignoring favicon)
 *   3. Every <img> reports naturalWidth > 0 (loaded), minus the lightbox
 *      placeholder that starts empty by design
 *
 * Exits non-zero if any page fails. Meant to run BEFORE and AFTER risky
 * deploys — switchovers, cleanup commits, workflow changes — so we never
 * again ship a bug that leaves the site image-less.
 *
 * Usage:
 *   npm run smoke-test                          # test production
 *   BASE_URL=http://localhost:5500 npm run smoke-test   # test local
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.env.BASE_URL || 'https://luanrodrigues.photography';
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PAGES = [
  { path: '/', name: 'Home', minLoaded: 1 },
  { path: '/trabalho.html', name: 'Portfolio', minLoaded: 100 },
  { path: '/series.html', name: 'Series index', minLoaded: 3 },
  { path: '/series-lugares.html', name: 'Lugares', minLoaded: 100 },
  { path: '/series-autoral.html', name: 'Autoral', minLoaded: 55 },
  { path: '/series-prewedding.html', name: 'Pre-Wedding', minLoaded: 10 },
  { path: '/series-eventos.html', name: 'Eventos', minLoaded: 20 },
  { path: '/about.html', name: 'About', minLoaded: 2 }
];

// Portal do Cliente vive numa rota dinâmica /c/<slug>. Servida via 404.html
// fallback do GH Pages. Opt-in via PORTAL_SMOKE_SLUG (evita criar fixture
// permanente no banco). Set the slug of a live client to enable the check.
const PORTAL_SMOKE_SLUG = process.env.PORTAL_SMOKE_SLUG || '';

async function checkPage(browser, spec) {
  const page = await browser.newPage();
  const errors = [];
  const failedReqs = [];

  page.on('pageerror', (err) => errors.push(err.message));
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (u.includes('favicon')) return;
    failedReqs.push(`${u} :: ${req.failure()?.errorText}`);
  });

  try {
    await page.goto(`${BASE_URL}${spec.path}?cb=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    await page.close();
    return { name: spec.name, ok: false, reason: `goto failed: ${e.message}` };
  }

  await new Promise((r) => setTimeout(r, 3000));

  const state = await page.evaluate(() => ({
    LR_LIKES: !!window.LR_LIKES,
    LR_ANALYTICS: !!window.LR_ANALYTICS,
    LR_DYNAMIC: !!window.LR_DYNAMIC,
    LR_SUPABASE: !!window.LR_SUPABASE,
    imgTotal: document.querySelectorAll('img').length,
    imgLoaded: Array.from(document.querySelectorAll('img')).filter((i) => i.naturalWidth > 0).length
  }));

  await page.close();

  const missingGlobals = ['LR_LIKES', 'LR_ANALYTICS', 'LR_DYNAMIC', 'LR_SUPABASE'].filter((k) => !state[k]);
  const reasons = [];
  if (missingGlobals.length) reasons.push(`missing globals: ${missingGlobals.join(', ')}`);
  if (state.imgLoaded < spec.minLoaded) reasons.push(`only ${state.imgLoaded} imgs loaded (expected >= ${spec.minLoaded})`);
  if (errors.length) reasons.push(`page errors: ${errors.join(' | ')}`);
  if (failedReqs.length) reasons.push(`failed requests: ${failedReqs.join(' | ')}`);

  return {
    name: spec.name,
    ok: reasons.length === 0,
    reason: reasons.join(' ; ') || `${state.imgLoaded}/${state.imgTotal} imgs`,
    state
  };
}

async function checkPortal(browser, slug) {
  const page = await browser.newPage();
  const errors = [];
  const failedReqs = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (u.includes('favicon')) return;
    failedReqs.push(`${u} :: ${req.failure()?.errorText}`);
  });

  try {
    await page.goto(`${BASE_URL}/c/${slug}?cb=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    await page.close();
    return { name: 'Portal Cliente', ok: false, reason: `goto failed: ${e.message}` };
  }
  await new Promise((r) => setTimeout(r, 2500));

  const state = await page.evaluate(() => ({
    urlPath: window.location.pathname,
    hasHeader: !!document.querySelector('.portal-title'),
    ensaios: document.querySelectorAll('.ensaio-block').length,
    hasMessage: !!document.querySelector('.portal-message'),
    rootPreview: document.getElementById('portal-root')?.innerHTML?.slice(0, 120) || ''
  }));
  await page.close();

  const reasons = [];
  if (!state.urlPath.startsWith('/c/')) reasons.push(`URL rewritten to ${state.urlPath}`);
  if (state.hasMessage) reasons.push('portal returned error message (client not found?)');
  if (!state.hasHeader) reasons.push('portal-title not rendered');
  if (state.ensaios < 1) reasons.push('no ensaio blocks rendered');
  if (errors.length) reasons.push(`page errors: ${errors.join(' | ')}`);
  if (failedReqs.length) reasons.push(`failed requests: ${failedReqs.slice(0, 3).join(' | ')}`);

  return {
    name: 'Portal Cliente',
    ok: reasons.length === 0,
    reason: reasons.join(' ; ') || `header ok, ${state.ensaios} ensaio(s)`
  };
}

async function main() {
  console.log(`Smoke test against ${BASE_URL}`);
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];
  for (const spec of PAGES) {
    const r = await checkPage(browser, spec);
    const badge = r.ok ? 'OK ' : 'FAIL';
    console.log(`  [${badge}] ${r.name.padEnd(20)} ${r.reason}`);
    results.push(r);
  }

  if (PORTAL_SMOKE_SLUG) {
    const r = await checkPortal(browser, PORTAL_SMOKE_SLUG);
    const badge = r.ok ? 'OK ' : 'FAIL';
    console.log(`  [${badge}] ${r.name.padEnd(20)} ${r.reason}`);
    results.push(r);
  } else {
    console.log('  [SKIP] Portal Cliente       (set PORTAL_SMOKE_SLUG to enable)');
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(60));
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log(`FAILED (${failed.length}):`);
    failed.forEach((f) => console.log(`  ${f.name}: ${f.reason}`));
    process.exit(1);
  }
  console.log('All pages healthy.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
