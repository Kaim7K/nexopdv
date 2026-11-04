import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const originalPage = execFileSync('git', ['show', 'd9d0550:src/pages/Financeiro.jsx'], { encoding: 'utf8' });
const snapshots = {};
const browser = await chromium.launch({ headless: true });
await mkdir('artifacts/refactor/references/browser', { recursive: true });
try {
  for (const version of ['baseline', 'refactored']) {
    const server = await createServer({ mode: 'development', cacheDir: `artifacts/refactor/references/vite-${version}`,
      optimizeDeps: { entries: ['index.html'] }, define: { 'import.meta.env.VITE_MOCK_API': '"true"' },
      plugins: version === 'baseline' ? [{ name: 'checkpoint-reference-panels', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/pages/Financeiro.jsx')) return originalPage; } }] : [],
      server: { host: '127.0.0.1', port: 0, open: false },
    });
    try {
      await server.listen();
      const base = server.resolvedUrls.local[0];
      for (const width of [1366, 390]) {
        console.log(`Reference forms: ${version}, ${width}px`);
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
          const errors = [], requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => { if (request.url().includes('/src/features/finance/references/')) requests.push(request.url()); });
          await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
          await page.locator('input[type=email]').fill('demo@nexopdv.local');
          await page.locator('input[type=password]').fill('demo123');
          await page.locator('button[type=submit]').click();
          await page.waitForURL('**/inicio');
          await page.waitForFunction(() => Boolean(localStorage.getItem('nexo:mock-db:v4')));
          await page.goto(`${base}financeiro`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }).waitFor();
          await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important} details:has(> summary .lucide-flask-conical){display:none!important}' });
          const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
          const finance = page.locator('.page-shell').filter({ has: page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }) });
          const output = {};
          const capture = async () => (await finance.innerText()).replace(/\s+/g, ' ').trim();
          const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
          if (version === 'refactored') assert.equal(requests.length, 0);
          await page.evaluate(async () => {
            const { nexoApi } = await import('/src/api/nexoApi.js');
            globalThis.referenceCalls = [];
            for (const kind of ['suppliers', 'accounts']) {
              const create = nexoApi.finance[kind].create;
              nexoApi.finance[kind].create = payload => {
                globalThis.referenceCalls.push({ kind, payload: structuredClone(payload) });
                return new Promise((resolve, reject) => {
                  globalThis.referencePending = { kind, resolve, reject, execute: () => create(payload) };
                });
              };
            }
          });
          async function openSection(key, label, heading) {
            if (width < 1024) await page.getByLabel('Área financeira', { exact: true }).selectOption(key);
            else {
              const menu = finance.locator('details').filter({ has: page.locator('button[aria-label="Abrir Fornecedores"]') });
              await menu.locator('summary').click();
              await page.getByRole('button', { name: `Abrir ${label}`, exact: true }).click();
            }
            await page.getByRole('heading', { name: heading, exact: true }).waitFor();
          }
          async function submitPending(button, kind) {
            await button.click();
            await page.waitForFunction(kind => globalThis.referencePending?.kind === kind, kind);
            assert.equal(await button.isDisabled(), true);
          }
          async function finishPending(error = '') {
            await page.evaluate(async message => {
              const pending = globalThis.referencePending;
              globalThis.referencePending = null;
              if (message) pending.reject(new Error(message));
              else pending.resolve(await pending.execute());
            }, error);
          }
          await openSection('suppliers', 'Fornecedores', 'Novo fornecedor');
          const supplier = finance.locator('form').filter({ has: page.getByRole('heading', { name: 'Novo fornecedor', exact: true }) });
          const supplierButton = supplier.getByRole('button', { name: 'Cadastrar', exact: true });
          output.suppliersInitial = await capture();
          await supplierButton.click();
          assert.equal(await page.evaluate(() => globalThis.referenceCalls.length), 0);
          assert.deepEqual(await readDb(), before);
          const supplierPayload = { name: 'Fornecedor Refatoração', document: '00.000.000/0001-00', email: 'financeiro@exemplo.local', phone: '(71) 90000-0000' };
          for (const [label, value] of [['Nome', supplierPayload.name], ['CPF ou CNPJ', supplierPayload.document], ['E-mail', supplierPayload.email], ['Telefone', supplierPayload.phone]]) await supplier.getByLabel(label, { exact: true }).fill(value);
          await submitPending(supplierButton, 'suppliers');
          await finishPending('Falha simulada no fornecedor');
          await page.getByText('Falha simulada no fornecedor', { exact: true }).first().waitFor();
          for (const [label, value] of [['Nome', supplierPayload.name], ['CPF ou CNPJ', supplierPayload.document], ['E-mail', supplierPayload.email], ['Telefone', supplierPayload.phone]]) assert.equal(await supplier.getByLabel(label, { exact: true }).inputValue(), value);
          assert.deepEqual(await readDb(), before);
          output.supplierFailure = await capture();
          await submitPending(supplierButton, 'suppliers');
          await finishPending();
          await finance.getByText(supplierPayload.name, { exact: true }).waitFor();
          for (const label of ['Nome', 'CPF ou CNPJ', 'E-mail', 'Telefone']) assert.equal(await supplier.getByLabel(label, { exact: true }).inputValue(), '');
          output.supplierSuccess = await capture();
          const afterSupplier = await readDb();
          assert.equal(afterSupplier.finance.suppliers.length, before.finance.suppliers.length + 1);
          if (version === 'refactored') {
            assert.ok(requests.some(url => url.includes('SuppliersPanel.jsx')));
            assert.equal(requests.some(url => url.includes('AccountsPanel.jsx')), false);
          }
          await openSection('accounts', 'Contas financeiras', 'Nova conta financeira');
          const account = finance.locator('form').filter({ has: page.getByRole('heading', { name: 'Nova conta financeira', exact: true }) });
          const accountButton = account.getByRole('button', { name: 'Criar conta', exact: true });
          output.accountsInitial = await capture();
          await account.getByLabel('Nome', { exact: true }).fill('Reserva Refatoração');
          await account.getByRole('combobox').selectOption('digital');
          await account.getByLabel('Saldo inicial', { exact: true }).fill('-1');
          await accountButton.click();
          assert.equal(await page.evaluate(() => globalThis.referenceCalls.length), 2);
          assert.deepEqual(await readDb(), afterSupplier);
          await account.getByLabel('Saldo inicial', { exact: true }).fill('125.50');
          const defaultAccount = account.getByLabel('Usar como conta padrão', { exact: true });
          assert.equal(await defaultAccount.isVisible(), true);
          await defaultAccount.check(); await defaultAccount.uncheck();
          await submitPending(accountButton, 'accounts');
          await finishPending('Falha simulada na conta');
          await page.getByText('Falha simulada na conta', { exact: true }).first().waitFor();
          assert.equal(await account.getByLabel('Nome', { exact: true }).inputValue(), 'Reserva Refatoração');
          assert.equal(await account.getByRole('combobox').inputValue(), 'digital');
          assert.equal(await account.getByLabel('Saldo inicial', { exact: true }).inputValue(), '125.50');
          assert.deepEqual(await readDb(), afterSupplier);
          output.accountFailure = await capture();
          await submitPending(accountButton, 'accounts');
          await finishPending();
          await finance.getByText('Reserva Refatoração', { exact: true }).waitFor();
          assert.equal(await account.getByLabel('Nome', { exact: true }).inputValue(), '');
          assert.equal(await account.getByRole('combobox').inputValue(), 'bank');
          assert.equal(await account.getByLabel('Saldo inicial', { exact: true }).inputValue(), '0');
          assert.equal(await defaultAccount.isChecked(), false);
          output.accountSuccess = await capture();
          const after = await readDb();
          assert.equal(after.finance.accounts.length, before.finance.accounts.length + 1);
          for (const kind of ['suppliers', 'accounts']) for (const existing of before.finance[kind]) assert.deepEqual(after.finance[kind].find(item => item.id === existing.id), existing);
          assert.deepEqual(after, { ...before, finance: { ...before.finance, suppliers: after.finance.suppliers, accounts: after.finance.accounts } });
          output.calls = await page.evaluate(() => globalThis.referenceCalls);
          assert.deepEqual(output.calls, [
            { kind: 'suppliers', payload: supplierPayload }, { kind: 'suppliers', payload: supplierPayload },
            { kind: 'accounts', payload: { name: 'Reserva Refatoração', type: 'digital', opening_balance: 125.5, is_default: false } },
            { kind: 'accounts', payload: { name: 'Reserva Refatoração', type: 'digital', opening_balance: 125.5, is_default: false } },
          ]);
          await page.evaluate(async () => {
            const { nexoApi } = await import('/src/api/nexoApi.js');
            const bootstrap = nexoApi.finance.bootstrap;
            nexoApi.finance.bootstrap = async () => {
              const data = await bootstrap();
              return { ...data, enabled_features: data.enabled_features.filter(key => !['financial_email_alerts', 'email_sending'].includes(key)) };
            };
          });
          await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
          await defaultAccount.waitFor({ state: 'detached' });
          output.featuresDisabled = await capture();
          assert.deepEqual(await readDb(), after);
          assert.deepEqual(errors, []);
          if (version === 'refactored') {
            assert.ok(requests.some(url => url.includes('AccountsPanel.jsx')));
            assert.deepEqual(output, snapshots[`baseline:${width}`]);
            await page.screenshot({ path: `artifacts/refactor/references/browser/references-${width}.png` });
          }
          snapshots[`${version}:${width}`] = output;
        } finally { await context.close(); }
      }
    } finally { await server.close(); }
  }
  await writeFile('artifacts/refactor/references/browser/comparison.json', JSON.stringify(snapshots, null, 2));
  console.log('Supplier/account forms match checkpoint at desktop/mobile widths: validation, payloads, pending/error/retry/reset, feature gates and preservation of existing demonstration records.');
} finally { await browser.close(); }
