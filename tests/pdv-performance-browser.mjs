import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const originalPage = execFileSync('git', ['show', '53ecd71:src/pages/PDV.jsx'], { encoding: 'utf8' });
const output = 'artifacts/refactor/pdv-performance';
await mkdir(output, { recursive: true });
const snapshots = {}, measurements = {};
const browser = await chromium.launch({ headless: true });
try {
  for (const version of ['baseline', 'optimized']) {
    const outDir = `${output}/build-${version}`;
    const plugins = [{ name: 'measure-pdv-in-tests', transform(code, id) {
      const path = id.replaceAll('\\', '/');
      if (path.endsWith('/src/components/pdv/ProductGrid.jsx')) return code.replace('function ProductGrid({ products, onSelect, loading }) {', 'function ProductGrid({ products, onSelect, loading }) { globalThis.__gridRenders = (globalThis.__gridRenders || 0) + 1;');
      if (path.endsWith('/src/api/nexoApi.js')) return code + '\n nexoApi.entities.SystemConfig = realNexoApi.entities.SystemConfig;';
    } }];
    if (version === 'baseline') plugins.push({ name: 'baseline-pdv', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/pages/PDV.jsx')) return originalPage; } });
    await build({ logLevel: 'error', plugins, define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, build: { outDir } });
    await copyFile(`${outDir}/index.html`, `${outDir}/app.html`);
    const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5181, open: false } });
    try {
      for (const width of [1366, 390]) {
        console.log(`PDV performance: ${version}, ${width}px`);
        const context = await browser.newContext({ viewport: { width, height: 950 } });
        try {
          await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
          await context.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.textContent = 'details:has(> summary .lucide-flask-conical){display:none!important}';
            document.head.append(style);
          }));
          const page = await context.newPage();
          page.setDefaultTimeout(25000);
          const errors = [], configurationRequests = [];
          page.on('pageerror', error => errors.push(error.message));
          // Exercise the real HTTP client/cache for configuration; other APIs use disposable demo data.
          await page.route('**/api/entities/SystemConfig?*', async route => {
            const url = new URL(route.request().url());
            configurationRequests.push(url.pathname + url.search);
            let values = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')).systemConfig);
            values = values.filter(item => item.key !== 'limite_vendas_minimizadas');
            values.push({ id: 'test-limit', key: 'limite_vendas_minimizadas', value: '2' });
            if (url.searchParams.has('filters')) {
              const filters = JSON.parse(url.searchParams.get('filters'));
              values = values.filter(item => Object.entries(filters).every(([key, value]) => item[key] === value));
            }
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(values) });
          });
          const base = server.resolvedUrls.local[0];
          await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
          await page.locator('input[type=email]').fill('demo@nexopdv.local');
          await page.locator('input[type=password]').fill('demo123');
          await page.locator('button[type=submit]').click();
          await page.waitForURL('**/inicio', { waitUntil: 'domcontentloaded' });
          await page.getByRole('heading', { name: 'Seu dia em números' }).waitFor();
          configurationRequests.length = 0;
          await page.goto(`${base}pdv`, { waitUntil: 'domcontentloaded' });
          const cards = page.locator('.pdv-product-card');
          await cards.first().waitFor();
          await page.waitForFunction(() => document.querySelector('[title="Minimizar venda (F7)"]'));
          const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
          const initialCards = await cards.allTextContents();
          await page.evaluate(() => { globalThis.__gridRenders = 0; });
          for (let index = 0; index < 10; index++) await cards.first().click();
          const quantity = page.locator('.pdv-sale-item input[aria-label^="Quantidade de"]');
          assert.equal(await quantity.inputValue(), '10');
          const cartRenders = await page.evaluate(() => globalThis.__gridRenders);
          if (version === 'optimized') assert.equal(cartRenders, 0, 'Cart edits must not rerender an unchanged catalog.');
          else assert.ok(cartRenders >= 10);
          assert.equal(configurationRequests.length, version === 'baseline' ? 2 : 1);
          const result = { initialCards, cart: await page.locator('.pdv-sale-item').allTextContents(), total: await page.locator('.pdv-sale-totals').innerText() };
          // A different function identity must not be needed to keep search selection current.
          const search = page.locator('input[placeholder*="código"]').first();
          await search.fill('Café');
          await page.locator('.pdv-product-panel [class~="top-full"]').getByRole('button', { name: /Café Torrado 500g/ }).first().click();
          assert.equal(await search.inputValue(), '');
          await page.getByRole('button', { name: /^Minimizar/ }).click();
          await page.getByTitle('Abrir esta venda sem precisar minimizar a atual').first().waitFor();
          await cards.first().click();
          await page.getByRole('button', { name: /^Minimizar/ }).click();
          await page.waitForFunction(() => document.querySelectorAll('[title="Abrir esta venda sem precisar minimizar a atual"]').length === 2);
          await cards.first().click();
          assert.equal(await page.getByRole('button', { name: /^Minimizar/ }).isDisabled(), true);
          await page.getByTitle('Abrir esta venda sem precisar minimizar a atual').first().click();
          // Restoring while another cart is active swaps carts and keeps both parked slots.
          assert.equal(await page.getByRole('button', { name: /^Minimizar/ }).isDisabled(), true);
          assert.equal(await quantity.first().inputValue(), '10');
          result.restoredCart = await page.locator('.pdv-sale-item').allTextContents();
          assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4'))), before);
          await page.evaluate(() => { globalThis.__gridRenders = 0; });
          await page.getByRole('button', { name: /^Pagamento/ }).click();
          await page.getByRole('button', { name: /^Dinheiro/ }).click();
          await page.getByRole('button', { name: 'Concluir venda', exact: true }).click();
          await page.getByRole('dialog', { name: 'Recibo da venda' }).waitFor();
          const after = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
          assert.equal(after.sales.length, before.sales.length + 1);
          const completed = after.sales.find(sale => !before.sales.some(previous => previous.id === sale.id));
          assert.ok(completed);
          result.completed = { items: completed.items, payments: completed.payments, total: completed.total };
          for (const previous of before.products) {
            const product = after.products.find(item => item.id === previous.id);
            const sold = completed.items.filter(item => item.product_id === previous.id).reduce((total, item) => total + Number(item.unit === 'peso' ? item.weight : item.quantity), 0);
            assert.equal(Number(product.quantity), Number(previous.quantity) - sold);
            if (!sold) assert.deepEqual(product, previous);
          }
          if (version === 'optimized') assert.ok(await page.evaluate(() => globalThis.__gridRenders > 0), 'Updated stock must rerender the catalog after payment.');
          assert.deepEqual(errors, []);
          snapshots[version] ??= {}; measurements[version] ??= {};
          snapshots[version][width] = result;
          measurements[version][width] = { cartRenders, configurationRequests };
        } finally { await context.close(); }
      }
    } finally { await new Promise(resolve => server.httpServer.close(resolve)); }
  }
  assert.deepEqual(snapshots.optimized, snapshots.baseline);
  await writeFile(`${output}/comparison.json`, JSON.stringify({ measurements, snapshots }, null, 2));
  console.log('PDV catalog, cart, minimized-sale limit and restore match baseline; fewer renders and configuration requests.');
} finally { await browser.close(); }
