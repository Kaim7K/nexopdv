import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ mode: 'development', cacheDir: 'artifacts/refactor/vite-loading', optimizeDeps: { entries: ['index.html'] },
  define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultNavigationTimeout(90000);
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill('demo@nexopdv.local');
  await page.locator('input[type=password]').fill('demo123');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/inicio');
  const simulator = page.locator('details').filter({ has: page.locator('summary .lucide-flask-conical') });
  await simulator.locator('summary').click();
  for (const role of ['Vendedor', 'Gerente', 'Administrador']) {
    assert.equal(await simulator.getByRole('button', { name: new RegExp(`^${role}`) }).isVisible(), true);
  }
  await simulator.locator('summary').click();
  const baseline = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('nexo:mock-db:v4'));
    if (!db) throw new Error('Isolated mock dataset missing');
    return { sales: db.sales, products: db.products, fiados: db.fiados };
  });
  await page.evaluate(async () => {
    const { nexoApi } = await import('/src/api/nexoApi.js');
    const original = nexoApi.entities.Sale.list;
    let fail = true;
    globalThis.reportLoadCalls = 0;
    nexoApi.entities.Sale.list = async (...args) => {
      globalThis.reportLoadCalls++;
      if (fail) { fail = false; throw new Error('Falha simulada nos relatórios'); }
      return original(...args);
    };
  });
  await page.getByRole('link', { name: 'Relatórios', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Falha simulada nos relatórios' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Relatórios', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await page.getByRole('heading', { name: 'Relatórios', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => globalThis.reportLoadCalls), 2);
  if (await page.getByRole('button', { name: 'Fechar notificação' }).count()) await page.getByRole('button', { name: 'Fechar notificação' }).first().click();
  await page.waitForFunction(() => !document.body.textContent.includes('Erro ao carregar dados.'));
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.waitForURL('**/inicio');
  await page.getByRole('heading', { name: 'Visão geral', exact: true }).waitFor();
  await page.evaluate(async () => {
    const { nexoApi } = await import('/src/api/nexoApi.js');
    nexoApi.entities.Sale.list = () => new Promise((_resolve, reject) => { globalThis.rejectLateReport = reject; });
  });
  await page.getByRole('link', { name: 'Relatórios', exact: true }).click();
  await page.getByText('Carregando relatórios...', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.waitForURL('**/inicio');
  await page.getByRole('heading', { name: 'Visão geral', exact: true }).waitFor();
  await page.evaluate(async () => {
    globalThis.rejectLateReport(new Error('Late response after navigation'));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert.equal(await page.getByText('Erro ao carregar dados.', { exact: true }).count(), 0);
  const after = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('nexo:mock-db:v4'));
    return { sales: db.sales, products: db.products, fiados: db.fiados };
  });
  assert.deepEqual(after, baseline);
  assert.deepEqual(errors, []);
  console.log('Report loading failure/retry, ignored late completion, unchanged demo records and all role simulator options passed.');
} finally {
  await browser?.close();
  await server.close();
}
