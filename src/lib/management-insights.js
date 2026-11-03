import { catalogPlan, canUseFinanceSection } from './plan-catalog.js';
import { allocateSaleItems } from './report-metrics.js';

export function managementModules(user) {
  const plan = catalogPlan(user);
  return (user.enabled_modules || []).filter(key => !plan || plan.enabled_modules.includes(key));
}

export function productInsights(products, threshold = 5, now = Date.now()) {
  const active = products.filter(product => product.active !== false && product.status !== 'inativo' && !product.archived_at);
  const low = active.filter(product => product.track_stock !== false && Number(product.quantity) <= threshold);
  const idle = active.filter(product => Number(product.quantity) > 0 &&
    now - new Date(product.last_sale_at || product.created_date).getTime() >= 30 * 86400000);
  const margin = active.filter(product => product.cost_price !== null && product.cost_price !== '' &&
    product.cost_price !== undefined && Number(product.sale_price) > 0 &&
    (Number(product.sale_price) - Number(product.cost_price)) / Number(product.sale_price) < 0.1);
  const brief = items => items.slice(0, 5).map(({ id, name, quantity }) => ({ id, name, quantity }));
  return { total: active.length, low: { count: low.length, products: brief(low) },
    idle: { count: idle.length, products: brief(idle) }, margin: { count: margin.length, products: brief(margin) } };
}

export function canReadPayables(user) {
  return managementModules(user).includes('financeiro') && canUseFinanceSection(user, 'payables');
}

export function marginDeclines(sales, now = Date.now()) {
  const periods = [new Map(), new Map()];
  for (const sale of sales) {
    const age = now - new Date(sale.created_date).getTime();
    if (sale.status !== 'concluida' || !Number.isFinite(age) || age < 0 || age >= 60 * 86400000) continue;
    const period = periods[age < 30 * 86400000 ? 0 : 1];
    for (const { item, quantity, netRevenue } of allocateSaleItems(sale)) {
      const cost = Number(item.unit_cost);
      if (!item.product_id || item.unit_cost === null || item.unit_cost === '' || item.unit_cost === undefined || !Number.isFinite(cost) || cost < 0) continue;
      const row = period.get(item.product_id) || { id: item.product_id, name: item.product_name, revenue: 0, cost: 0 };
      row.revenue += netRevenue;
      row.cost += quantity * cost;
      period.set(item.product_id, row);
    }
  }
  const declines = [];
  for (const [id, current] of periods[0]) {
    const previous = periods[1].get(id);
    if (!(current.revenue > 0 && previous?.revenue > 0)) continue;
    const margin = (current.revenue - current.cost) / current.revenue;
    const previousMargin = (previous.revenue - previous.cost) / previous.revenue;
    const drop = (previousMargin - margin) * 100;
    if (drop >= 1) declines.push({ id, name: current.name, drop: Math.round(drop * 100) / 100 });
  }
  declines.sort((a, b) => b.drop - a.drop || String(a.id).localeCompare(String(b.id)));
  return { count: declines.length, products: declines.slice(0, 5) };
}
