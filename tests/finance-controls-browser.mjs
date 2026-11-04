import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const originalPage = execFileSync('git', ['show', '186b4fb:src/pages/Financeiro.jsx'], { encoding: 'utf8' });
const snapshots = {};
const browser = await chromium.launch({ headless: true });
await mkdir('artifacts/refactor/controls/browser', { recursive: true });
try {
  for (const version of ['baseline', 'refactored']) {
    const outDir = 'artifacts/refactor/controls/build-' + version;
    const testPlugins = [{ name: 'test-api-access', transform(code, id) { if (id.replaceAll('\\', '/').endsWith('/src/api/nexoApi.js')) return code + '\nwindow.__testNexoApi = nexoApi;'; } }];
    if (version === 'baseline') testPlugins.push({ name: 'baseline-panels', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/pages/Financeiro.jsx')) return originalPage; } });
    await build({ mode: 'development', logLevel: 'error', define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, plugins: testPlugins, build: { outDir } });
    const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5181, open: false } });
    try {
      const base = server.resolvedUrls.local[0];
      console.log('Server ready', base);
      console.log('HTTP warmup', (await fetch(base + 'login', { signal: AbortSignal.timeout(10000) })).status);
      for (const width of [1366, 390]) {
        console.log(`Finance controls: ${version}, ${width}px`);
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
          page.on('request', request => { if (/(ReconciliationPanel|GoalsPanel)/.test(request.url())) requests.push(request.url()); });
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
          await page.evaluate(async () => {
            const nexoApi = window.__testNexoApi;
            nexoApi.finance.reconciliation = async () => ({ totals: { sales: 1234.56, differences: -20, sessions_with_difference: 1 }, sessions: [
              { id: 'fixture', operator: 'Operador Teste', opened_at: '2026-11-03T12:00:00Z', sales_count: 3, expected_cash: 100, declared_cash: 80, difference: -20, has_difference: true },
              { id: 'open', operator: 'Operador Aberto', opened_at: '2026-11-03T13:00:00Z', sales_count: 0, expected_cash: 0, declared_cash: null, difference: null, has_difference: false },
            ] });
            globalThis.goalCalls = [];
            nexoApi.finance.goals.create = payload => {
              globalThis.goalCalls.push(structuredClone(payload));
              return new Promise((resolve, reject) => { globalThis.goalPending = { resolve, reject }; });
            };
          });
          async function openSection(key) {
            if (width < 1024) await finance.locator('select').first().selectOption(key);
            else {
              const menu = finance.locator('details').filter({ has: page.locator('button[aria-label="Abrir Metas"]') });
              await menu.locator('summary').click();
              await menu.locator('button').filter({ hasText: key === 'goals' ? /^Metas$/ : /^Concil/ }).click();
            }
          }
          console.log('Open reconciliation');
          await openSection('reconciliation');
          await finance.getByText('Operador Teste', { exact: true }).waitFor();
          output.reconciliation = await capture();
          assert.ok(output.reconciliation.includes('1.234,56'));
          if (version === 'refactored') {
            assert.ok(requests.some(url => url.includes('ReconciliationPanel-')));
            assert.equal(requests.some(url => url.includes('GoalsPanel-')), false);
          }
          console.log('Open goals');
          await openSection('goals');
          await finance.getByRole('heading', { name: 'Nova meta mensal' }).waitFor();
          const form = finance.locator('form');
          const button = form.locator('button[type=submit]');
          output.initial = await capture();
          await button.click();
          assert.equal(await page.evaluate(() => globalThis.goalCalls.length), 0);
          await form.locator('input[type=number]').fill('123.45');
          await button.click();
          await page.waitForFunction(() => Boolean(globalThis.goalPending));
          assert.equal(await button.isDisabled(), true);
          await page.evaluate(() => { globalThis.goalPending.reject(new Error('Falha simulada')); globalThis.goalPending = null; });
          await page.getByText('Falha simulada', { exact: true }).first().waitFor();
          assert.equal(await form.locator('input[type=number]').inputValue(), '123.45');
          output.failure = await capture();
          await button.click();
          await page.waitForFunction(() => Boolean(globalThis.goalPending));
          await page.evaluate(() => { globalThis.goalPending.resolve({}); globalThis.goalPending = null; });
          await page.waitForFunction(() => document.querySelector('form input[type=number]')?.value === '');
          output.success = await capture();
          output.calls = await page.evaluate(() => globalThis.goalCalls);
          assert.equal(output.calls.length, 2);
          assert.equal(output.calls[0].target_value, 123.45);
          assert.deepEqual(await readDb(), before);
          assert.deepEqual(errors, []);
          if (version === 'refactored') assert.ok(requests.some(url => url.includes('GoalsPanel-')));
          snapshots[version] ??= {};
          snapshots[version][width] = output;
        } finally { await context.close(); }
      }
    } catch (error) { console.error(error); throw error; } finally { await new Promise(resolve => server.httpServer.close(resolve)); }
  }
  assert.deepEqual(snapshots.refactored, snapshots.baseline);
  await writeFile('artifacts/refactor/controls/browser/comparison.json', JSON.stringify(snapshots, null, 2));
  console.log('Finance controls: baseline and refactored match in desktop and mobile; existing demo data preserved.');
} finally { await browser.close(); }

