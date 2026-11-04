import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const checkpoint = '1da7486';
const originalPage = execFileSync('git', ['show', `${checkpoint}:src/pages/Financeiro.jsx`], { encoding: 'utf8' });
const browser = await chromium.launch({ headless: true });
const snapshots = {};
await mkdir('artifacts/refactor/finance/browser', { recursive: true });
try {
  for (const version of ['baseline', 'refactored']) {
    const server = await createServer({ mode: 'development',
      cacheDir: `artifacts/refactor/finance/vite-${version}`, optimizeDeps: { entries: ['index.html'] },
      define: { 'import.meta.env.VITE_MOCK_API': '"true"' },
      plugins: version === 'baseline' ? [{ name: 'checkpoint-finance-page', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/pages/Financeiro.jsx')) return originalPage; } }] : [],
      server: { host: '127.0.0.1', port: 0, open: false },
    });
    try {
      await server.listen();
      const base = server.resolvedUrls.local[0];
      for (const width of [1366, 390]) {
        console.log(`Finance comparison: ${version}, ${width}px`);
        const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Bahia', acceptDownloads: true });
        try {
          await context.addInitScript(() => {
            const fixed = 1793718000000;
            const OriginalDate = Date;
            class FrozenDate extends OriginalDate {
              constructor(...args) { super(...(args.length ? args : [fixed])); }
              static now() { return fixed; }
            }
            window.Date = FrozenDate;
          });
          await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
          const page = await context.newPage();
          page.setDefaultNavigationTimeout(90000);
          const errors = [];
          const analysisRequests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => {
            if (request.url().includes('/src/features/finance/analysis/FinancialAnalysis.jsx')) analysisRequests.push(request.url());
          });
          await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
          await page.locator('input[type=email]').fill('demo@nexopdv.local');
          await page.locator('input[type=password]').fill('demo123');
          await page.locator('button[type=submit]').click();
          await page.waitForURL('**/inicio');
          await page.waitForFunction(() => Boolean(localStorage.getItem('nexo:mock-db:v4')));
          const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4')));
          await page.goto(`${base}financeiro`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }).waitFor();
          await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important} details:has(> summary .lucide-flask-conical){display:none!important}' });
          const finance = page.locator('.page-shell').filter({ has: page.getByRole('heading', { name: 'Financeiro', level: 1, exact: true }) });
          const output = {};
          const capture = async () => (await finance.innerText()).replace(/\s+/g, ' ').trim();
          async function openSection(key, label) {
            if (width < 1024) await page.getByLabel('Área financeira', { exact: true }).selectOption(key);
            else if (key === 'overview') await page.getByRole('navigation', { name: 'Áreas financeiras principais' }).getByRole('button', { name: label, exact: true }).click();
            else {
              const menu = finance.locator('details').filter({ has: page.locator('button[aria-label="Abrir Fluxo de caixa"]') });
              await menu.locator('summary').click();
              await page.getByRole('button', { name: `Abrir ${label}`, exact: true }).click();
            }
            await page.getByRole('heading', { name: label, level: 2, exact: true }).waitFor();
          }
          for (const [key, label, ready] of [
            ['overview', 'Visão geral', null],
            ['cashflow', 'Fluxo de caixa', 'Entradas realizadas'],
            ['results', 'Resultados', 'DRE simplificada'],
            ['reports', 'Relatórios', 'Central de relatórios'],
          ]) {
            await openSection(key, label);
            if (ready) await finance.getByText(ready, { exact: true }).waitFor();
            if (key === 'cashflow') await finance.locator('.recharts-surface').first().waitFor();
            if (version === 'refactored' && key === 'overview') assert.equal(analysisRequests.length, 0);
            if (version === 'refactored' && key === 'cashflow') assert.ok(analysisRequests.length > 0);
            output[key] = await capture();
          }
          async function captureCsv() {
            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Exportar planilha (CSV)', exact: true }).click();
            const download = await pending;
            const bytes = await readFile(await download.path());
            return { name: download.suggestedFilename(), bytes: bytes.toString('base64') };
          }
          output.csv = await captureCsv();
          for (const preset of ['today', 'yesterday', '7days', 'month', 'previous']) {
            await page.getByLabel('Período rápido').selectOption(preset);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.waitForFunction(() => !document.querySelector('button[aria-label="Atualizar"]')?.disabled);
            output[`period:${preset}`] = await capture();
          }
          output.csvPreviousMonth = await captureCsv();
          await page.evaluate(async () => {
            const { nexoApi } = await import('/src/api/nexoApi.js');
            const bootstrap = nexoApi.finance.bootstrap;
            nexoApi.finance.bootstrap = async () => {
              const data = await bootstrap();
              return { ...data, permissions: { ...data.permissions, export: false } };
            };
          });
          await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
          await page.getByText('A exportação de relatórios não está incluída neste plano.', { exact: true }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Exportar planilha (CSV)', exact: true }).count(), 0);
          assert.equal(await page.getByRole('button', { name: 'Imprimir / salvar PDF', exact: true }).count(), 0);
          output.exportDenied = await capture();
          assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('nexo:mock-db:v4'))), before);
          assert.deepEqual(errors, []);
          snapshots[`${version}:${width}`] = output;
          if (version === 'refactored') {
            assert.deepEqual(output, snapshots[`baseline:${width}`]);
            await page.screenshot({ path: `artifacts/refactor/finance/browser/finance-${width}.png` });
          }
        } finally { await context.close(); }
      }
    } finally { await server.close(); }
  }
  await writeFile('artifacts/refactor/finance/browser/comparison.json', JSON.stringify(snapshots, null, 2));
  console.log('Finance overview/analysis, period presets, CSV bytes/names and export restrictions match checkpoint at desktop/mobile widths. Demonstration records unchanged.');
} finally { await browser.close(); }
