import { getSalePaymentAllocations } from '../cash-summary.js';

const round = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const dateOnly = (value) => new Date(value).toISOString().slice(0, 10);

export function saleMetrics(sales, productsById, settings) {
  const result = {
    gross: 0,
    net: 0,
    discounts: 0,
    cogs: 0,
    missingCost: 0,
    cardFees: 0,
    taxes: 0,
    payments: {
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      fiado: 0,
      outros: 0,
    },
    byProduct: new Map(),
    byCategory: new Map(),
    daily: new Map(),
  };
  for (const row of sales) {
    const sale = row.data || {};
    if (sale.status !== "concluida") continue;
    const gross = Number(sale.subtotal ?? sale.total ?? 0);
    const net = Number(sale.total || 0);
    result.gross += gross;
    result.net += net;
    result.discounts += Math.max(0, gross - net);
    const day = dateOnly(row.created_date);
    const daily = result.daily.get(day) || { revenue: 0, cogs: 0 };
    daily.revenue += net;
    for (const payment of getSalePaymentAllocations(sale)) {
      const method =
        result.payments[payment.method] === undefined
          ? "outros"
          : payment.method;
      const amount = Number(payment.amount || 0);
      result.payments[method] += amount;
      if (payment.method === "debito")
        result.cardFees +=
          (amount * Number(settings.debit_card_fee || 0)) / 100;
      if (payment.method === "credito")
        result.cardFees +=
          (amount * Number(settings.credit_card_fee || 0)) / 100;
    }
    for (const item of sale.items || []) {
      const quantity =
        Number(item.unit === "peso" ? item.weight : item.quantity) || 0;
      const currentProduct = productsById.get(String(item.product_id));
      const rawCost = item.unit_cost ?? currentProduct?.cost_price;
      const unitCost =
        rawCost === null || rawCost === "" || rawCost === undefined
          ? null
          : Number(rawCost);
      const itemCost = Number.isFinite(unitCost) ? unitCost * quantity : 0;
      if (!Number.isFinite(unitCost)) result.missingCost += 1;
      result.cogs += itemCost;
      daily.cogs += itemCost;
      const revenue = Number(item.subtotal || 0);
      const product = result.byProduct.get(item.product_name) || {
        label: item.product_name || "Produto",
        revenue: 0,
        cost: 0,
        quantity: 0,
      };
      product.revenue += revenue;
      product.cost += itemCost;
      product.quantity += quantity;
      result.byProduct.set(product.label, product);
      const categoryName = currentProduct?.category || "Sem categoria";
      const category = result.byCategory.get(categoryName) || {
        label: categoryName,
        revenue: 0,
        cost: 0,
      };
      category.revenue += revenue;
      category.cost += itemCost;
      result.byCategory.set(categoryName, category);
    }
    result.daily.set(day, daily);
  }
  result.cardFees = round(result.cardFees);
  result.taxes = round((result.net * Number(settings.tax_rate || 0)) / 100);
  for (const key of ["gross", "net", "discounts", "cogs"])
    result[key] = round(result[key]);
  for (const key of Object.keys(result.payments))
    result.payments[key] = round(result.payments[key]);
  return result;
}

export function transactionMetrics(transactions, payments, range) {
  const paymentByTransaction = new Map();
  for (const payment of payments) {
    if (payment.reversed_at) continue;
    const list = paymentByTransaction.get(payment.transaction_id) || [];
    list.push(payment);
    paymentByTransaction.set(payment.transaction_id, list);
  }
  const result = {
    expenses: 0,
    revenues: 0,
    paidExpenses: 0,
    receivedRevenues: 0,
    payable: 0,
    receivable: 0,
    losses: 0,
    byCategory: new Map(),
    daily: new Map(),
  };
  for (const item of transactions) {
    if (["cancelled", "reversed"].includes(item.status)) continue;
    const amount = Number(item.amount || 0);
    if (item.issue_date >= range.from && item.issue_date <= range.to) {
      if (item.type === "expense") result.expenses += amount;
      if (item.type === "revenue") result.revenues += amount;
      if (item.type === "loss") result.losses += amount;
      if (item.type === "expense" || item.type === "loss") {
        const category = item.category_name || "Sem categoria";
        result.byCategory.set(
          category,
          (result.byCategory.get(category) || 0) + amount,
        );
      }
    }
    if (["pending", "partial", "overdue"].includes(item.status)) {
      const remaining = Math.max(0, amount - Number(item.paid_amount || 0));
      if (item.type === "expense" || item.type === "loss")
        result.payable += remaining;
      if (item.type === "revenue") result.receivable += remaining;
    }
    for (const payment of paymentByTransaction.get(item.id) || []) {
      const day = dateOnly(payment.paid_at);
      if (day < range.from || day > range.to) continue;
      const daily = result.daily.get(day) || { revenue: 0, expense: 0 };
      if (item.type === "expense" || item.type === "loss") {
        result.paidExpenses += Number(payment.amount);
        daily.expense += Number(payment.amount);
      }
      if (item.type === "revenue") {
        result.receivedRevenues += Number(payment.amount);
        daily.revenue += Number(payment.amount);
      }
      result.daily.set(day, daily);
    }
  }
  for (const key of [
    "expenses",
    "revenues",
    "paidExpenses",
    "receivedRevenues",
    "payable",
    "receivable",
    "losses",
  ])
    result[key] = round(result[key]);
  return result;
}

