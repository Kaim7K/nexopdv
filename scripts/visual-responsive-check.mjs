import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.VISUAL_BASE_URL || 'http://127.0.0.1:5173';
const cdpUrl = process.env.VISUAL_CDP_URL || '';
const email = process.env.VISUAL_EMAIL || '';
const password = process.env.VISUAL_PASSWORD || '';
const outDir = process.env.VISUAL_OUT_DIR || 'artifacts/responsive-screenshots';
const routes = (process.env.VISUAL_ROUTES || [
  '/',
  '/login',
  '/pdv',
  '/estoque',
  '/vendas',
  '/caixas',
  '/fiados',
  '/relatorios',
  '/financeiro',
  '/usuarios',
  '/configuracoes',
].join(','))
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);

const viewports = [
  ['mobile-360', 360, 780],
  ['mobile-390', 390, 844],
  ['mobile-430', 430, 932],
  ['tablet-768', 768, 1024],
  ['notebook-1024', 1024, 768],
  ['laptop-1366', 1366, 900],
  ['desktop-1440', 1440, 1000],
  ['ultrawide-1920', 1920, 1080],
];

function cleanName(value) {
  return value === '/' ? 'landing' : value.replace(/^\/+/, '').replace(/[^\w-]+/g, '-');
}

async function waitForPage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(350);
}

async function login(page) {
  if (!email || !password) return false;
  await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 }).catch(() => {}),
    page.locator('button[type="submit"]').click(),
  ]);
  await waitForPage(page);
  return !page.url().includes('/login');
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    const viewportWidth = window.innerWidth;
    const bodyWidth = Math.max(
      document.body?.scrollWidth || 0,
      document.documentElement?.scrollWidth || 0,
    );
    const overflowing = [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const styles = window.getComputedStyle(element);
        if (styles.position === 'fixed' && rect.left < 0) return null;
        if (rect.right <= viewportWidth + 1 && rect.left >= -1) return null;
        const text = (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.className || '').slice(0, 120),
          text,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(Boolean)
      .slice(0, 8);
    const oversized = [...document.querySelectorAll('main, section, article, form, aside, header, [role="dialog"], button, input, select, textarea')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const styles = window.getComputedStyle(element);
        const tag = element.tagName.toLowerCase();
        const isControl = ['button', 'input', 'select', 'textarea'].includes(tag);
        const tooTall =
          (isControl && rect.height > Math.max(64, window.innerHeight * 0.11)) ||
          (!isControl && rect.height > window.innerHeight * 0.72 && rect.top >= -4 && rect.top < window.innerHeight * 0.65);
        const tooWide = rect.width > window.innerWidth * 0.98 && styles.position !== 'fixed';
        if (!tooTall && !tooWide) return null;
        return {
          tag,
          className: String(element.className || '').slice(0, 120),
          text: (element.textContent || element.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
        };
      })
      .filter(Boolean)
      .slice(0, 10);

    return {
      title: document.title,
      url: location.pathname,
      viewportWidth,
      bodyWidth,
      horizontalOverflow: bodyWidth > viewportWidth + 2,
      scrollHeight: Math.round(root.scrollHeight),
      overflowing,
      oversized,
      appCrashed: Boolean(document.body?.textContent?.includes('A tela encontrou um problema')),
    };
  });
}

await fs.mkdir(outDir, { recursive: true });

const browser = cdpUrl
  ? await chromium.connectOverCDP(cdpUrl)
  : await chromium.launch({
      headless: true,
      channel: process.env.VISUAL_BROWSER_CHANNEL || 'chrome',
    });

const context = cdpUrl
  ? browser.contexts()[0]
  : await browser.newContext({ deviceScaleFactor: 1 });
const page = context.pages()[0] || await context.newPage();
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

const loggedIn = await login(page);
const results = [];

for (const [label, width, height] of viewports) {
  await page.setViewportSize({ width, height });
  for (const route of routes) {
    const url = new URL(route, baseUrl).toString();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await waitForPage(page);
    const fileName = `${label}__${cleanName(route)}.png`;
    const screenshotPath = path.join(outDir, fileName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.push({
      route,
      viewport: `${width}x${height}`,
      screenshot: screenshotPath,
      ...(await inspectPage(page)),
    });
  }
}

if (cdpUrl) await browser.close();
else await browser.close();

const report = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  loggedIn,
  routes,
  viewports: viewports.map(([label, width, height]) => ({ label, width, height })),
  consoleErrors: [...new Set(consoleErrors)].slice(0, 50),
  results,
};

const reportPath = path.join(outDir, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

const issues = results.filter((item) => item.horizontalOverflow || item.appCrashed || item.oversized.length);
console.log(`Screenshots salvos em: ${outDir}`);
console.log(`Relatório salvo em: ${reportPath}`);
console.log(`Login realizado: ${loggedIn ? 'sim' : 'não'}`);
console.log(`Páginas com possível problema: ${issues.length}`);
for (const issue of issues.slice(0, 20)) {
  console.log(`- ${issue.viewport} ${issue.route}: overflow=${issue.horizontalOverflow}, crash=${issue.appCrashed}, grandes=${issue.oversized.length}`);
}
if (consoleErrors.length) {
  console.log(`Erros de console capturados: ${new Set(consoleErrors).size}`);
}
