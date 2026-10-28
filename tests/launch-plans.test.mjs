import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAN_CATALOG,
  planTemplate,
  hasPlanFeature,
  catalogConfigurationError,
  canUseFinanceSection,
} from "../src/lib/plan-catalog.js";
import { moduleAccessError } from "../server/module-access.js";
import { planAccessError } from "../server/plan-access.js";
import { publicPlanOffers } from "../server/public-plans.js";
import { handleSalesRequest } from "../server/sales/routes.js";

const user = (key) => ({
  ...planTemplate(key),
  role: "admin",
  id: "operator",
  market_id: "market",
});
test("three launch models have the exact prices, limits and core selling modules", () => {
  assert.deepEqual(
    PLAN_CATALOG.map((plan) => [plan.monthly_price, plan.user_limit]),
    [
      [29.9, 1],
      [59.9, 5],
      [99.9, 15],
    ],
  );
  for (const plan of PLAN_CATALOG) {
    const template = planTemplate(plan.key);
    assert.equal(catalogConfigurationError(template), "");
    for (const module of [
      "pdv",
      "estoque",
      "vendas",
      "relatorios",
      "financeiro",
      "configuracoes",
    ])
      assert.ok(template.enabled_modules.includes(module));
    assert.equal(
      moduleAccessError(user(plan.key), ["sales", "complete"], "POST"),
      null,
    );
    assert.equal(
      planAccessError(user(plan.key), ["sales", "complete"], "POST", {
        payments: [{ method: "dinheiro" }],
      }),
      null,
    );
    assert.equal(template.trial_days, 0, "No unimplemented trial offer");
  }
});
test("essencial keeps basic operations but denies fiado and advanced endpoints, including direct requests", () => {
  const essential = user("essencial");
  for (const feature of [
    "simultaneous_sales",
    "advanced_stock",
    "advanced_finance",
    "advanced_reports",
    "cash_management",
  ])
    assert.equal(hasPlanFeature(essential, feature), false);
  for (const path of [
    ["cash", "open"],
    ["cash", "close"],
    ["finance", "ledger"],
    ["finance", "suppliers"],
    ["finance", "purchases"],
    ["finance", "goals"],
    ["entities", "FiadoRecord"],
  ])
    assert.ok(planAccessError(essential, path, "POST"));
  assert.ok(moduleAccessError(essential, ["entities", "FiadoRecord"], "GET"));
  assert.ok(
    planAccessError(essential, ["sales", "complete"], "POST", {
      payments: [{ method: "fiado" }],
    }),
  );
  assert.equal(
    planAccessError(essential, ["stock", "import"], "POST", {
      operation: "import",
    }),
    null,
  );
  assert.ok(
    planAccessError(essential, ["stock", "import"], "POST", {
      operation: "batch",
    }),
  );
  for (const type of ["revenue", "expense"])
    assert.equal(
      planAccessError(essential, ["finance", "transactions"], "POST", {
        type,
        status: "paid",
        amount: 10,
      }),
      null,
    );
  for (const body of [
    { type: "transfer", status: "paid" },
    { type: "expense", status: "pending" },
    { type: "expense", status: "paid", installments: 2 },
  ])
    assert.ok(
      planAccessError(essential, ["finance", "transactions"], "POST", body),
    );
});
test("professional has simultaneous sales, advanced analysis and finance; complete alone has operational cash and DRE", () => {
  for (const key of ["profissional", "completo"]) {
    for (const feature of [
      "simultaneous_sales",
      "advanced_stock",
      "advanced_reports",
      "advanced_finance",
    ])
      assert.equal(hasPlanFeature(user(key), feature), true);
    assert.equal(
      moduleAccessError(user(key), ["entities", "FiadoRecord"], "GET"),
      null,
    );
  }
  for (const key of ["essencial", "profissional", "completo"]) {
    assert.equal(
      hasPlanFeature(user(key), "cash_management"),
      key === "completo",
    );
    assert.equal(
      canUseFinanceSection(user(key), "results"),
      key === "completo",
    );
    assert.equal(
      canUseFinanceSection(user(key), "reconciliation"),
      key === "completo",
    );
  }
  assert.equal(
    planAccessError(user("completo"), ["cash", "open"], "POST"),
    null,
  );
});
test("configured models cannot silently change public prices or entitlements", () => {
  for (const modification of [
    { user_limit: 100 },
    { monthly_price: 1 },
    { enabled_modules: ["pdv"] },
    {
      enabled_features: [
        ...planTemplate("essencial").enabled_features,
        "cash_management",
      ],
    },
  ])
    assert.ok(
      catalogConfigurationError({
        ...planTemplate("essencial"),
        ...modification,
      }),
    );
  const rows = PLAN_CATALOG.map((plan) => ({
    ...planTemplate(plan.key),
    internal_note: "private",
    customer: "private",
  }));
  const offers = publicPlanOffers([
    ...rows,
    { ...rows[0], active: false },
    { ...rows[1], monthly_price: 1 },
  ]);
  assert.equal(offers.length, 3);
  assert.deepEqual(Object.keys(offers[0]).sort(), [
    "key",
    "monthly_price",
    "name",
    "user_limit",
  ]);
  assert.deepEqual(
    publicPlanOffers([
      { ...rows[0], active: false },
      { ...rows[1], monthly_price: 1 },
    ]),
    [],
  );
});
test("legacy custom contracts retain their configured access; no implicit migration", () => {
  const legacy = {
    role: "admin",
    enabled_modules: ["pdv", "estoque"],
    enabled_features: [],
  };
  assert.equal(hasPlanFeature(legacy, "simultaneous_sales"), true);
  assert.equal(planAccessError(legacy, ["cash", "open"], "POST"), null);
  assert.ok(moduleAccessError(legacy, ["finance", "dashboard"], "GET"));
  assert.deepEqual(
    publicPlanOffers([
      {
        name: "Contrato antigo",
        monthly_price: 79,
        user_limit: 1,
        enabled_modules: ["pdv"],
        enabled_features: [],
        active: true,
      },
    ]),
    [],
  );
});
test("seller without a cash session reaches sale validation on essencial and profissional, despite a stale cash-required setting", async () => {
  for (const key of ["essencial", "profissional"]) {
    const result = {
      statusCode: 0,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.payload = data;
        return this;
      },
      setHeader() {},
      getHeader() {},
    };
    await handleSalesRequest(
      {
        req: { method: "POST", query: {}, body: { items: [], payments: [] } },
        res: result,
        sql: () => {
          throw new Error("Unexpected database call");
        },
        user: { ...user(key), role: "vendedor", require_cash_register: true },
        path: ["sales", "complete"],
      },
      { findOpenCashSession: async () => null },
    );
    assert.equal(result.statusCode, 400);
    assert.notEqual(result.payload?.code, "CASH_REGISTER_REQUIRED");
    assert.match(result.payload?.message, /itens/);
  }
});
