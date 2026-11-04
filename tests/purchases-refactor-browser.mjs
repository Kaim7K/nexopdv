import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const originalPage = execFileSync('git', ['show', '01f1b84:src/pages/Financeiro.jsx'], { encoding: 'utf8' });
const snapshots = {};
const browser = await chromium.launch({ headless: true });
await mkdir('artifacts/refactor/purchases/browser', { recursive: true });
try {
  for (const version of ['baseline', 'refactored']) {
    const server = await createServer({ mode: 'development', cacheDir: `artifacts/refactor/purchases/vite-${version}`,
      optimizeDeps: { entries: ['index.html'] }, define: { 'import.meta.env.VITE_MOCK_API': '"true"' },
      plugins: version === 'baseline' ? [{ name: 'checkpoint-purchase-page', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/pages/Financeiro.jsx')) return originalPage; } }] : [],
      server: { host: '127.0.0.1', port: 0, open: false },
    });
    try {
      await server.listen();
      const base = server.resolvedUrls.local[0];
      for (const width of [1366, 390]) {
        console.log(`Purchase comparison: ${version}, ${width}px`);
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
          const errors = [], moduleRequests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => { if (request.url().includes('/src/features/finance/purchases/PurchasesPanel.jsx')) moduleRequests.push(request.url()); });
          await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
          await page.locator('input[type=email]').fill('demo@nexopdv.local');
          await page.locator('input[type=password]').fill('demo123');
          await page.locator('button[type=submit]').click();
          await page.waitForURL('**/inicio');
          await page.waitForFunction(() => Boolean(localStorage.getItem('nexo:mock-db:v4')));
          // Prepare a valid supplier in this disposable context only. The demo
          // seed omits its active flag; the real form lists active suppliers.
          await page.evaluate(() => {
            const db = JSON.parse(localStorage.getItem('nexo:mock-db:v4'));
            db.finance.suppliers[0].active = true;
            localStorage.setItem('nexo:mock-db:v4', JSON.stringify(db));
          });
          const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
          const before = await readDb();
          await page.goto(`${base}financeiro`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }).waitFor();
          await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important} details:has(> summary .lucide-flask-conical){display:none!important}' });
          if (version === 'refactored') assert.equal(moduleRequests.length, 0);
          await page.evaluate(async () => {
            const { nexoApi } = await import('/src/api/nexoApi.js');
            globalThis.purchaseCalls = [];
            globalThis.purchasePending = {};
            const products = nexoApi.finance.products;
            nexoApi.finance.products = () => {
              globalThis.purchaseCalls.push({ action: 'products', args: [] });
              return new Promise((resolve, reject) => { globalThis.purchasePending.products = { resolve, reject, execute: products }; });
            };
            for (const action of ['create', 'confirm', 'cancel']) {
              const original = nexoApi.finance.purchases[action];
              nexoApi.finance.purchases[action] = (...args) => {
                globalThis.purchaseCalls.push({ action, args: structuredClone(args) });
                return new Promise((resolve, reject) => { globalThis.purchasePending[action] = { resolve, reject, execute: () => original(...args) }; });
              };
            }
          });
          const finance = page.locator('.page-shell').filter({ has: page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }) });
          if (width < 1024) await page.getByLabel('Área financeira', { exact: true }).selectOption('purchases');
          else {
            await finance.locator('details').filter({ has: page.locator('button[aria-label="Abrir Compras"]') }).locator('summary').click();
            await page.getByRole('button', { name: 'Abrir Compras', exact: true }).click();
          }
          await page.getByRole('button', { name: 'Registrar compra', exact: true }).waitFor();
          await page.waitForFunction(() => !document.querySelector('.page-shell:last-child')?.textContent.includes('Carregando...'));
          const output = {};
          const capture = async () => (await finance.innerText()).replace(/\s+/g, ' ').trim();
          const countCalls = action => page.evaluate(action => globalThis.purchaseCalls.filter(call => call.action === action).length, action);
          const pending = action => page.waitForFunction(action => Boolean(globalThis.purchasePending[action]), action);
          async function finish(action, error = '') {
            await page.evaluate(async ({ action, error }) => {
              const task = globalThis.purchasePending[action];
              delete globalThis.purchasePending[action];
              if (error) task.reject(new Error(error)); else task.resolve(await task.execute());
            }, { action, error });
          }
          const dialog = page.getByRole('dialog', { name: 'Registrar compra', exact: true });
          const save = dialog.getByRole('button', { name: 'Salvar rascunho', exact: true });
          output.initial = await capture();
          assert.equal(await countCalls('products'), 0);
          if (version === 'refactored') assert.ok(moduleRequests.length > 0);
          await page.getByRole('button', { name: 'Registrar compra', exact: true }).click();
          await pending('products');
          await dialog.getByText('Carregando produtos para a compra...', { exact: true }).waitFor();
          await finish('products', 'Falha simulada nos produtos');
          await dialog.waitFor({ state: 'detached' });
          assert.deepEqual(await readDb(), before);
          await page.getByRole('button', { name: 'Registrar compra', exact: true }).click();
          await pending('products'); await finish('products'); await save.waitFor();
          output.emptyForm = (await dialog.innerText()).replace(/\s+/g, ' ').trim();
          assert.equal(await dialog.getByRole('button', { name: 'Remover produto', exact: true }).isDisabled(), true);
          await save.click(); assert.equal(await countCalls('create'), 0);
          const supplierId = before.finance.suppliers[0].id;
          const product1 = before.products[0].id;
          const product2 = before.products.find(product => product.unit === 'peso').id;
          await dialog.locator('select[required]').first().selectOption(supplierId);
          await dialog.locator('select[required]').nth(1).selectOption(product1);
          await dialog.getByLabel('Quantidade', { exact: true }).fill('0');
          await dialog.getByLabel('Custo unitário', { exact: true }).fill('10.25');
          await save.click(); assert.equal(await countCalls('create'), 0);
          await dialog.getByLabel('Quantidade', { exact: true }).fill('2');
          await dialog.getByRole('button', { name: '+ Adicionar produto', exact: true }).click();
          await dialog.locator('select[required]').nth(2).selectOption(product2);
          await dialog.getByLabel('Quantidade', { exact: true }).nth(1).fill('0.5');
          await dialog.getByLabel('Custo unitário', { exact: true }).nth(1).fill('8.1234');
          await dialog.getByRole('button', { name: '+ Adicionar produto', exact: true }).click();
          await dialog.getByRole('button', { name: 'Remover produto', exact: true }).nth(2).click();
          assert.equal(await dialog.getByLabel('Quantidade', { exact: true }).count(), 2);
          await dialog.getByLabel('Desconto', { exact: true }).fill('1.25');
          await dialog.getByLabel('Frete', { exact: true }).fill('2.50');
          output.total = (await dialog.innerText()).replace(/\s+/g, ' ').trim();
          assert.match(output.total, /R\$\s*25,81/);
          await save.click(); await pending('create');
          assert.equal(await save.isDisabled(), true);
          assert.equal(await dialog.getByRole('button', { name: 'Fechar', exact: true }).isDisabled(), true);
          await finish('create', 'Falha simulada ao salvar compra');
          await page.getByText('Falha simulada ao salvar compra', { exact: true }).first().waitFor();
          assert.equal(await dialog.getByLabel('Quantidade', { exact: true }).first().inputValue(), '2');
          assert.equal(await dialog.getByLabel('Custo unitário', { exact: true }).nth(1).inputValue(), '8.1234');
          assert.deepEqual(await readDb(), before);
          await save.click(); await pending('create'); await finish('create');
          await dialog.waitFor({ state: 'detached' });
          const created = (await readDb()).finance.purchases.find(item => !before.finance.purchases.some(old => old.id === item.id));
          assert.equal(created.status, 'draft');
          assert.deepEqual(created.installments, [{ amount: 25.81, due_date: '2026-11-03', status: 'pending' }]);
          const first = finance.locator('article').filter({ hasText: `Compra #${created.purchase_number}` });
          await first.getByRole('button', { name: 'Confirmar compra', exact: true }).waitFor();
          output.draft = await capture();
          await first.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
          const confirmation = page.getByRole('alertdialog');
          await confirmation.getByRole('button', { name: 'Voltar', exact: true }).click();
          assert.equal(await countCalls('confirm'), 0);
          await first.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
          await confirmation.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
          await pending('confirm'); await finish('confirm');
          await first.getByRole('button', { name: 'Estornar compra', exact: true }).waitFor();
          output.confirmed = await capture();
          await first.getByRole('button', { name: 'Estornar compra', exact: true }).click();
          const reversal = page.getByRole('dialog', { name: 'Estornar compra confirmada?', exact: true });
          const cancelSubmit = reversal.locator('button[type=submit]');
          await reversal.getByLabel('Motivo do cancelamento').fill('abc');
          assert.equal(await cancelSubmit.isDisabled(), true);
          await reversal.getByLabel('Motivo do cancelamento').fill('  Estorno de teste  ');
          await cancelSubmit.click(); await pending('cancel');
          assert.equal(await cancelSubmit.isDisabled(), true);
          await finish('cancel', 'Falha simulada ao estornar compra');
          await page.getByText('Falha simulada ao estornar compra', { exact: true }).first().waitFor();
          assert.equal(await reversal.getByLabel('Motivo do cancelamento').inputValue(), '  Estorno de teste  ');
          assert.equal((await readDb()).finance.purchases.find(item => item.id === created.id).status, 'confirmed');
          await cancelSubmit.click(); await pending('cancel'); await finish('cancel');
          await reversal.waitFor({ state: 'detached' });
          await page.waitForFunction(id => JSON.parse(localStorage.getItem('nexo:mock-db:v4')).finance.purchases.find(item => item.id === id)?.status === 'cancelled', created.id);
          await page.waitForFunction(number => [...document.querySelectorAll('article')].some(row => row.textContent.includes(`Compra #${number}`) && row.textContent.includes('Cancelada')), created.purchase_number);
          output.reversed = await capture();
          await page.getByRole('button', { name: 'Registrar compra', exact: true }).click(); await save.waitFor();
          assert.equal(await countCalls('products'), 2);
          assert.equal(await dialog.getByLabel('Quantidade', { exact: true }).count(), 1);
          assert.equal(await dialog.getByLabel('Custo unitário', { exact: true }).inputValue(), '');
          await dialog.locator('select[required]').first().selectOption(supplierId);
          await dialog.locator('select[required]').nth(1).selectOption(product1);
          await dialog.getByRole('combobox').nth(1).selectOption('pix');
          await dialog.getByLabel('Custo unitário', { exact: true }).fill('5');
          await save.click(); await pending('create'); await finish('create'); await dialog.waitFor({ state: 'detached' });
          const secondCreated = (await readDb()).finance.purchases.find(item => item.id !== created.id && !before.finance.purchases.some(old => old.id === item.id));
          assert.deepEqual(secondCreated.installments, [{ amount: 5, due_date: '2026-11-03', status: 'paid' }]);
          const second = finance.locator('article').filter({ hasText: `Compra #${secondCreated.purchase_number}` });
          await second.getByRole('button', { name: 'Cancelar rascunho', exact: true }).click();
          const draftCancel = page.getByRole('dialog', { name: 'Cancelar rascunho de compra?', exact: true });
          await draftCancel.getByLabel('Motivo do cancelamento').fill('Rascunho de teste');
          await draftCancel.locator('button[type=submit]').click(); await pending('cancel'); await finish('cancel');
          await draftCancel.waitFor({ state: 'detached' });
          await page.waitForFunction(number => [...document.querySelectorAll('article')].some(row => row.textContent.includes(`Compra #${number}`) && row.textContent.includes('Cancelada')), secondCreated.purchase_number);
          output.cancelledDraft = await capture();
          const after = await readDb();
          assert.equal(after.finance.purchases.length, before.finance.purchases.length + 2);
          for (const existing of before.finance.purchases) assert.deepEqual(after.finance.purchases.find(item => item.id === existing.id), existing);
          assert.deepEqual(after, { ...before, finance: { ...before.finance, purchases: after.finance.purchases } });
          const aliases = new Map([[created.id, 'purchase-one'], [secondCreated.id, 'purchase-two']]);
          output.calls = JSON.parse(JSON.stringify(await page.evaluate(() => globalThis.purchaseCalls), (_key, value) => aliases.get(value) || value));
          const createCalls = output.calls.filter(call => call.action === 'create');
          assert.deepEqual(createCalls[0], createCalls[1]);
          assert.deepEqual(createCalls[1].args[0].items, [{ product_id: product1, quantity: 2, unit_cost: 10.25 }, { product_id: product2, quantity: 0.5, unit_cost: 8.1234 }]);
          assert.deepEqual(output.calls.filter(call => call.action === 'confirm'), [{ action: 'confirm', args: ['purchase-one'] }]);
          assert.deepEqual(output.calls.filter(call => call.action === 'cancel'), [{ action: 'cancel', args: ['purchase-one', 'Estorno de teste'] }, { action: 'cancel', args: ['purchase-one', 'Estorno de teste'] }, { action: 'cancel', args: ['purchase-two', 'Rascunho de teste'] }]);
          assert.deepEqual(errors, []);
          if (version === 'refactored') {
            assert.deepEqual(output, snapshots[`baseline:${width}`]);
            await page.screenshot({ path: `artifacts/refactor/purchases/browser/purchases-${width}.png` });
          }
          snapshots[`${version}:${width}`] = output;
        } finally { await context.close(); }
      }
    } finally { await server.close(); }
  }
  await writeFile('artifacts/refactor/purchases/browser/comparison.json', JSON.stringify(snapshots, null, 2));
  console.log('Purchase draft, confirmation/reversal, cancellation reasons, failure/retry, catalog caching, totals and payloads match checkpoint on desktop/mobile. Existing demo records preserved; server SQL unchanged.');
} finally { await browser.close(); }
