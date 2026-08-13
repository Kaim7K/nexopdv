import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.VISUAL_BASE_URL || 'http://127.0.0.1:5173';
const outDir = process.env.VISUAL_MODAL_OUT_DIR || 'artifacts/modal-screenshots';
const viewports = [
  ['mobile-360', 360, 780],
  ['desktop-1366', 1366, 900],
];

const adminUser = {
  id: 'usr_visual_admin', full_name: 'Maria Oliveira', name: 'Maria Oliveira',
  email: 'demo@nexopdv.local', role: 'admin', market_id: 'market_demo',
  market_name: 'Mercadinho Alameda das Árvores', unit_id: 'unit_main',
  unit_name: 'Unidade principal', primary_color: '#16a06a',
  require_cash_register: true,
  enabled_modules: ['pdv', 'estoque', 'vendas', 'caixas', 'fiados', 'relatorios', 'financeiro', 'auditoria', 'usuarios', 'configuracoes'],
  enabled_features: ['market_logo', 'sidebar_customization', 'product_image_upload', 'automatic_image_search', 'quick_product_creation', 'report_export', 'recurring_finance', 'integrated_purchases', 'stock_email_alerts', 'email_sending', 'financial_email_alerts'],
};

const superUser = {
  id: 'usr_visual_super', full_name: 'Super Admin', name: 'Super Admin',
  email: 'super@nexopdv.local', role: 'super_admin', market_name: 'Nexo Plataforma',
  primary_color: '#16a06a',
};

const scenarios = [
  ['pdv-caixa', '/pdv', 'admin', async (page) => page.getByRole('button', { name: /Caixa aberto|Abrir caixa/ }).first().click()],
  ['pdv-correcao', '/pdv', 'admin', async (page) => {
    await page.locator('button').filter({ hasText: 'Pão francês' }).first().click();
    await page.getByRole('button', { name: /Corrigir valor/ }).click();
  }],
  ['pdv-pagamento', '/pdv', 'admin', async (page) => {
    await page.locator('button').filter({ hasText: 'Pão francês' }).first().click();
    await page.getByRole('button', { name: /Pagamento/ }).last().click();
  }],
  ['pdv-cadastro-rapido', '/pdv', 'admin', async (page) => {
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.type('9999999999999');
    await page.keyboard.press('Enter');
  }],
  ['estoque-novo-produto', '/estoque', 'admin', async (page) => page.getByRole('button', { name: /Novo produto/ }).click()],
  ['estoque-editar-produto', '/estoque', 'admin', async (page) => page.getByRole('button', { name: /^Editar/ }).first().click()],
  ['venda-detalhes', '/vendas', 'admin', async (page) => page.getByRole('button', { name: /Ver detalhes/ }).first().click()],
  ['venda-cancelar', '/vendas', 'admin', async (page) => {
    const moreActions = page.getByText('Mais ações', { exact: true });
    const more = (await moreActions.count()) > 1 ? moreActions.nth(1) : moreActions.first();
    if (await more.isVisible()) await more.click();
    await page.locator('button[title="Cancelar"]:visible').first().click();
  }],
  ['caixa-detalhes', '/caixas', 'admin', async (page) => page.getByRole('button', { name: /Detalhes|Resumo/ }).first().click()],
  ['fiado-quitar', '/fiados', 'admin', async (page) => page.getByRole('button', { name: /^Quitar$/ }).first().click()],
  ['fiado-cancelar', '/fiados', 'admin', async (page) => page.getByRole('button', { name: /Cancelar fiado/ }).first().click()],
  ['financeiro-despesa', '/financeiro', 'admin', async (page) => page.getByRole('button', { name: /Adicionar despesa/ }).click()],
  ['usuario-novo', '/usuarios', 'admin', async (page) => page.getByRole('button', { name: /Novo funcionário/ }).click()],
  ['usuario-editar', '/usuarios', 'admin', async (page) => page.getByRole('button', { name: /^Editar / }).first().click()],
  ['admin-novo-mercado', '/admin/mercados', 'super', async (page) => page.getByRole('button', { name: /Novo mercado/ }).click()],
  ['admin-novo-plano', '/admin/planos', 'super', async (page) => page.getByRole('button', { name: /Novo plano/ }).click()],
];

async function seedSession(page, role) {
  const user = role === 'super' ? superUser : adminUser;
  await page.addInitScript(({ seededUser }) => {
    localStorage.setItem('nexo:session-user', JSON.stringify({
      user: seededUser,
      expiresAt: Date.now() + 60 * 60 * 1000,
    }));
    sessionStorage.removeItem('nexo:system-config');
  }, { seededUser: user });
}

async function waitForPage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(250);
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.VISUAL_BROWSER_CHANNEL || 'chrome' });
const results = [];

for (const [viewport, width, height] of viewports) {
  for (const [name, route, role, openModal] of scenarios) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    page.on('pageerror', (error) => errors.push(error.message));
    await seedSession(page, role);
    let failure = '';
    let metrics = null;
    try {
      await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
      await waitForPage(page);
      await openModal(page);
      const dialog = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').last();
      await dialog.waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(200);
      metrics = await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          width: Math.round(rect.width), height: Math.round(rect.height),
          top: Math.round(rect.top), bottom: Math.round(rect.bottom),
          internalOverflow: element.scrollHeight > element.clientHeight + 2,
          outsideViewport: rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1,
          title: element.querySelector('h1,h2,h3,[data-title]')?.textContent?.trim() || '',
        };
      });
      await page.screenshot({ path: path.join(outDir, `${viewport}__${name}.png`), animations: 'disabled' });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    results.push({ viewport, route, name, failure, metrics, consoleErrors: [...new Set(errors)] });
    await context.close();
  }
}

await browser.close();
await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results }, null, 2));
const failed = results.filter((item) => item.failure || item.metrics?.outsideViewport || item.consoleErrors.length);
console.log(`Modais verificados: ${results.length - failed.length}/${results.length}`);
for (const item of failed) console.log(`- ${item.viewport} ${item.name}: ${item.failure || JSON.stringify(item.metrics)} ${item.consoleErrors.join(' | ')}`);
if (failed.length) process.exitCode = 1;
