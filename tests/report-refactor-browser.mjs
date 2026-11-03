import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const checkpoint = '9c3d2fd';
const originalPage = execFileSync('git', ['show', `${checkpoint}:src/pages/Relatorios.jsx`], { encoding: 'utf8' });
const browser = await chromium.launch({ headless: true });
const results = {};
await mkdir('artifacts/refactor/browser', { recursive: true });
try {
  for (const version of ['baseline', 'refactored']) {
    const server = await createServer({
      mode: 'development', cacheDir: `artifacts/refactor/vite-${version}`,
      optimizeDeps: { entries: ['index.html'] },
      define: { 'import.meta.env.VITE_MOCK_API': '"true"' },
      plugins: version === 'baseline' ? [{ name: 'checkpoint-report-page', enforce: 'pre', load(id) { if (id.replaceAll('\\', '/').endsWith('/src/pages/Relatorios.jsx')) return originalPage; } }] : [],
      server: { host: '127.0.0.1', port: 0, open: false },
    });
    try {
      await server.listen();
      const base = server.resolvedUrls.local[0];
      for (const width of [1366, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Bahia' });
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
          page.setDefaultNavigationTimeout(45000);
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
          await page.locator('input[type=email]').fill('demo@nexopdv.local');
          await page.locator('input[type=password]').fill('demo123');
          await page.locator('button[type=submit]').click();
          await page.waitForURL('**/inicio');
          await page.goto(`${base}relatorios`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('heading', { name: 'Relatórios', exact: true }).waitFor();
          await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important} details:has(> summary .lucide-flask-conical){display:none!important}' });
          const report = page.locator('.page-shell').filter({ has: page.getByRole('heading', { name: 'Relatórios', exact: true }) });
          await report.getByText('Faturamento', { exact: true }).first().waitFor();
          await page.locator('.recharts-surface').first().waitFor();
          results[`${version}:${width}`] = {};
          for (const period of ['Hoje', 'Semanal', 'Mensal', 'Anual', 'Personalizado']) {
            await report.getByRole('button', { name: period, exact: true }).click();
            if (period === 'Personalizado') {
              await page.getByLabel('Data inicial').fill('2026-11-01');
              await page.getByLabel('Data final').fill('2026-11-03');
            }
            await page.mouse.move(0, 0);
            await page.waitForFunction(() => !document.querySelector('.page-shell:last-child')?.textContent.includes('Carregando gráficos'));
            results[`${version}:${width}`][period] = (await report.innerText()).replace(/\s+/g, ' ').trim();
          }
          if (version === 'refactored') {
            assert.deepEqual(results[`${version}:${width}`], results[`baseline:${width}`]);
            await page.screenshot({ path: `artifacts/refactor/browser/reports-${width}.png` });
          }
          assert.deepEqual(errors, []);
        } finally { await context.close(); }
      }
    } finally { await server.close(); }
  }
  await writeFile('artifacts/refactor/browser/comparison.json', JSON.stringify(results, null, 2));
  console.log('Report UI matches checkpoint for five periods at desktop/mobile widths; no browser errors. Isolated demo data only.');
} finally { await browser.close(); }
