#!/usr/bin/env node
/*
 * quote-wizard-e2e.js — Sprint 4 (D12 revisada 2026-07-05)
 *
 * E2E completo do modal wizard de cotação. Roda contra qualquer BASE_URL
 * (localhost, prod). Percorre 4 steps, submete, valida row no DB e limpa.
 *
 * Uso:
 *   BASE_URL=http://localhost:8877 \
 *   SUPABASE_ACCESS_TOKEN=sbp_... \
 *   npm run quote-e2e
 *
 * Sem SUPABASE_ACCESS_TOKEN, skipa a validação de DB e cleanup.
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.env.BASE_URL || 'https://luanrodrigues.photography';
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT = process.env.SUPABASE_PROJECT_REF || 'junfgutjyicdrvpoyuzz';

const steps = [];
function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  const badge = ok ? 'OK ' : 'FAIL';
  console.log(`  [${badge}] ${name.padEnd(32)} ${detail}`);
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

const EMAIL = `e2e-wizard+${Date.now()}@test-drop.local`;

async function main() {
  console.log(`Quote Wizard E2E → ${BASE_URL}/contact.html`);
  console.log(`Fixture email: ${EMAIL}`);
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    // 1. Load contact + verify CTA -----------------------------------------
    await page.goto(`${BASE_URL}/contact.html?cb=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 400));
    const cta = await page.evaluate(() => {
      const b = document.querySelector('[data-open-quote-wizard]');
      return b ? { text: b.textContent.trim(), visible: b.offsetParent !== null } : null;
    });
    step('CTA presente na contact', !!cta?.visible, cta?.text || '');
    if (!cta?.visible) throw new Error('CTA ausente');

    // Clear session so we start fresh
    await page.evaluate(() => sessionStorage.clear());

    // 2. Open wizard -------------------------------------------------------
    await page.click('[data-open-quote-wizard]');
    await new Promise((r) => setTimeout(r, 400));
    const s1 = await page.evaluate(() => ({
      open: document.querySelector('.qw-modal')?.classList.contains('open'),
      s1Ready: !!document.querySelector('.qw-choice[data-type="prewedding"]'),
      nextDisabled: document.querySelector('#qw-footer-right .qw-btn')?.disabled
    }));
    step('Modal abre em S1', s1.open && s1.s1Ready, '');
    step('Next disabled sem escolha', s1.nextDisabled, '');

    // 3. Pick prewedding + advance -----------------------------------------
    await page.click('.qw-choice[data-type="prewedding"]');
    await new Promise((r) => setTimeout(r, 200));
    const pickState = await page.evaluate(() => ({
      selected: document.querySelectorAll('.qw-choice.selected').length,
      nextDisabled: document.querySelector('#qw-footer-right .qw-btn')?.disabled
    }));
    step('Escolha ativa Next', pickState.selected === 1 && !pickState.nextDisabled, '');

    await page.click('#qw-footer-right .qw-btn');
    await new Promise((r) => setTimeout(r, 200));

    // 4. S2 — verify pre-fill ----------------------------------------------
    const s2 = await page.evaluate(() => ({
      title: document.querySelector('#qw-body h3')?.textContent,
      prefilledDur: document.querySelector('#qw-dur')?.value,
      progress: document.querySelector('#qw-progress-label')?.textContent
    }));
    step('S2 pré-preenche duração', s2.prefilledDur === '4', `duração=${s2.prefilledDur}h`);
    step('S2 progress correto', /2 de 4|2 of 4|2 de 4/.test(s2.progress || ''), s2.progress);

    // Fill location + advance
    await page.type('#qw-loc', 'Ilhabela');
    await page.click('#qw-flex');
    await new Promise((r) => setTimeout(r, 100));
    await page.click('#qw-footer-right .qw-btn');
    await new Promise((r) => setTimeout(r, 200));

    // 5. S3 — verify recommended badges pre-selected ----------------------
    const s3 = await page.evaluate(() => ({
      selected: document.querySelectorAll('.qw-badge.selected').length,
      recommended: document.querySelectorAll('.qw-badge.recommended').length,
      total: document.querySelectorAll('.qw-badge').length
    }));
    step('S3 pré-seleciona recomendados', s3.selected === 3 && s3.recommended === 3, `${s3.selected}/${s3.total} selected, ${s3.recommended} recommended`);

    // Add reference notes
    await page.type('#qw-refs', 'Ref: https://pinterest.com/exemplo');
    await page.click('#qw-footer-right .qw-btn');
    await new Promise((r) => setTimeout(r, 200));

    // 6. S4 — summary + estimate + validation ------------------------------
    const s4 = await page.evaluate(() => ({
      title: document.querySelector('#qw-body h3')?.textContent,
      estimate: document.querySelector('.qw-estimate-value')?.textContent,
      submitDisabled: document.querySelector('#qw-footer-right .qw-btn')?.disabled
    }));
    step('S4 mostra faixa estimada', /R\$/.test(s4.estimate || ''), s4.estimate);
    step('Submit disabled sem consent', s4.submitDisabled, '');

    // Fill contact + consent
    await page.type('#qw-name', 'E2E Wizard Test');
    await page.type('#qw-email', EMAIL);
    await page.click('#qw-consent');
    await new Promise((r) => setTimeout(r, 200));
    const canSubmit = await page.evaluate(() => !document.querySelector('#qw-footer-right .qw-btn')?.disabled);
    step('Submit enabled após dados', canSubmit, '');

    // 7. Submit ------------------------------------------------------------
    await page.click('#qw-footer-right .qw-btn');
    await new Promise((r) => setTimeout(r, 3500));
    const success = await page.evaluate(() => ({
      successVisible: !!document.querySelector('.qw-success'),
      title: document.querySelector('.qw-success h3')?.textContent,
      footerError: document.querySelector('.qw-footer-error')?.textContent || null,
      currentStep: document.querySelector('#qw-progress-label')?.textContent
    }));
    step('Success state renderizado', success.successVisible, success.title || `error="${success.footerError}" step="${success.currentStep}"`);

    // 8. Validate DB row --------------------------------------------------
    if (PAT) {
      const rows = await runQuery(
        `select id, status, ensaio_type, contact_name, location, styles, date_flexible, wizard_language from quote_requests where contact_email = '${EMAIL}';`
      );
      const row = rows?.[0];
      step('Row gravada no DB', !!row, row ? `${row.ensaio_type} · ${row.location} · flex=${row.date_flexible}` : '');
      if (row) {
        step('Ensaio type correto', row.ensaio_type === 'prewedding', row.ensaio_type);
        step('Location gravado', row.location === 'Ilhabela', row.location || '');
        step('Styles gravados', Array.isArray(row.styles) && row.styles.length >= 3, `${row.styles?.length || 0} styles`);
        step('Wizard language pt', row.wizard_language === 'pt', row.wizard_language);
      }
    } else {
      step('DB validation (skip)', true, 'set SUPABASE_ACCESS_TOKEN pra habilitar');
    }

    if (errors.length) step('Sem erros no console', false, errors.join(' | '));
    else step('Sem erros no console', true, '');

  } finally {
    await browser.close();
  }

  // Cleanup
  if (PAT) {
    await runQuery(`delete from quote_requests where contact_email = '${EMAIL}';`);
    step('Cleanup DB', true, EMAIL);
  }

  const failed = steps.filter((s) => !s.ok);
  console.log('\n' + '='.repeat(60));
  console.log(`Passed: ${steps.length - failed.length}/${steps.length}`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((f) => console.log(`  ${f.name}: ${f.detail}`));
    process.exit(1);
  }
  console.log('Quote Wizard E2E green.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
