import assert from 'node:assert/strict';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const output = 'artifacts/refactor/page-header';
const outDir = `${output}/build`;
await mkdir(output, { recursive: true });
await build({ logLevel: 'error', define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, build: { outDir }, plugins: [{ name: 'test-header-api', transform(code, id) { if (id.replaceAll('\\', '/').endsWith('/src/api/nexoApi.js')) return code + '\nwindow.__headerTestApi = nexoApi;'; } }] });
await copyFile(`${outDir}/index.html`, `${outDir}/app.html`);
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5181, open: false } });
const browser = await chromium.launch({ headless: true });
const measurements = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const base = server.resolvedUrls.local[0];
  await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill('demo@nexopdv.local');
  await page.locator('input[type=password]').fill('demo123');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/inicio', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Seu dia em números' }).waitFor();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
  async function checkHeader(role, width, route) {
    const header = page.locator('main .page-header').first();
    await header.waitFor();
    const bounds = await header.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const subtitle = element.querySelector('.page-subtitle');
      const text = subtitle?.getBoundingClientRect();
      return { left: rect.left, right: rect.right, height: rect.height, subtitleWidth: text?.width, subtitleHeight: text?.height };
    });
    if (bounds.subtitleWidth !== undefined) {
      assert.ok(bounds.subtitleWidth >= 140, `${role} ${width} ${route}: compressed subtitle ${bounds.subtitleWidth}`);
      assert.ok(bounds.subtitleHeight < 80, `${role} ${width} ${route}: vertical subtitle ${bounds.subtitleHeight}`);
    }
    for (const button of await header.getByRole('button').all()) {
      const rect = await button.boundingBox();
      if (rect) assert.ok(rect.x >= bounds.left - 1 && rect.x + rect.width <= bounds.right + 1, `${role} ${width} ${route}: overflowing button ${await button.innerText()}`);
    }
    measurements.push({ role, width, route, ...bounds });
  }
  for (const role of ['admin', 'gerente', 'vendedor']) {
    await page.evaluate(role => window.__headerTestApi.auth.simulateRole(role), role);
    await page.goto(`${base}estoque`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Novo produto', exact: true }).waitFor();
    for (const width of [320, 390, 768, 1024, 1279, 1280, 1366, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await checkHeader(role, width, 'estoque');
      if (width >= 1280) {
        const price = page.locator('table input[aria-label^="Venda de"]').first();
        await price.waitFor();
        assert.ok((await price.boundingBox()).width >= 110, `${role}: cramped price field`);
        const actionsFit = await page.locator('table tbody tr').first().evaluate(row => {
          const cell = row.lastElementChild.getBoundingClientRect();
          return [...row.lastElementChild.querySelectorAll('button')].every(button => {
            const bounds = button.getBoundingClientRect();
            return bounds.left >= cell.left && bounds.right <= cell.right;
          });
        });
        assert.equal(actionsFit, true, `${role}: table actions overflow their cell`);
      }
      if (role === 'gerente' && [390, 1280, 1366].includes(width)) await page.screenshot({ path: `${output}/stock-manager-${width}.png` });
    }
    await page.getByRole('button', { name: 'Novo produto', exact: true }).click();
    await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    if (role !== 'vendedor') {
      await page.getByRole('button', { name: 'Lixeira / recuperar produtos', exact: true }).click();
      await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    }
    console.log(`Stock header: ${role}, nine viewport widths passed.`);
  }
  await page.evaluate(() => window.__headerTestApi.auth.simulateRole('admin'));
  for (const route of ['vendas', 'fiados', 'relatorios', 'usuarios', 'configuracoes']) {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
    for (const width of [390, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await checkHeader('admin', width, route);
    }
    console.log(`Shared header: ${route} passed.`);
  }
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4'))), before);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/measurements.json`, JSON.stringify(measurements, null, 2));
  console.log('Headers remain readable, actions fit, forms open, and existing records are unchanged.');
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
