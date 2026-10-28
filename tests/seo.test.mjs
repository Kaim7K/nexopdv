import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { preview } from "vite";
import { chromium } from "playwright";
import { PLAN_CATALOG } from "../src/lib/plan-catalog.js";

// Run after `npm run build`. Uses only local static output and a simulated 401;
// never signs in, calls the production API or reads user data.
const origin = "https://nexopdvnovo.vercel.app";
const config = JSON.parse(await readFile("vercel.json", "utf8"));
assert.ok(!config.rewrites.some((rule) => rule.source === "/sitemap.xml"));
assert.equal(
  config.rewrites.find((rule) => rule.source === "/").destination,
  "/index.html",
);
assert.equal(config.rewrites.at(-1).destination, "/app.html");
const noindex = config.headers.find((rule) =>
  rule.headers.some((h) => h.key === "X-Robots-Tag"),
);
const privateHeaderPattern = new RegExp(
  `^/${noindex.source.slice("/:path(".length, -1)}$`,
);
for (const route of ["/", "/sitemap.xml", "/landing/pdv-preview.png"])
  assert.ok(!privateHeaderPattern.test(route));

const server = await preview({
  preview: { host: "127.0.0.1", port: 0, open: false },
});
let browser;
try {
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type"), /xml/);
  const xml = await sitemap.text();
  const robotsResponse = await fetch(`${base}/robots.txt`);
  assert.equal(robotsResponse.status, 200);
  const robots = await robotsResponse.text();
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  const navigation = await readFile("src/config/navigation.jsx", "utf8");
  const routes = [
    ...navigation
      .split("export const PRIVATE_ROUTES = [")[1]
      .split("];")[0]
      .matchAll(/path: '([^']+)'/g),
  ].map((m) => m[1].replace("/:id", "/seo-test"));
  for (const route of ["/login", ...routes]) {
    assert.ok(
      privateHeaderPattern.test(route),
      `Missing production noindex header: ${route}`,
    );
    assert.ok(
      robots
        .split("\n")
        .some(
          (line) =>
            line.startsWith("Disallow: ") &&
            route.startsWith(line.slice(10).trim()),
        ),
      route,
    );
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('<div id="root"></div>'), route);
    assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
    assert.ok(
      !html.includes('rel="canonical"') &&
        !html.includes("application/ld+json"),
    );
  }

  browser = await chromium.launch({ headless: true });
  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  const response = await staticPage.goto(base);
  assert.equal(response.status(), 200);
  const headings = await staticPage.locator("h1, h2, h3").allTextContents();
  assert.equal(await staticPage.locator("h1").count(), 1);
  assert.ok(
    headings.length > 10,
    "Main sections must exist without JavaScript",
  );
  assert.equal(
    await staticPage.locator('link[rel="canonical"]').getAttribute("href"),
    `${origin}/`,
  );
  assert.equal(
    await staticPage.locator('meta[name="google-site-verification"]').count(),
    1,
  );
  assert.equal(
    await staticPage
      .locator('meta[name="google-site-verification"]')
      .getAttribute("content"),
    "ov3a2nBFR-CIYXIy6Pgxt-D0LNs9iR-uDVcTG7BeB4g",
  );
  assert.match(await staticPage.title(), /Nexo PDV.*mercadinhos/);
  assert.ok(
    (
      await staticPage
        .locator('meta[name="description"]')
        .getAttribute("content")
    ).length > 80,
  );
  for (const selector of [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ]) {
    assert.equal(
      await staticPage.locator(selector).getAttribute("content"),
      `${origin}/nexo-pdv-og.png`,
    );
  }
  const data = JSON.parse(
    await staticPage.locator("#nexo-structured-data").textContent(),
  );
  assert.deepEqual(
    data.map((item) => item["@type"]),
    ["Organization", "SoftwareApplication", "FAQPage"],
  );
  assert.equal(data[0].url, `${origin}/`);
  // DOMParser validates the actual HTTP XML, rather than checking a text pattern.
  const xmlResult = await staticPage.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    return {
      errors: doc.querySelectorAll("parsererror").length,
      namespace: doc.documentElement.namespaceURI,
      urls: [...doc.querySelectorAll("loc")].map((node) => node.textContent),
    };
  }, xml);
  assert.deepEqual(xmlResult, {
    errors: 0,
    namespace: "http://www.sitemaps.org/schemas/sitemap/0.9",
    urls: [`${origin}/`],
  });
  await staticPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(await staticPage.locator("h1").isVisible(), true);
  await staticPage.screenshot({ path: "artifacts/seo-mobile-without-js.png" });

  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      }),
    }),
  );
  await page.goto(base);
  await page.waitForFunction(
    () =>
      document.querySelector(".lp-root") &&
      document.querySelector("#nexo-structured-data"),
  );
  assert.deepEqual(
    await page.locator("h1, h2, h3").allTextContents(),
    headings,
    "React must preserve the public content",
  );
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    `${origin}/`,
  );
  assert.equal(await page.locator("#nexo-structured-data").count(), 1);
  await page.screenshot({ path: "artifacts/seo-desktop.png" });
  assert.deepEqual(await page.locator(".lp-price strong").allTextContents(), [
    "Sob consulta",
    "Sob consulta",
    "Sob consulta",
  ]);
  const anchors = await page
    .locator('a[href^="#"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href").slice(1)),
    );
  for (const id of anchors)
    assert.equal(await page.locator(`[id="${id}"]`).count(), 1);
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page
        .locator(".lp-root")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      `Horizontal overflow at ${width}`,
    );
  }
  await page.locator("#planos").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/launch-plans-desktop.png" });
  await page.locator(".lp-phone img").scrollIntoViewIfNeeded();
  await page.locator("img").evaluateAll((elements) =>
    elements.forEach((element) => {
      element.loading = "eager";
    }),
  );
  await page.waitForFunction(() =>
    [...document.images].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
  await page.getByRole("button", { name: /Registre o pagamento/ }).click();
  assert.ok(
    (await page.locator("#demonstracao img").getAttribute("src")).endsWith(
      "/payment.png",
    ),
  );

  // Only validated active offers may replace safe contact pricing.
  await page.route("**/api/public/plans", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plans: PLAN_CATALOG.map(({ key, name, monthly_price, user_limit }) => ({
          key,
          name,
          monthly_price,
          user_limit,
        })),
      }),
    }),
  );
  await page.reload();
  await page.waitForFunction(() =>
    document.querySelector(".lp-price strong")?.textContent.includes("29,90"),
  );
  assert.ok(
    (await page.locator(".lp-plan-featured .lp-price").textContent()).includes(
      "59,90",
    ),
  );
  await page.evaluate(() => {
    window.__marketingEvents = [];
    window.addEventListener("nexo:marketing", (event) =>
      window.__marketingEvents.push(event.detail),
    );
    document.addEventListener("click", (event) => {
      if (event.target.closest('a[href^="https://wa.me/"]'))
        event.preventDefault();
    });
  });
  const planLink = page.locator(".lp-plan-featured .lp-button");
  assert.ok(
    (await planLink.getAttribute("href")).startsWith(
      "https://wa.me/5571984793504?text=",
    ),
  );
  await planLink.click();
  const events = await page.evaluate(() => window.__marketingEvents);
  assert.deepEqual(events, [
    { action: "select_plan", placement: "plans", plan: "Profissional" },
    { action: "whatsapp", placement: "plans", plan: "Profissional" },
  ]);
  const faq = page.locator("details").first();
  await faq.locator("summary").click();
  assert.equal(await faq.getAttribute("open"), "");
  await page.locator('a[href="/login"]').first().click();
  await page.waitForURL("**/login");
  await page.locator('input[type="password"]').waitFor();
  assert.match(
    await page.locator('meta[name="robots"]').getAttribute("content"),
    /noindex/,
  );
  assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
  assert.equal(await page.locator("#nexo-structured-data").count(), 0);
  for (const route of routes) {
    await page.goto(`${base}${route}`);
    await page.waitForURL("**/login");
    await page.locator('input[type="password"]').waitFor();
  }
  assert.deepEqual(errors, []);
  const image = await fetch(`${base}/nexo-pdv-og.png`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /image\/png/);
  console.log(
    "SEO passed: HTTP 200 XML, robots, initial HTML, metadata, React, FAQ, login and all unauthenticated private redirects.",
  );
} finally {
  await browser?.close();
  server.httpServer.closeAllConnections();
  await server.close();
}
