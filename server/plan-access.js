import {
  canUseFinanceSection,
  catalogPlan,
  hasPlanFeature,
} from "../src/lib/plan-catalog.js";

export function planAccessError(user, path, method, body = {}) {
  const plan = catalogPlan(user);
  if (!plan || user.role === "super_admin") return null;
  const unavailable = "Este recurso não está incluído no seu plano.";
  if (
    path[0] === "cash" &&
    path[1] !== "current" &&
    !hasPlanFeature(user, "cash_management")
  )
    return unavailable;
  if (
    path[0] === "stock" &&
    path[1] === "import" &&
    body.operation === "batch" &&
    !hasPlanFeature(user, "advanced_stock")
  )
    return unavailable;
  if (
    path[0] === "products" &&
    path[1] === "delete-inactive" &&
    !hasPlanFeature(user, "advanced_stock")
  )
    return unavailable;
  if (
    path[0] === "sales" &&
    path[1] === "product-history" &&
    !hasPlanFeature(user, "advanced_reports")
  )
    return unavailable;
  if (
    path[0] === "sales" &&
    path[1] === "complete" &&
    !plan.enabled_modules.includes("fiados") &&
    (body.sale_type === "fiado" ||
      (Array.isArray(body.payments) ? body.payments : []).some(
        (payment) => payment?.method === "fiado",
      ))
  )
    return unavailable;
  if (
    path[0] === "entities" &&
    path[1] === "FiadoRecord" &&
    !plan.enabled_modules.includes("fiados")
  )
    return unavailable;
  if (path[0] === "finance") {
    if (!canUseFinanceSection(user, path[1] || "dashboard")) return unavailable;
    if (
      path[1] === "transactions" &&
      !hasPlanFeature(user, "advanced_finance") &&
      method !== "GET"
    ) {
      // The basic plan records paid revenue/expenses; scheduled accounts,
      // transfers, installments and batch actions belong to advanced finance.
      if (
        path[2] ||
        method !== "POST" ||
        !["revenue", "expense"].includes(body.type) ||
        body.status !== "paid" ||
        Number(body.installments || 1) > 1 ||
        body.supplier_id ||
        body.account_id ||
        body.recurring_id
      )
        return unavailable;
    }
  }
  return null;
}
