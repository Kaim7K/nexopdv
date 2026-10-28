import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

// Run against VITE_MOCK_API=true dev server only: actual React screens with
// disposable demonstration data. Never connects to or mutates a live market.
const base = "http://127.0.0.1:5177";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${base}/login`);
  await page.locator('input[type="email"]').fill("demo@nexopdv.local");
  await page.locator('input[type="password"]').fill("demo123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/pdv");
  await page.locator(".pdv-product-card").first().waitFor();
  const mock = await page.evaluate(() =>
    localStorage.getItem("nexo:mock-db:v4"),
  );
  if (!mock)
    throw new Error(
      "Mock dataset missing: refusing to capture or operate a live system.",
    );
  await mkdir("public/landing/product", { recursive: true });
  // Hide the development-only role switcher from marketing captures.
  const shot = async (name) => {
    await page.addStyleTag({
      content:
        "details:has(> summary .lucide-flask-conical){display:none!important}",
    });
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `public/landing/product/${name}.png`,
      animations: "disabled",
    });
  };
  await shot("catalog");
  for (let index = 0; index < 3; index++)
    await page.locator(".pdv-product-card").nth(index).click();
  await shot("sale");
  await page
    .getByRole("button", { name: /Minimizar/ })
    .first()
    .click();
  await page.locator(".pdv-product-card").nth(3).click();
  await shot("simultaneous");
  await page.getByRole("button", { name: /^Pagamento/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: /^Dinheiro/ }).click();
  await shot("payment");
  await page
    .getByRole("button", { name: "Concluir venda", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Recibo da venda" }).waitFor();
  await shot("receipt");
  for (const [path, name] of [
    ["/estoque", "stock"],
    ["/caixas", "cash"],
    ["/relatorios", "reports"],
  ]) {
    await page.goto(`${base}${path}`);
    await page.waitForTimeout(800);
    await shot(name);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/pdv`);
  await page.locator(".pdv-product-card").first().waitFor();
  await page.locator(".pdv-product-card").nth(1).click();
  await shot("mobile-sale");
  await page.getByRole("button", { name: /^Pagamento/ }).click();
  await page.getByRole("dialog").waitFor();
  await shot("mobile-payment");
  console.log(
    "Captured actual application flow with local demo data, including a completed sale and mobile payment.",
  );
} finally {
  await browser.close();
}
