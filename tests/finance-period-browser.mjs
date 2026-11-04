import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Requires the local mock server. Storage and controlled API promises are isolated.
const base = process.env.NEXO_TEST_URL || 'http://127.0.0.1:5177';
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1366, 390]) {
    console.log(`Finance period races: ${width}px`);
    const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'America/Bahia' });
    try {
      await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      await context.addInitScript(() => {
        const OriginalDate = Date;
        window.Date = class extends OriginalDate {
          constructor(...args) { super(...(args.length ? args : [1793718000000])); }
          static now() { return 1793718000000; }
        };
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = 'details:has(> summary .lucide-flask-conical){display:none!important}';
          document.head.append(style);
        });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
      await page.locator('input[type=email]').fill('demo@nexopdv.local');
      await page.locator('input[type=password]').fill('demo123');
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/inicio', { waitUntil: 'domcontentloaded' });
      await page.goto(`${base}/financeiro`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Resumo financeiro', exact: true }).waitFor();
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
      await page.evaluate(async () => {
        const { nexoApi } = await import('/src/api/nexoApi.js');
        globalThis.periodRequests = [];
        globalThis.periodHeld = ['dashboard'];
        globalThis.periodOriginals = {};
        for (const kind of ['dashboard', 'ledger', 'receivables', 'reconciliation']) {
          const original = nexoApi.finance[kind];
          globalThis.periodOriginals[kind] = original;
          nexoApi.finance[kind] = range => {
            if (!globalThis.periodHeld.includes(kind)) return original(range);
            return new Promise((resolve, reject) => globalThis.periodRequests.push({ kind, range: structuredClone(range), resolve, reject }));
          };
        }
      });
      const finance = page.locator('.page-shell').filter({ has: page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }) });
      const preset = page.getByLabel('Período rápido', { exact: true });
      const count = kind => page.evaluate(kind => globalThis.periodRequests.filter(request => request.kind === kind).length, kind);
      async function waitCount(kind, expected) {
        await page.waitForFunction(({ kind, expected }) => globalThis.periodRequests.filter(request => request.kind === kind).length === expected, { kind, expected });
      }
      async function settle(kind, index, label, error = false) {
        await page.evaluate(async ({ kind, index, label, error }) => {
          const request = globalThis.periodRequests.filter(item => item.kind === kind)[index];
          if (error) { request.reject(new Error(label)); return; }
          if (kind === 'dashboard') {
            const data = await globalThis.periodOriginals.dashboard(request.range);
            request.resolve({ ...data, summary: { ...data.summary, net_revenue: Number(label) } });
          } else if (kind === 'ledger') request.resolve({ items: [{ id: label, type: 'revenue', description: label, date: '2026-11-03', origin: 'teste', actor: 'Maria', amount: 12.34 }] });
          else if (kind === 'receivables') request.resolve({ total: 12.34, items: [{ id: label, kind: 'external', description: label, category: 'teste', remaining_amount: 12.34, due_date: null, status: 'pending' }] });
          else request.resolve({ totals: { sales: 12.34, differences: 0, sessions_with_difference: 0 }, sessions: [{ id: label, operator: label, opened_at: '2026-11-03', sales_count: 1, expected_cash: 12.34, declared_cash: 12.34, difference: 0 }] });
        }, { kind, index, label, error });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      async function openSection(key, label) {
        if (width < 1024) await page.getByLabel('Área financeira', { exact: true }).selectOption(key);
        else if (['overview', 'movements'].includes(key)) await finance.getByRole('button', { name: label, exact: true }).click();
        else {
          const button = page.locator(`button[aria-label="Abrir ${label}"]`);
          await finance.locator('details').filter({ has: button }).locator('summary').click();
          await button.click();
        }
      }
      await preset.selectOption('today'); await waitCount('dashboard', 1);
      await preset.selectOption('yesterday'); await waitCount('dashboard', 2);
      await settle('dashboard', 1, '222.22');
      await finance.getByText('R$ 222,22', { exact: true }).waitFor();
      await settle('dashboard', 0, '111.11');
      assert.equal(await finance.getByText('R$ 111,11', { exact: true }).count(), 0);
      await preset.selectOption('today'); await waitCount('dashboard', 3);
      await preset.selectOption('7days'); await waitCount('dashboard', 4);
      await settle('dashboard', 3, '333.33');
      await settle('dashboard', 2, 'Erro antigo no resumo', true);
      assert.equal(await page.getByText('Erro antigo no resumo', { exact: true }).count(), 0);
      await preset.selectOption('7days');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await count('dashboard'), 4);
      await finance.getByRole('button', { name: 'Atualizar', exact: true }).click();
      await waitCount('dashboard', 5);
      await settle('dashboard', 4, 'Erro atual no resumo', true);
      await finance.getByText('Erro atual no resumo', { exact: true }).waitFor();
      await finance.getByRole('button', { name: 'Atualizar', exact: true }).click();
      await waitCount('dashboard', 6);
      await settle('dashboard', 5, '444.44');
      await finance.getByText('R$ 444,44', { exact: true }).waitFor();
      assert.equal(await finance.getByText('Erro atual no resumo', { exact: true }).count(), 0);
      await page.evaluate(() => { globalThis.periodHeld = []; });
      for (const [kind, key, label] of [['ledger', 'movements', 'Movimentações'], ['receivables', 'receivables', 'Contas a receber'], ['reconciliation', 'reconciliation', 'Conciliação']]) {
        await page.evaluate(kind => { globalThis.periodHeld = [kind]; }, kind);
        await openSection(key, label); await waitCount(kind, 1);
        await preset.selectOption('today'); await waitCount(kind, 2);
        await settle(kind, 1, `Atual ${kind}`);
        await finance.getByText(`Atual ${kind}`, { exact: true }).waitFor();
        await settle(kind, 0, `Antigo ${kind}`);
        assert.equal(await finance.getByText(`Antigo ${kind}`, { exact: true }).count(), 0);
        await preset.selectOption('today');
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await count(kind), 2);
        await preset.selectOption('month'); await waitCount(kind, 3);
        await openSection('overview', 'Visão geral');
        await settle(kind, 2, `Erro após sair ${kind}`, true);
        assert.equal(await page.getByText(`Erro após sair ${kind}`, { exact: true }).count(), 0);
        await openSection(key, label); await waitCount(kind, 4);
        await settle(kind, 3, `Erro ativo ${kind}`, true);
        await page.getByText(`Erro ativo ${kind}`, { exact: true }).first().waitFor();
        await openSection('overview', 'Visão geral');
        await openSection(key, label); await waitCount(kind, 5);
        await settle(kind, 4, `Recuperado ${kind}`);
        await finance.getByText(`Recuperado ${kind}`, { exact: true }).waitFor();
        await openSection('overview', 'Visão geral');
      }
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4'))), before);
      assert.deepEqual(errors, []);
      results.push({ width, requests: await page.evaluate(() => globalThis.periodRequests.map(({ kind, range }) => ({ kind, range }))) });
    } finally { await context.close(); }
  }
  await mkdir('artifacts/refactor/finance-period', { recursive: true });
  await writeFile('artifacts/refactor/finance-period/races.json', JSON.stringify(results, null, 2));
  console.log('Latest period wins; same-date changes do not reload; stale errors are ignored; retry and existing data preserved.');
} finally { await browser.close(); }
