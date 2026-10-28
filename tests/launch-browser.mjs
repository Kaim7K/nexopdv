import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PLAN_CATALOG } from "../src/lib/plan-catalog.js";
import { mkdir } from "node:fs/promises";

// A VITE_MOCK_API=true dev server must be running on this local port.
const base = "http://127.0.0.1:5177";
const browser = await chromium.launch({ headless: true });
await mkdir("artifacts/launch", { recursive: true });
try {
  for (const plan of PLAN_CATALOG) {
    for (const width of [1366, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/login`);
      await page.locator('input[type="email"]').fill("demo@nexopdv.local");
      await page.locator('input[type="password"]').fill("demo123");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL("**/pdv");
      await page.locator(".pdv-product-card").first().waitFor();
      await page.evaluate((model) => {
        const db = JSON.parse(
          localStorage.getItem("nexo:mock-db:v4") || "null",
        );
        if (!db) throw new Error("Mock data missing: refusing live operations");
        const cached = JSON.parse(localStorage.getItem("nexo:session-user"));
        Object.assign(cached.user, {
          enabled_modules: model.enabled_modules,
          enabled_features: model.enabled_features,
        });
        db.users = db.users.map((user) =>
          user.id === cached.user.id ? { ...user, ...cached.user } : user,
        );
        localStorage.setItem("nexo:session-user", JSON.stringify(cached));
        localStorage.setItem("nexo:mock-db:v4", JSON.stringify(db));
      }, plan);
      await page.reload();
      await page.locator(".pdv-product-card").first().waitFor();
      await page.addStyleTag({
        content:
          "details:has(> summary .lucide-flask-conical){display:none!important}",
      });
      assert.equal(
        await page
          .getByRole("button", { name: /Abrir caixa|Caixa aberto/ })
          .count(),
        plan.key === "completo" ? 1 : 0,
      );
      await page.locator(".pdv-product-card").first().click();
      assert.equal(
        await page
          .getByRole("button", { name: /Minimizar/ })
          .first()
          .isDisabled(),
        plan.key === "essencial",
      );
      await page.screenshot({
        path: `artifacts/launch/${plan.key}-${width}-pdv.png`,
      });
      await page.getByRole("button", { name: /^Pagamento/ }).click();
      await page.getByRole("dialog").waitFor();
      assert.equal(
        await page.getByRole("button", { name: /^Fiado/ }).count(),
        plan.key === "essencial" ? 0 : 1,
      );
      await page.getByRole("button", { name: /^Dinheiro/ }).click();
      await page
        .getByRole("button", { name: "Concluir venda", exact: true })
        .click();
      await page.getByRole("dialog", { name: "Recibo da venda" }).waitFor();
      await page.goto(`${base}/relatorios`);
      await page
        .getByRole("heading", { name: "Relatórios", exact: true })
        .first()
        .waitFor();
      if (plan.key === "essencial") {
        await page.getByText("Ticket médio", { exact: true }).waitFor();
        await page.goto(`${base}/financeiro`);
        await page
          .locator('input[name="description"]')
          .fill("Despesa de demonstração");
        await page.locator('select[name="type"]').selectOption("expense");
        await page.locator('input[name="amount"]').fill("12.50");
        await page
          .getByRole("button", { name: "Registrar", exact: true })
          .click();
        await page
          .locator("li")
          .filter({ hasText: "Despesa de demonstração" })
          .waitFor();
        assert.equal(await page.getByRole("alert").count(), 0);
      } else {
        await page.goto(`${base}/financeiro`);
        await page.getByRole('heading', { name: 'Financeiro', exact: true }).waitFor();
        for (const section of ['results', 'reconciliation', 'goals', 'purchases']) {
          assert.equal(await page.locator(`#finance-section option[value="${section}"]`).count(), plan.key === 'completo' ? 1 : 0);
        }
      }
      assert.deepEqual(
        errors,
        [],
        `${plan.key} ${width}: unexpected runtime errors`,
      );
      await context.close();
    }
  }
  console.log(
    "Browser passed: completed sales and receipts on all three plans at desktop/mobile sizes, restricted controls and basic financial entry. Uses isolated demo data only.",
  );
} finally {
  await browser.close();
}
