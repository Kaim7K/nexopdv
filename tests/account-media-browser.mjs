import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { compactAccountImage, handleAppearance, handleAccountMedia } from '../server/account-media.js';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG2kAAAAASUVORK5CYII=';
const user = { id: 'usr_demo_admin', market_id: 'mkt_demo', logo_url: compactAccountImage(image, 'logo', 'mkt_demo') };
const avatar = compactAccountImage(image, 'avatar', user.id);
const outDir = 'artifacts/refactor/har-performance/browser-build';
await mkdir(outDir, { recursive: true });
await build({ logLevel: 'error', define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, build: { outDir }, plugins: [{ name: 'compact-media-fixture', transform(code, id) {
  if (!id.replaceAll('\\', '/').endsWith('/src/api/nexoApi.js')) return;
  return code + `
    const login = nexoApi.auth.login, me = nexoApi.auth.me;
    const compact = user => ({ ...user, logo_url: ${JSON.stringify(user.logo_url)}, photo_url: ${JSON.stringify(avatar)} });
    nexoApi.auth.me = async () => compact(await me());
    nexoApi.auth.login = async (...args) => {
      const result = await login(...args); await me();
      const db = JSON.parse(localStorage.getItem('nexo:mock-db:v4'));
      db.systemConfig = db.systemConfig.filter(item => item.key !== 'logo_url');
      db.systemConfig.push({ id: 'test-logo', key: 'logo_url', value: ${JSON.stringify(image)} });
      localStorage.setItem('nexo:mock-db:v4', JSON.stringify(db));
      return { ...result, user: compact(result.user) };
    };
    nexoApi.system.appearance = realNexoApi.system.appearance;
    window.__mediaApi = nexoApi;`;
} }] });
await copyFile(`${outDir}/index.html`, `${outDir}/app.html`);
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5181, open: false } });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 950 }, acceptDownloads: true });
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/api\/(?:account-media\/|system\/appearance)/, async route => {
    const url = new URL(route.request().url());
    const headers = {};
    const res = { code: 200, body: undefined, setHeader(key, value) { headers[key] = value; }, getHeader(key) { return headers[key]; }, status(code) { this.code = code; return this; }, json(data) { this.body = JSON.stringify(data); headers['Content-Type'] = 'application/json'; return this; }, send(data) { this.body = data; return this; }, end() { this.body = ''; } };
    const req = { method: 'GET', query: Object.fromEntries(url.searchParams), headers: {} };
    if (url.pathname.endsWith('/appearance')) {
      const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')).systemConfig);
      await handleAppearance({ req, res, user, sql: async () => rows.map(item => ({ key: item.key, value: item.key === 'logo_url' ? compactAccountImage(item.value, 'config-logo', user.market_id) : item.value })) });
    } else await handleAccountMedia({ req, res, user, kind: url.pathname.split('/').at(-1), sql: async () => [{ image }] });
    await route.fulfill({ status: res.code, headers, body: res.body });
  });
  const base = server.resolvedUrls.local[0];
  await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill('demo@nexopdv.local');
  await page.locator('input[type=password]').fill('demo123');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/inicio', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Seu dia em números' }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.app-sidebar img')].length >= 2 && [...document.querySelectorAll('.app-sidebar img')].every(image => image.complete && image.naturalWidth > 0));
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
  await page.goto(`${base}configuracoes`, { waitUntil: 'domcontentloaded' });
  await page.locator('.page-shell img[src^="data:image/"]').first().waitFor();
  const rawLogo = await page.evaluate(async () => (await window.__mediaApi.entities.SystemConfig.list()).find(item => item.key === 'logo_url').value);
  assert.equal(rawLogo, image, 'editor must retain the original stored image');
  await page.goto(`${base}vendas`, { waitUntil: 'domcontentloaded' });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const pdf = await download;
  assert.match(pdf.suggestedFilename(), /\.pdf$/);
  assert.match((await readFile(await pdf.path())).toString('latin1'), /\/Subtype\s*\/Image/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4'))), before);
  assert.deepEqual(errors, []);
  console.log('Authenticated-style logo/avatar URLs load; raw editor image and PDF branding survive; demo records unchanged.');
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
