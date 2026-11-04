import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const originalPage = execFileSync('git', ['show', 'c96601b:src/pages/Financeiro.jsx'], { encoding: 'utf8' });
const snapshots = {};
const browser = await chromium.launch({ headless: true });
await mkdir('artifacts/refactor/movements/browser', { recursive: true });
try {
  for (const version of ['baseline', 'refactored']) {
    const outDir = 'artifacts/refactor/movements/build-' + version;
    const testPlugins = [{ name: 'test-api-access', transform(code, id) { if (id.replaceAll('\\', '/').endsWith('/src/api/nexoApi.js')) return code + '\nwindow.__testNexoApi = nexoApi;'; } }];
    if (version === 'baseline') testPlugins.push({ name: 'baseline-panels', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/pages/Financeiro.jsx')) return originalPage; } });
    await build({ mode: 'development', logLevel: 'error', define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, plugins: testPlugins, build: { outDir } });
    const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5181, open: false } });
    try {
      const base = server.resolvedUrls.local[0];
      console.log('Server ready', base);
      console.log('HTTP warmup', (await fetch(base + 'login', { signal: AbortSignal.timeout(10000) })).status);
      for (const width of [1366, 390]) {
        console.log(`Finance movements: ${version}, ${width}px`);
        const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Bahia' });
        try {
          await context.addInitScript(() => {
            const OriginalDate = Date;
            class FrozenDate extends OriginalDate {
              constructor(...args) { super(...(args.length ? args : [1793718000000])); }
              static now() { return 1793718000000; }
            }
            window.Date = FrozenDate;
          });
          await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
          const page = await context.newPage();
          page.setDefaultNavigationTimeout(90000);
          page.setDefaultTimeout(20000);
          const errors = [], requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => { if (/(LedgerPanel|ReceivablesPanel)/.test(request.url())) requests.push(request.url()); });
          await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
          console.log('Login loaded');
          await page.locator('input[type=email]').fill('demo@nexopdv.local');
          await page.locator('input[type=password]').fill('demo123');
          await page.locator('button[type=submit]').click();
          console.log('Login submitted');
          await page.waitForURL('**/inicio', { waitUntil: 'domcontentloaded' });
          console.log('Logged in');
          await page.waitForFunction(() => Boolean(localStorage.getItem('nexo:mock-db:v4')));
          await page.goto(`${base}financeiro`, { waitUntil: 'domcontentloaded' });
          console.log('Finance page loaded');
          await page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }).waitFor();
          await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important} details:has(> summary .lucide-flask-conical){display:none!important}' });
          const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
          const finance = page.locator('.page-shell').filter({ has: page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }) });
          const output = {};
          const capture = async () => (await finance.innerText()).replace(/\s+/g, ' ').trim();
          const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
          if (version === 'refactored') assert.equal(requests.length, 0);
          await page.evaluate(() => {
            const api = window.__testNexoApi;
            globalThis.movementMode = 'populated';
            globalThis.movementCalls = [];
            for (const kind of ['ledger', 'receivables']) {
              api.finance[kind] = async range => {
                globalThis.movementCalls.push({ kind, range: structuredClone(range) });
                if (globalThis.movementMode === 'error') throw new Error('Falha de teste nas movimentações');
                if (globalThis.movementMode === 'empty') return { items: [], total: 0 };
                if (kind === 'ledger') return { items: [
                  { id: 'in', type: 'revenue', description: 'Entrada Teste', date: '2026-11-03T12:00:00Z', origin: 'PDV', actor: 'Maria', realized_amount: 45.67, amount: 100 },
                  { id: 'out', type: 'expense', description: 'Saída Teste', date: '2026-11-02T12:00:00Z', origin: 'manual', actor: 'Maria', realized_amount: 0, amount: 12.34 },
                ] };
                return { total: 123.45, items: [
                  { id: 'same', kind: 'fiado', client: 'Cliente Teste', description: 'Fiado Teste', due_date: null, remaining_amount: 100, status: 'pending' },
                  { id: 'same', kind: 'external', description: 'Receita Teste', category: 'Serviços', due_date: '2026-11-04', remaining_amount: 23.45, status: 'partial' },
                ] };
              };
            }
          });
          async function openSection(key, label) {
            if (width < 1024) await page.getByLabel('Área financeira', { exact: true }).selectOption(key);
            else if (key === 'movements') await finance.getByRole('button', { name: label, exact: true }).click();
            else {
              const button = page.locator(`button[aria-label="Abrir ${label}"]`);
              if (!await button.isVisible()) await finance.locator('details').filter({ has: button }).locator('summary').click();
              await button.click();
            }
          }
          await openSection('movements', 'Movimentações');
          await finance.getByText('Entrada Teste', { exact: true }).waitFor();
          output.ledger = await capture();
          assert.ok(output.ledger.includes('45,67'));
          assert.ok(output.ledger.includes('12,34'));
          if (version === 'refactored') {
            assert.ok(requests.some(url => url.includes('LedgerPanel-')));
            assert.equal(requests.some(url => url.includes('ReceivablesPanel-')), false);
          }
          await page.getByLabel('Período rápido', { exact: true }).selectOption('today');
          await page.waitForFunction(() => globalThis.movementCalls.some(call => call.kind === 'ledger' && call.range.from === call.range.to));
          await finance.getByText('Entrada Teste', { exact: true }).waitFor();
          await openSection('receivables', 'Contas a receber');
          await finance.getByText('Cliente Teste', { exact: true }).waitFor();
          output.receivables = await capture();
          assert.ok(output.receivables.includes('123,45'));
          assert.ok(output.receivables.includes('sem data'));
          assert.equal(await finance.locator('article').filter({ hasText: /Cliente Teste|Receita Teste/ }).count(), 2);
          if (version === 'refactored') assert.ok(requests.some(url => url.includes('ReceivablesPanel-')));
          await page.evaluate(() => { globalThis.movementMode = 'empty'; });
          await openSection('movements', 'Movimentações');
          await finance.getByText('Nenhuma movimentação no período', { exact: true }).waitFor();
          output.emptyLedger = await capture();
          await openSection('receivables', 'Contas a receber');
          await finance.getByText('Nenhum valor pendente', { exact: true }).waitFor();
          output.emptyReceivables = await capture();
          await page.evaluate(() => { globalThis.movementMode = 'error'; });
          await openSection('movements', 'Movimentações');
          await page.getByText('Falha de teste nas movimentações', { exact: true }).first().waitFor();
          await finance.getByText('Nenhuma movimentação no período', { exact: true }).waitFor();
          output.errorLedger = await capture();
          await page.evaluate(() => { globalThis.movementMode = 'populated'; });
          await openSection('receivables', 'Contas a receber');
          await finance.getByText('Cliente Teste', { exact: true }).waitFor();
          await openSection('movements', 'Movimentações');
          await finance.getByText('Entrada Teste', { exact: true }).waitFor();
          output.retry = await capture();
          output.calls = await page.evaluate(() => globalThis.movementCalls);
          assert.deepEqual(await readDb(), before);
          assert.deepEqual(errors, []);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          snapshots[version] ??= {};
          snapshots[version][width] = output;
        } finally { await context.close(); }
      }
    } catch (error) { console.error(error); throw error; } finally { await new Promise(resolve => server.httpServer.close(resolve)); }
  }
  assert.deepEqual(snapshots.refactored, snapshots.baseline);
  await writeFile('artifacts/refactor/movements/browser/comparison.json', JSON.stringify(snapshots, null, 2));
  console.log('Movement and receivable panels match baseline on desktop and mobile; existing data preserved.');
} finally { await browser.close(); }
