import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
process.env.VITE_MOCK_API = "true";
const server = await createServer({
  mode: "development",
  server: { host: "127.0.0.1", port: 0, open: false },
});
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1366, height: 900 },
  });
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill("demo@nexopdv.local");
  await page.locator('input[type="password"]').fill("demo123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/pdv");
  await page.locator(".pdv-product-card").first().waitFor();
  const product = await page.evaluate(async () => {
    if (!localStorage.getItem("nexo:mock-db:v4"))
      throw new Error("Missing isolated mock dataset");
    const { nexoApi } = await import("/src/api/nexoApi.js");
    return (await nexoApi.products.catalog())[0];
  });
  await page.goto(`${base}estoque`, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: `Excluir ${product.name}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Enviar à lixeira", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lixeira / recuperar produtos", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Lixeira de produtos" });
  await dialog
    .getByRole("heading", { name: product.name, exact: true })
    .waitFor();
  await dialog.getByRole("button", { name: "Restaurar", exact: true }).click();
  await dialog.getByRole("status").filter({ hasText: "restaurado" }).waitFor();
  const restored = await page.evaluate(async (id) => {
    const { nexoApi } = await import("/src/api/nexoApi.js");
    return nexoApi.entities.Product.get(id);
  }, product.id);
  assert.deepEqual(restored, product);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await dialog.evaluate(
      (element) => element.getBoundingClientRect().width <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Product trash browser passed: actual delete confirmation, recoverable snapshot, UI restore and complete original product payload. Local demo data only.",
  );
} finally {
  await browser?.close();
  await server.close();
}
