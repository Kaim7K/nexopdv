import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const output = 'artifacts/diagnostics/navigation';
const outDir = `${output}/build`;
await mkdir(output, { recursive: true });
await build({ logLevel: 'error', define: { 'import.meta.env.VITE_MOCK_API': '"true"' }, build: { outDir }, plugins: [{ name: 'profile-api', transform(code, id) {
  if (!id.replaceAll('\\', '/').endsWith('/src/api/nexoApi.js')) return;
  return code + `
    globalThis.__apiEvents = []; globalThis.__apiActive = 0;
    function instrumentApi(object, prefix) {
      for (const key of Object.keys(object)) {
        if (key === 'cache') continue;
        const value = object[key], name = prefix + '.' + key;
        if (typeof value === 'function') object[key] = async (...args) => {
          const event = { name, start: performance.now() }; globalThis.__apiEvents.push(event); globalThis.__apiActive++;
          try { return await value(...args); } finally { event.duration = performance.now() - event.start; globalThis.__apiActive--; }
        };
        else if (value && typeof value === 'object') instrumentApi(value, name);
      }
    }
    instrumentApi(nexoApi, 'api');`;
} }] });
await copyFile(`${outDir}/index.html`, `${outDir}/app.html`);
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5181, open: false } });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const variant of [
    { name: 'desktop', width: 1366, cpu: 1, latency: 0 },
    { name: 'mobile-simulated', width: 390, cpu: 4, latency: 80 },
    { name: 'mobile-without-effects', width: 390, cpu: 4, latency: 80, flat: true },
  ]) {
    const context = await browser.newContext({ viewport: { width: variant.width, height: 900 } });
    try {
      await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      await context.addInitScript(() => {
        globalThis.__longTasks = [];
        new PerformanceObserver(list => globalThis.__longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: 'longtask', buffered: true });
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style'); style.textContent = 'details:has(> summary .lucide-flask-conical){display:none!important}'; document.head.append(style);
        });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const session = await context.newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: variant.cpu });
      await session.send('Network.enable');
      if (variant.latency) await session.send('Network.emulateNetworkConditions', { offline: false, latency: variant.latency, downloadThroughput: 200000, uploadThroughput: 100000 });
      const base = server.resolvedUrls.local[0];
      await page.goto(`${base}login`, { waitUntil: 'domcontentloaded' });
      await page.locator('input[type=email]').fill('demo@nexopdv.local');
      await page.locator('input[type=password]').fill('demo123');
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/inicio', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Seu dia em números' }).waitFor();
      if (variant.flat) await page.addStyleTag({ content: '.app-premium *, .app-premium *::before, .app-premium *::after{backdrop-filter:none!important;box-shadow:none!important;transition:none!important;animation:none!important}' });
      for (const pass of ['first-visit', 'revisit']) {
        for (const [path, label, heading] of [
          ['/pdv', 'PDV', null], ['/estoque', 'Estoque', 'Estoque'], ['/vendas', 'Vendas', 'Vendas'],
          ['/relatorios', 'Relatórios', 'Relatórios'], ['/financeiro', 'Financeiro', 'Financeiro'], ['/inicio', 'Visão geral', 'Visão geral'],
        ]) {
          if (variant.width < 768) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
          const link = page.locator('.app-sidebar-nav').getByRole('link', { name: label, exact: true });
          await link.evaluate(element => element.addEventListener('click', () => { globalThis.__navigationClickStart = performance.now(); }, { once: true, capture: true }));
          const interactionStart = await page.evaluate(() => performance.now());
          await link.click();
          const start = await page.evaluate(() => globalThis.__navigationClickStart);
          await page.waitForURL(`**${path}`);
          const routeChangedMs = await page.evaluate(start => performance.now() - start, start);
          if (heading) await page.locator('main h1').filter({ hasText: heading }).first().waitFor({ state: 'attached' });
          else await page.locator('.pdv-product-card').first().waitFor();
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await page.waitForFunction(() => globalThis.__apiActive === 0);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const ready = await page.evaluate(() => performance.now());
          if (['/relatorios', '/financeiro'].includes(path)) await page.waitForTimeout(1700);
          const row = await page.evaluate(({ start, ready }) => {
            const tasks = globalThis.__longTasks.filter(task => task.start >= start);
            const resources = performance.getEntriesByType('resource').filter(entry => entry.startTime >= start && /\.js(?:\?|$)/.test(entry.name));
            const filters = [...document.querySelectorAll('main *')].filter(element => getComputedStyle(element).backdropFilter !== 'none').length;
            return { readyMs: ready - start, api: globalThis.__apiEvents.filter(event => event.start >= start), longTaskCount: tasks.length, longTaskMs: tasks.reduce((sum, task) => sum + task.duration, 0), maxLongTaskMs: Math.max(0, ...tasks.map(task => task.duration)), scriptBytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, 0), scripts: resources.map(entry => ({ file: entry.name.split('/').pop(), bytes: entry.encodedBodySize, duration: entry.duration })), elements: document.querySelectorAll('main *').length, backdropElements: filters };
          }, { start, ready });
          results.push({ variant: variant.name, pass, path, routeChangedMs, automationDispatchMs: start - interactionStart, ...row });
          console.log(JSON.stringify({ variant: variant.name, pass, path, readyMs: Math.round(row.readyMs), longTaskMs: row.longTaskMs, scriptBytes: row.scriptBytes, apiCalls: row.api.length }));
        }
      }
      if (errors.length) throw new Error(errors.join('\n'));
    } finally { await context.close(); }
  }
  await writeFile(`${output}/profile.json`, JSON.stringify({ note: 'Compiled mock app, synthetic demo data, API adds 80ms artificial latency. Mobile CPU x4 and network 80ms/200KBps. No production backend measured.', results }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
