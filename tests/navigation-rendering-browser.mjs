import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const paths = ['src/components/stock/StockProductViews.jsx', 'src/pages/Vendas.jsx', 'src/pages/Relatorios.jsx', 'src/components/reports/ReportCharts.jsx', 'src/components/finance/FinanceCharts.jsx'];
const previous = Object.fromEntries(paths.map(path => [path, execFileSync('git', ['show', `85c775f:${path}`], { encoding: 'utf8' })]));
const output = 'artifacts/refactor/navigation-rendering';
await mkdir(output, { recursive: true });
const snapshots = {}, measurements = {};
const browser = await chromium.launch({ headless: true });
try {
  for (const version of ['baseline', 'optimized']) {
    const outDir = `${output}/build-${version}`;
    const plugins = [{ name: 'count-management-query', transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/api/nexoApi.js')) return code + '\nglobalThis.__managementCalls = 0; const overview = nexoApi.management.overview; nexoApi.management.overview = (...args) => { globalThis.__managementCalls++; return overview(...args); };';
    } }];
    if (version === 'baseline') plugins.push({ name: 'baseline-responsive-layout', enforce: 'pre', load(id) { const path = paths.find(path => id.replaceAll('\\', '/').endsWith('/' + path)); if (path) return previous[path]; } });
    await build({ logLevel: 'error', plugins, define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, build: { outDir } });
    await copyFile(`${outDir}/index.html`, `${outDir}/app.html`);
    const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5181, open: false } });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Bahia' });
    try {
      await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      await context.addInitScript(() => {
        const OriginalDate = Date;
        window.Date = class extends OriginalDate {
          constructor(...args) { super(...(args.length ? args : [Date.UTC(2026, 10, 4, 15)])); }
          static now() { return OriginalDate.UTC(2026, 10, 4, 15); }
        };
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style'); style.textContent = 'details:has(> summary .lucide-flask-conical){display:none!important}'; document.head.append(style);
        });
      });
      const page = await context.newPage(); page.setDefaultTimeout(25000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const base = server.resolvedUrls.local[0];
      await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
      await page.locator('input[type=email]').fill('demo@nexopdv.local');
      await page.locator('input[type=password]').fill('demo123');
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/inicio', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Seu dia em números' }).waitFor();
      const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
      const before = await readDb();
      const result = { stock: {}, sales: {} }, measured = { stock: {}, sales: {} };
      await page.goto(`${base}estoque`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('textbox', { name: 'Produto Acetona Juliana', exact: true }).waitFor();
      for (const width of [390, 1024, 1279, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        if (width >= 1280) await page.getByRole('textbox', { name: 'Produto Acetona Juliana', exact: true }).waitFor();
        else await page.getByRole('button', { name: 'Editar Acetona Juliana', exact: true }).first().waitFor();
        result.stock[width] = width >= 1280
          ? await page.locator('table input[aria-label^="Produto "]:visible').evaluateAll(inputs => inputs.map(input => input.value))
          : await page.getByRole('button', { name: /^Editar / }).evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')).filter(label => !label.endsWith('no formulario')));
        measured.stock[width] = await page.locator('main *').count();
        if (version === 'optimized') assert.equal(await page.locator('main table').count(), width >= 1280 ? 1 : 0);
      }
      const filter = page.getByPlaceholder('Produto, categoria ou código', { exact: true }).filter({ visible: true }).first();
      await filter.fill('Café');
      await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 1);
      result.filteredStock = await page.locator('table input[aria-label^="Produto "]:visible').evaluateAll(inputs => inputs.map(input => input.value));
      await filter.fill('');
      await page.getByRole('textbox', { name: 'Produto Acetona Juliana', exact: true }).waitFor();
      await page.goto(`${base}vendas`, { waitUntil: 'domcontentloaded' });
      await page.locator('.history-results').waitFor();
      for (const width of [390, 1024, 1279, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        const wide = await page.locator('.history-results').evaluate(element => element.getBoundingClientRect().width >= 1080);
        await page.locator(wide ? '.history-table' : '.history-card-list').waitFor();
        result.sales[width] = (await page.locator('.history-results').innerText()).replace(/\s+/g, ' ').trim();
        measured.sales[width] = await page.locator('main *').count();
        if (version === 'optimized') {
          assert.equal(await page.locator('.history-table').count(), wide ? 1 : 0);
          assert.equal(await page.locator('.history-card-list').count(), wide ? 0 : 1);
        }
      }
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.getByTitle('Recolher menu', { exact: true }).click();
      await page.locator('.history-table').waitFor();
      if (version === 'optimized') assert.equal(await page.locator('.history-card-list').count(), 0);
      await page.getByTitle('Expandir menu', { exact: true }).click();
      await page.locator('.history-card-list').waitFor();
      await page.getByRole('button', { name: /^Ver detalhes da venda/ }).first().click();
      await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
      await page.goto(`${base}relatorios`, { waitUntil: 'domcontentloaded' });
      await page.mouse.move(0, 0);
      const reports = page.locator('.page-shell').filter({ has: page.getByRole('heading', { name: 'Relatórios', level: 1, exact: true }) });
      await reports.getByRole('heading', { name: 'Relatórios', exact: true }).waitFor();
      await page.locator('.recharts-surface').first().waitFor();
      await page.waitForTimeout(1800);
      // Static pie labels appear immediately now; compare the unchanged report
      // indicators/rankings independently from transient SVG animation labels.
      result.reports = await reports.evaluate(element => {
        const clone = element.cloneNode(true);
        clone.querySelectorAll('svg').forEach(svg => svg.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim();
      });
      measured.managementCalls = await page.evaluate(() => globalThis.__managementCalls);
      assert.equal(measured.managementCalls, version === 'baseline' ? 1 : 0);
      assert.deepEqual(await readDb(), before);
      // Only the optimized version commits the focused table draft before removing that layout.
      if (version === 'optimized') {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`${base}estoque`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('textbox', { name: 'Produto Acetona Juliana', exact: true }).fill('Acetona Juliana Revisada');
        await page.setViewportSize({ width: 1279, height: 1000 });
        await page.getByRole('button', { name: 'Editar Acetona Juliana Revisada', exact: true }).first().waitFor();
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.equal(await page.getByRole('textbox', { name: 'Produto Acetona Juliana Revisada', exact: true }).inputValue(), 'Acetona Juliana Revisada');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')).products.some(product => product.name === 'Acetona Juliana Revisada'));
        const after = await readDb();
        const old = before.products.find(product => product.name === 'Acetona Juliana');
        for (const product of before.products) assert.deepEqual(after.products.find(item => item.id === product.id), product.id === old.id ? { ...product, name: 'Acetona Juliana Revisada' } : product);
      }
      assert.deepEqual(errors, []);
      snapshots[version] = result; measurements[version] = measured;
      console.log(`${version}: responsive layouts, filters, sales details and reports verified.`);
    } finally { await context.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
  }
  assert.deepEqual(snapshots.optimized, snapshots.baseline);
  await writeFile(`${output}/comparison.json`, JSON.stringify({ measurements, snapshots }, null, 2));
  console.log('Visible results match baseline; duplicate trees and redundant report query removed; focused edits survive resize.');
} finally { await browser.close(); }
