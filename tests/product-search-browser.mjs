import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { searchProducts as baselineSearch } from './fixtures/product-search-baseline.mjs';

const previous = execFileSync('git', ['show', '39a34af:src/lib/pdv.js'], { encoding: 'utf8' });
const output = 'artifacts/refactor/search';
await mkdir(output, { recursive: true });
const snapshots = {};
const browser = await chromium.launch({ headless: true });
try {
  for (const version of ['baseline', 'optimized']) {
    const outDir = `${output}/build-${version}`;
    const plugins = [{ name: 'test-api-reference', transform(code, id) { if (id.replaceAll('\\', '/').endsWith('/src/api/nexoApi.js')) return code + '\nwindow.__searchTestApi = nexoApi;'; } }];
    if (version === 'baseline') plugins.push({ name: 'baseline-search', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/lib/pdv.js')) return previous; } });
    await build({ logLevel: 'error', plugins, define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, build: { outDir } });
    await copyFile(`${outDir}/index.html`, `${outDir}/app.html`);
    const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5181, open: false } });
    try {
      for (const width of [1366, 390]) {
        console.log(`Product search: ${version}, ${width}px`);
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
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const base = server.resolvedUrls.local[0];
          await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
          await page.locator('input[type=email]').fill('demo@nexopdv.local');
          await page.locator('input[type=password]').fill('demo123');
          await page.locator('button[type=submit]').click();
          await page.waitForURL('**/inicio', { waitUntil: 'domcontentloaded' });
          await page.goto(`${base}pdv`, { waitUntil: 'domcontentloaded' });
          await page.locator('.pdv-product-card').first().waitFor();
          const catalog = await page.evaluate(async () => (await window.__searchTestApi.products.catalog(1200)).filter(product => product.status === 'ativo'));
          const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
          const search = page.getByPlaceholder('Buscar produto ou código...', { exact: true });
          const dropdown = page.locator('.pdv-product-panel [class~="top-full"]');
          const result = [];
          for (const query of ['café', 'CAFE', 'aroz', 'leiti', 'limpeza', String(catalog[0].barcode), 'produto inexistente zzz']) {
            const expected = baselineSearch(catalog, query).map(product => product.name);
            await search.fill(query);
            await page.waitForFunction(names => {
              const actual = [...document.querySelectorAll('.pdv-product-panel [class~="top-full"] button .font-medium')].map(element => element.textContent);
              return JSON.stringify(actual) === JSON.stringify(names);
            }, expected);
            if (!expected.length) await dropdown.getByText('Nenhum produto encontrado', { exact: true }).waitFor();
            result.push({ query, names: await dropdown.locator('button .font-medium').allTextContents() });
          }
          await search.fill('café');
          const expectedProduct = baselineSearch(catalog, 'café')[0];
          await dropdown.getByRole('button', { name: new RegExp(expectedProduct.name) }).first().click();
          assert.equal(await search.inputValue(), '');
          await page.locator('.pdv-sale-item').filter({ hasText: expectedProduct.name }).waitFor();
          // Scanner input is captured outside text fields, through the existing keyboard path.
          await search.evaluate(element => element.blur());
          await page.keyboard.type(String(catalog[0].barcode), { delay: 5 });
          await page.keyboard.press('Enter');
          await page.locator('.pdv-sale-item').filter({ hasText: catalog[0].name }).waitFor();
          result.push({ cart: await page.locator('.pdv-sale-item').allTextContents(), total: await page.locator('.pdv-sale-totals').innerText() });
          if (width > 640) {
            const localSearch = page.getByPlaceholder('Filtrar produtos...', { exact: true });
            await localSearch.fill('aroz');
            const expectedGrid = baselineSearch(catalog, 'aroz', { limit: 300 }).slice(0, 100).map(product => product.name);
            await page.waitForFunction(names => JSON.stringify([...document.querySelectorAll('.pdv-product-card [title]')].map(element => element.getAttribute('title'))) === JSON.stringify(names), expectedGrid);
            result.push({ grid: await page.locator('.pdv-product-card [title]').allTextContents() });
          }
          assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4'))), before);
          assert.deepEqual(errors, []);
          snapshots[version] ??= {};
          snapshots[version][width] = result;
        } finally { await context.close(); }
      }
    } finally { await new Promise(resolve => server.httpServer.close(resolve)); }
  }
  assert.deepEqual(snapshots.optimized, snapshots.baseline);
  await writeFile(`${output}/browser-comparison.json`, JSON.stringify(snapshots, null, 2));
  console.log('Search ordering, selection, scanner capture and cart match baseline; existing data preserved.');
} finally { await browser.close(); }
