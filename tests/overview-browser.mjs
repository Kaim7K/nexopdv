import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Reuses the local mock server; every browser context has disposable storage.
const base = process.env.NEXO_TEST_URL || 'http://127.0.0.1:5177';
const output = 'artifacts/refactor/overview';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'America/Bahia' });
    try {
      await context.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = '*,*::before,*::after{transition:none!important;animation:none!important} details:has(> summary .lucide-flask-conical){display:none!important}';
          document.head.append(style);
        });
      });
      await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
      await page.locator('input[type=email]').fill('demo@nexopdv.local');
      await page.locator('input[type=password]').fill('demo123');
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/inicio', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Seu dia em números' }).waitFor();
      const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
      const before = await db();
      const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important} details:has(> summary .lucide-flask-conical){display:none!important}' });
      const home = page.getByRole('region', { name: 'Resumo e ações da loja' });
      const summary = await page.evaluate(async () => {
        const { nexoApi } = await import('/src/api/nexoApi.js');
        return nexoApi.management.overview();
      });
      const format = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      assert.ok((await home.innerText()).includes(format(summary.sales.total)));
      for (const insight of [summary.products.low, summary.products.idle, summary.products.margin, summary.margin_declines].filter(Boolean)) {
        for (const product of insight.products) assert.ok((await home.innerText()).includes(product.name));
      }
      await overflow();
      await page.screenshot({ path: `${output}/home-${width}.png` });
      const checklist = home.locator('details');
      if (!await checklist.evaluate(node => node.open)) await checklist.locator('summary').click();
      const reviewed = page.getByRole('checkbox', { name: 'Conferi os preços e as quantidades' });
      await reviewed.check();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Seu dia em números' }).waitFor();
      const reloadedChecklist = home.locator('details');
      if (!await reloadedChecklist.evaluate(node => node.open)) await reloadedChecklist.locator('summary').click();
      assert.equal(await reviewed.isChecked(), true);
      await page.evaluate(async () => {
        const { nexoApi } = await import('/src/api/nexoApi.js');
        const original = nexoApi.management.overview;
        globalThis.restoreOverview = () => { nexoApi.management.overview = original; };
        nexoApi.management.overview = () => new Promise((resolve, reject) => { globalThis.overviewPending = { resolve, reject }; });
      });
      await page.getByRole('button', { name: 'Atualizar resumo' }).click();
      await page.waitForFunction(() => Boolean(globalThis.overviewPending));
      assert.equal(await page.getByRole('button', { name: 'Atualizando...' }).isDisabled(), true);
      await page.evaluate(() => globalThis.overviewPending.reject(new Error('Falha de teste no resumo')));
      await page.getByText('Falha de teste no resumo', { exact: true }).waitFor();
      await page.evaluate(() => globalThis.restoreOverview());
      await page.getByRole('button', { name: /Tentar novamente/ }).click();
      await page.getByRole('heading', { name: 'Seu dia em números' }).waitFor();
      assert.deepEqual(await db(), before);
      await page.evaluate(async () => {
        const { nexoApi } = await import('/src/api/nexoApi.js');
        const original = nexoApi.management.overview;
        globalThis.restoreOverview = () => { nexoApi.management.overview = original; };
        nexoApi.management.overview = async () => null;
      });
      await page.getByRole('button', { name: 'Atualizar resumo' }).click();
      await page.getByText('O resumo da loja veio incompleto. Tente atualizar novamente.', { exact: true }).waitFor();
      await page.evaluate(() => globalThis.restoreOverview());
      await page.getByRole('button', { name: /Tentar novamente/ }).click();
      await page.getByRole('heading', { name: 'Seu dia em números' }).waitFor();
      await page.goto(`${base}/financeiro`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Resumo financeiro' }).waitFor();
      const finance = page.locator('.page-shell').filter({ has: page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }) });
      const financialData = await page.evaluate(async () => {
        const { nexoApi } = await import('/src/api/nexoApi.js');
        const data = await nexoApi.finance.dashboard({ from: '2026-11-01', to: '2026-11-03' });
        return data;
      });
      // The displayed period is selected by the app; verify positions independent of its dates.
      for (const value of [financialData.summary.financial_balance, financialData.summary.payable, financialData.summary.receivable, financialData.summary.cash_available]) assert.ok((await finance.innerText()).includes(format(value)));
      assert.equal(await finance.getByRole('heading', { name: 'Próximos compromissos' }).isVisible(), true);
      await overflow();
      await page.screenshot({ path: `${output}/finance-${width}.png` });
      await finance.getByRole('button', { name: 'Nova entrada' }).click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Resumo financeiro' }).waitFor();
      await page.evaluate(async () => {
        const { nexoApi } = await import('/src/api/nexoApi.js');
        const dashboard = nexoApi.finance.dashboard;
        nexoApi.finance.dashboard = async (...args) => ({ ...await dashboard(...args), series: [], alerts: Array.from({ length: 4 }, (_, index) => ({ type: `test-${index}`, title: `Aviso de teste ${index + 1}`, description: 'Conferir conta.', severity: 'critical' })) });
      });
      await finance.getByRole('button', { name: 'Atualizar', exact: true }).click();
      await finance.getByText('Sem movimentação no período', { exact: true }).waitFor();
      await finance.getByText('Aviso de teste 4', { exact: true }).waitFor();
      await overflow();
      assert.deepEqual(await db(), before);
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.screenshot({ path: `${output}/finance-dark-${width}.png` });
      assert.deepEqual(errors, []);
      console.log(`Overview screens: ${width}px passed; values, retry, checklist, alerts and existing data preserved.`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
