import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const apiOrigin = process.env.VISUAL_API_ORIGIN || 'https://nexopdvnovo.vercel.app';
const cdpUrl = process.env.VISUAL_CDP_URL || 'http://127.0.0.1:9222';
const outDir = process.env.VISUAL_OUT_DIR || 'artifacts/responsive-local-authenticated';
const port = Number(process.env.VISUAL_LOCAL_PORT || 4174);
const routes = [
  '/pdv',
  '/estoque',
  '/vendas',
  '/caixas',
  '/fiados',
  '/relatorios',
  '/financeiro',
  '/usuarios',
  '/configuracoes',
];
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
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function routeName(route) {
  return route.replace(/^\/+/, '').replace(/[^\w-]+/g, '-') || 'landing';
}

function cookieHeader(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function requestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function startServer(authCookies) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      if (requestUrl.pathname.startsWith('/api/')) {
        const headers = { ...req.headers };
        delete headers.host;
        headers.cookie = authCookies;
        headers.origin = apiOrigin;
        headers.referer = `${apiOrigin}/`;
        const body = ['GET', 'HEAD'].includes(req.method || 'GET')
          ? undefined
          : await requestBody(req);
        const upstream = await fetch(`${apiOrigin}${requestUrl.pathname}${requestUrl.search}`, {
          method: req.method,
          headers,
          body,
          redirect: 'manual',
        });
        res.statusCode = upstream.status;
        upstream.headers.forEach((value, key) => {
          if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
          }
        });
        res.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }

      const requestedPath = path.normalize(decodeURIComponent(requestUrl.pathname)).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(distDir, requestedPath);
      if (requestUrl.pathname === '/' || requestUrl.pathname.endsWith('/')) filePath = path.join(distDir, 'index.html');
      try {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) filePath = path.join(distDir, 'index.html');
      } catch {
        filePath = path.join(distDir, 'index.html');
      }
      const ext = path.extname(filePath);
      res.setHeader('content-type', contentTypes[ext] || 'application/octet-stream');
      res.end(await fs.readFile(filePath));
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error?.message || error));
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function waitForPage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(350);
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const bodyWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
    const root = document.scrollingElement || document.documentElement;
    const overflowing = [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        if (rect.right <= viewportWidth + 1 && rect.left >= -1) return null;
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
          width: Math.round(rect.width),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter(Boolean)
      .slice(0, 10);
    return {
      path: location.pathname,
      title: document.title,
      horizontalOverflow: bodyWidth > viewportWidth + 2,
      appCrashed: document.body.textContent.includes('A tela encontrou um problema'),
      scrollHeight: Math.round(root.scrollHeight),
      overflowing,
    };
  });
}

await fs.mkdir(outDir, { recursive: true });

const remoteBrowser = await chromium.connectOverCDP(cdpUrl);
const remoteContext = remoteBrowser.contexts()[0];
const cookies = await remoteContext.cookies(apiOrigin);
const authCookies = cookieHeader(cookies);
await remoteBrowser.close();

if (!authCookies) throw new Error('Nenhum cookie da sessão logada foi encontrado no Chrome aberto.');

const server = await startServer(authCookies);
const browser = await chromium.launch({ headless: true, channel: process.env.VISUAL_BROWSER_CHANNEL || 'chrome' });
const context = await browser.newContext({ deviceScaleFactor: 1 });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

const results = [];
for (const [label, width, height] of viewports) {
  await page.setViewportSize({ width, height });
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'domcontentloaded' });
    await waitForPage(page);
    const screenshot = path.join(outDir, `${label}__${routeName(route)}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ route, viewport: `${width}x${height}`, screenshot, ...(await inspectPage(page)) });
  }
}

await browser.close();
server.close();

const report = {
  apiOrigin,
  localUrl: `http://127.0.0.1:${port}`,
  generatedAt: new Date().toISOString(),
  consoleErrors: [...new Set(consoleErrors)].slice(0, 50),
  results,
};
await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

const issues = results.filter((item) => item.horizontalOverflow || item.appCrashed);
console.log(`Screenshots salvos em: ${outDir}`);
console.log(`Rotas com crash/overflow: ${issues.length}`);
for (const issue of issues.slice(0, 30)) {
  console.log(`- ${issue.viewport} ${issue.route}: overflow=${issue.horizontalOverflow}, crash=${issue.appCrashed}`);
}
if (consoleErrors.length) console.log(`Erros de console: ${new Set(consoleErrors).size}`);
