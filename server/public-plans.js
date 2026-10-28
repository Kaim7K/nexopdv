import {
  catalogConfigurationError,
  catalogPlan,
} from "../src/lib/plan-catalog.js";

// Whitelist the public fields. Never return subscriptions, market/customer IDs,
// internal notes, custom contracts or draft prices.
export function publicPlanOffers(rows) {
  const seen = new Set();
  return rows.flatMap((row) => {
    const plan = catalogPlan(row);
    if (
      !row.active ||
      !plan ||
      catalogConfigurationError(row) ||
      seen.has(plan.key)
    )
      return [];
    seen.add(plan.key);
    return [
      {
        key: plan.key,
        name: plan.name,
        monthly_price: Number(row.monthly_price),
        user_limit: Number(row.user_limit),
      },
    ];
  });
}
