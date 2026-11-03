import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.VITE_MOCK_API = 'true';
const server = await createServer({ mode: 'development', define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultNavigationTimeout(45000);
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}login`);
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await page.getByRole('heading', { name: 'Recuperar acesso', exact: true }).waitFor();
  await page.getByLabel('E-mail', { exact: true }).fill('demo@nexopdv.local');
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await page.getByRole('alert').waitFor({ timeout: 5000 });
  assert.match(await page.getByRole('alert').innerText(), /ambiente de demonstração/);
  await page.goto(`${base}login`);
  await page.locator('input[type=email]').fill('demo@nexopdv.local');
  await page.locator('input[type=password]').fill('demo123');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/inicio');
  await page.getByRole('heading', { name: 'Primeiros passos' }).waitFor();
  await page.getByRole('heading', { name: 'Reposição', exact: true }).waitFor();
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important} details:has(> summary .lucide-flask-conical){display:none!important}' });
  await mkdir('artifacts/management', { recursive: true });
  await page.screenshot({ path: 'artifacts/management/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'artifacts/management/mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Conferir pendências' }).click();
  await page.waitForURL('**/fiados?status=pendente');
  assert.equal(await page.getByLabel('Filtrar por status').inputValue(), 'pendente');
  await page.goto(`${base}pdv`);
  await page.locator('.pdv-product-card').first().waitFor();
  await page.addStyleTag({ content: 'details:has(> summary .lucide-flask-conical){display:none!important}' });
  const baseline = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('nexo:mock-db:v4'));
    if (!db) throw new Error('Missing isolated mock data');
    return { count: db.sales.length, products: db.products };
  });
  await page.evaluate(async () => {
    const { nexoApi } = await import('/src/api/nexoApi.js');
    const complete = nexoApi.sales.complete;
    nexoApi.sales.complete = async payload => { await complete(payload); throw new Error('Simulated lost response'); };
    nexoApi.sales.operation = async () => { throw new Error('Simulated network unavailable'); };
  });
  await page.locator('.pdv-product-card').first().click();
  await page.getByRole('button', { name: /^Pagamento/ }).click();
  await page.getByRole('button', { name: /^Dinheiro/ }).click();
  await page.getByRole('button', { name: 'Concluir venda', exact: true }).click();
  await page.getByRole('button', { name: 'Conferir e tentar novamente' }).waitFor();
  const journal = await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith('nexo:pdv:pending:')));
  assert.ok(journal);
  const operationId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).client_operation_id, journal);
  await page.reload();
  await page.getByRole('button', { name: 'Conferir e tentar novamente' }).click();
  await page.getByRole('dialog', { name: 'Recibo da venda' }).waitFor();
  const after = await page.evaluate(key => ({ db: JSON.parse(localStorage.getItem('nexo:mock-db:v4')), pending: localStorage.getItem(key) }), journal);
  assert.equal(after.db.sales.length, baseline.count + 1);
  assert.equal(after.pending, null);
  const newest = after.db.sales.find(sale => sale.client_operation_id === operationId);
  assert.ok(newest);
  for (const item of newest.items) {
    const before = baseline.products.find(product => product.id === item.product_id);
    const product = after.db.products.find(product => product.id === item.product_id);
    const sold = item.unit === 'peso' ? item.weight : item.quantity;
    assert.equal(Number(product.quantity), Number(before.quantity) - Number(sold));
    const card = page.locator('.pdv-product-card').filter({ hasText: product.name }).first();
    assert.match(await card.innerText(), new RegExp(`Estq: ${product.quantity}(?:\\D|$)`));
  }
  assert.deepEqual(errors, []);
  console.log('Management, recovery guidance, responsive layout and lost-response sale recovery passed with isolated mock data.');
} finally {
  await browser?.close();
  await server.close();
}
