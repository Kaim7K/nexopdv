import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const originalPage = execFileSync('git', ['show', '60d28f4:src/pages/Financeiro.jsx'], { encoding: 'utf8' });
const snapshots = {};
const browser = await chromium.launch({ headless: true });
await mkdir('artifacts/refactor/settings/browser', { recursive: true });
try {
  for (const version of ['baseline', 'refactored']) {
    const outDir = 'artifacts/refactor/settings/build-' + version;
    const testPlugins = [{ name: 'test-api-access', transform(code, id) { if (id.replaceAll('\\', '/').endsWith('/src/api/nexoApi.js')) return code + '\nwindow.__testNexoApi = nexoApi;'; } }];
    if (version === 'baseline') testPlugins.push({ name: 'baseline-panels', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/pages/Financeiro.jsx')) return originalPage; } });
    await build({ mode: 'development', logLevel: 'error', define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, plugins: testPlugins, build: { outDir } });
    const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5181, open: false } });
    try {
      const base = server.resolvedUrls.local[0];
      console.log('Server ready', base);
      console.log('HTTP warmup', (await fetch(base + 'login', { signal: AbortSignal.timeout(10000) })).status);
      for (const width of [1366, 390]) {
        console.log(`Finance settings: ${version}, ${width}px`);
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
          page.on('request', request => { if (/FinanceSettingsPanel/.test(request.url())) requests.push(request.url()); });
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
            const bootstrap = nexoApi.finance.bootstrap;
            nexoApi.finance.bootstrap = async () => {
              const result = await bootstrap();
              return { ...result, categories: result.categories.map(item => ({ ...item, active: true })), users: [{ id: 'fixture-manager', name: 'Gerente Teste', role: 'gerente', permissions: { view: true } }] };
            };
            globalThis.settingsCalls = [];
            for (const [kind, group, method] of [['settings', 'settings', 'update'], ['category', 'categories', 'create'], ['recurring', 'recurring', 'create'], ['permission', 'permissions', 'update']]) {
              nexoApi.finance[group][method] = (...args) => {
                globalThis.settingsCalls.push({ kind, args: structuredClone(args) });
                return new Promise((resolve, reject) => { globalThis.settingsPending = { resolve, reject, kind }; });
              };
            }
          });
          // Reload the bootstrap through the existing refresh action, preserving the module stubs.
          await finance.getByRole('button', { name: 'Atualizar', exact: true }).click();
          if (width < 1024) await page.getByLabel('Área financeira', { exact: true }).selectOption('settings');
          else {
            const menu = finance.locator('details').filter({ has: page.locator('button[aria-label="Abrir Configurações"]') });
            await menu.locator('summary').click();
            await page.getByRole('button', { name: 'Abrir Configurações', exact: true }).click();
          }
          await finance.getByRole('heading', { name: 'Regras de cálculo e alertas', exact: true }).waitFor();
          output.initial = await capture();
          if (version === 'refactored') assert.ok(requests.some(url => url.includes('FinanceSettingsPanel-')));
          async function finish(error = '') {
            await page.waitForFunction(() => Boolean(globalThis.settingsPending));
            await page.evaluate(message => {
              const task = globalThis.settingsPending;
              globalThis.settingsPending = null;
              if (message) task.reject(new Error(message)); else task.resolve({});
            }, error);
          }
          const rules = finance.locator('form').filter({ has: page.getByRole('heading', { name: 'Regras de cálculo e alertas', exact: true }) });
          await rules.getByLabel('Imposto estimado (%)', { exact: true }).fill('101');
          await rules.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
          assert.equal(await page.evaluate(() => globalThis.settingsCalls.length), 0);
          await rules.getByLabel('Imposto estimado (%)', { exact: true }).fill('3.75');
          const save = rules.getByRole('button', { name: 'Salvar configurações', exact: true });
          await save.click();
          await page.waitForFunction(() => Boolean(globalThis.settingsPending));
          assert.equal(await save.isDisabled(), true);
          await finish('Falha nas configurações');
          await page.getByText('Falha nas configurações', { exact: true }).first().waitFor();
          assert.equal(await rules.getByLabel('Imposto estimado (%)', { exact: true }).inputValue(), '3.75');
          await save.click(); await finish();
          await page.getByText('Configurações financeiras salvas.', { exact: true }).first().waitFor();
          const category = finance.locator('form').filter({ has: page.getByPlaceholder('Nome da categoria', { exact: true }) });
          await category.getByPlaceholder('Nome da categoria', { exact: true }).fill('Categoria Teste');
          await category.locator('select').selectOption('both');
          await category.getByRole('button', { name: 'Adicionar', exact: true }).click();
          await finish();
          await page.waitForFunction(() => document.querySelector('input[placeholder="Nome da categoria"]')?.value === '');
          output.afterCategory = await capture();
          const recurring = finance.locator('section').filter({ has: page.getByRole('heading', { name: 'Despesas recorrentes', exact: true }) });
          const recurringForm = recurring.locator('form');
          await recurringForm.getByLabel('Descrição', { exact: true }).fill('Aluguel Teste');
          await recurringForm.getByLabel('Valor', { exact: true }).fill('123.45');
          await recurringForm.getByRole('combobox').first().selectOption('cat_energy');
          const create = recurringForm.getByRole('button', { name: 'Criar recorrência', exact: true });
          await create.click();
          await page.waitForFunction(() => Boolean(globalThis.settingsPending));
          assert.equal(await create.isDisabled(), true);
          await finish('Falha na recorrência');
          await page.getByText('Falha na recorrência', { exact: true }).first().waitFor();
          assert.equal(await recurringForm.getByLabel('Valor', { exact: true }).inputValue(), '123.45');
          await create.click(); await finish();
          await page.waitForFunction(() => [...document.querySelectorAll('form input')].some(input => input.value === 'Aluguel Teste') === false);
          output.afterRecurring = await capture();
          await finance.getByText('Gerente Teste', { exact: false }).click();
          const permission = finance.getByRole('checkbox', { name: 'Visualizar financeiro', exact: true });
          assert.equal(await permission.isChecked(), true);
          await permission.uncheck(); await finish('Falha na permissão');
          await page.getByText('Falha na permissão', { exact: true }).first().waitFor();
          assert.equal(await permission.isChecked(), true);
          await permission.uncheck(); await finish();
          await page.getByText('Permissão atualizada.', { exact: true }).first().waitFor();
          assert.equal(await permission.isChecked(), false);
          output.calls = await page.evaluate(() => globalThis.settingsCalls);
          assert.equal(output.calls.find(call => call.kind === 'settings').args[0].tax_rate, '3.75');
          assert.equal(output.calls.find(call => call.kind === 'recurring').args[0].amount, 123.45);
          assert.deepEqual(output.calls.find(call => call.kind === 'category').args[0], { name: 'Categoria Teste', type: 'both' });
          assert.deepEqual(await readDb(), before);
          assert.deepEqual(errors, []);
          snapshots[version] ??= {};
          snapshots[version][width] = output;
        } finally { await context.close(); }
      }
    } catch (error) { console.error(error); throw error; } finally { await new Promise(resolve => server.httpServer.close(resolve)); }
  }
  assert.deepEqual(snapshots.refactored, snapshots.baseline);
  await writeFile('artifacts/refactor/settings/browser/comparison.json', JSON.stringify(snapshots, null, 2));
  console.log('Finance settings match baseline on desktop and mobile; payloads, retries and existing data preserved.');
} finally { await browser.close(); }
