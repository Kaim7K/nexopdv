import { AppError } from "./errors.js";
import { methodNotAllowed, send } from "./http.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYMENT_METHODS = new Set([
  "dinheiro",
  "pix",
  "debito",
  "credito",
  "boleto",
  "transferencia",
  "outros",
]);
const TRANSACTION_TYPES = new Set([
  "expense",
  "revenue",
  "transfer",
  "loss",
  "adjustment",
]);
const TRANSACTION_STATUSES = new Set([
  "pending",
  "partial",
  "paid",
  "overdue",
  "cancelled",
  "reversed",
]);
const ACCOUNT_TYPES = new Set([
  "cash",
  "bank",
  "digital",
  "wallet",
  "safe",
  "pix",
  "card_receivable",
]);
const CATEGORY_TYPES = new Set(["expense", "revenue", "both"]);
const FREQUENCIES = new Set(["weekly", "monthly", "quarterly", "yearly"]);
const GOAL_TYPES = new Set([
  "revenue",
  "profit",
  "expense_limit",
  "category_limit",
  "loss_reduction",
  "margin",
]);
const PERMISSION_KEYS = [
  "view",
  "create",
  "edit",
  "pay",
  "view_profit",
  "view_costs",
  "export",
  "manage_suppliers",
  "manage_accounts",
  "manage_purchases",
  "approve_payments",
  "cancel",
  "manage_settings",
  "manage_permissions",
];
const FINANCE_MAINTENANCE_TTL = 15_000;
const financeMaintenance = new Map();

const round = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const text = (value, max = 500) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const bool = (value) => value === true;
const validUuid = (value) => UUID_PATTERN.test(String(value || ""));
const validDate = (value) =>
  DATE_PATTERN.test(String(value || "")) &&
  !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
const dateOnly = (value) => new Date(value).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (value, days) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const safeAmount = (value, { allowZero = false } = {}) => {
  const amount = round(Number(value));
  if (!Number.isFinite(amount) || amount < (allowZero ? 0 : 0.01))
    throw new AppError(
      400,
      "INVALID_AMOUNT",
      "Informe um valor maior que zero.",
    );
  return amount;
};
const percentage = (current, previous) =>
  previous
    ? round(((current - previous) / Math.abs(previous)) * 100)
    : current
      ? 100
      : 0;
const normalizeAttachment = (value) => {
  const attachment = String(value || "").trim();
  if (!attachment) return null;
  if (/^https:\/\//i.test(attachment) && attachment.length <= 2048)
    return attachment;
  if (
    /^data:image\/(jpeg|png|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(
      attachment,
    ) &&
    attachment.length <= 1_650_000
  )
    return attachment.replace(/\s+/g, "");
  throw new AppError(
    400,
    "INVALID_ATTACHMENT",
    "Use uma imagem válida ou uma URL HTTPS para o comprovante.",
  );
};

function parseRange(query = {}) {
  const end = validDate(query.to) ? query.to : today();
  const start = validDate(query.from) ? query.from : addDays(end, -29);
  if (start > end)
    throw new AppError(
      400,
      "INVALID_PERIOD",
      "A data inicial não pode ser posterior à data final.",
    );
  const days =
    Math.round(
      (new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`)) /
        86_400_000,
    ) + 1;
  if (days > 731)
    throw new AppError(
      400,
      "PERIOD_TOO_LARGE",
      "Selecione um período de até dois anos.",
    );
  return { from: start, to: end, toExclusive: addDays(end, 1), days };
}

function addFrequency(value, frequency, dueDay = null) {
  const date = new Date(`${value}T12:00:00Z`);
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else {
    const months =
      frequency === "quarterly" ? 3 : frequency === "yearly" ? 12 : 1;
    const targetDay = Math.max(
      1,
      Math.min(31, Number(dueDay || date.getUTCDate())),
    );
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    date.setUTCDate(
      Math.min(
        targetDay,
        new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    );
  }
  return date.toISOString().slice(0, 10);
}

const DEFAULT_PERMISSIONS = {
  admin: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])),
  gerente: {
    view: true,
    create: true,
    edit: true,
    pay: true,
    view_profit: true,
    view_costs: true,
    export: true,
    manage_suppliers: true,
    manage_accounts: true,
    manage_purchases: true,
    approve_payments: false,
    cancel: false,
    manage_settings: false,
    manage_permissions: false,
  },
  vendedor: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, false])),
};

async function financePermissions(sql, user) {
  const [row] =
    await sql`SELECT permissions FROM nexo.finance_user_permissions WHERE user_id=${user.id} AND market_id=${user.market_id}`;
  return {
    ...(DEFAULT_PERMISSIONS[user.role] || DEFAULT_PERMISSIONS.vendedor),
    ...(row?.permissions || {}),
  };
}

function requirePermission(permissions, key) {
  if (!permissions[key])
    throw new AppError(
      403,
      "FINANCE_PERMISSION_DENIED",
      "Seu perfil não possui permissão para esta ação financeira.",
    );
}

async function ensureFinanceSetup(sql, user) {
  const [account] = await sql`
    INSERT INTO nexo.finance_accounts(market_id,unit_id,name,type,is_default,created_by)
    SELECT ${user.market_id},${user.unit_id || null},'Caixa principal','cash',true,${user.id}
    WHERE NOT EXISTS (SELECT 1 FROM nexo.finance_accounts WHERE market_id=${user.market_id})
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  const [defaultAccount] = account
    ? [account]
    : await sql`SELECT id FROM nexo.finance_accounts WHERE market_id=${user.market_id} AND active ORDER BY is_default DESC,created_date LIMIT 1`;
  await sql`
    INSERT INTO nexo.finance_settings(market_id,payment_account_map,updated_by)
    VALUES(${user.market_id},${JSON.stringify(defaultAccount ? { dinheiro: defaultAccount.id, pix: defaultAccount.id, debito: defaultAccount.id, credito: defaultAccount.id, outros: defaultAccount.id } : {})}::jsonb,${user.id})
    ON CONFLICT(market_id) DO NOTHING
  `;
  await sql`
    INSERT INTO nexo.finance_categories(market_id,name,type,system_key,created_by)
    SELECT ${user.market_id},category.name,category.type,category.key,${user.id}
    FROM (VALUES
      ('Compra de mercadorias','expense','merchandise'),('Aluguel','expense','rent'),('Energia','expense','energy'),
      ('Água','expense','water'),('Internet','expense','internet'),('Funcionários','expense','payroll'),
      ('Impostos','expense','taxes'),('Manutenção','expense','maintenance'),('Transporte','expense','transport'),
      ('Materiais de limpeza','expense','cleaning'),('Equipamentos','expense','equipment'),('Marketing','expense','marketing'),
      ('Taxas bancárias','expense','bank_fees'),('Taxas de cartão','expense','card_fees'),
      ('Perdas e avarias','expense','losses'),('Outras despesas','expense','other_expense'),
      ('Venda externa','revenue','external_sale'),('Bonificação de fornecedor','revenue','supplier_bonus'),
      ('Crédito recebido','revenue','credit'),('Reembolso','revenue','refund'),
      ('Aluguel de espaço','revenue','space_rent'),('Outras receitas','revenue','other_revenue')
    ) AS category(name,type,key)
    WHERE NOT EXISTS (
      SELECT 1 FROM nexo.finance_categories existing
      WHERE existing.market_id=${user.market_id} AND existing.system_key=category.key
    )
    ON CONFLICT DO NOTHING
  `;
}

async function generateRecurringTransactions(sql, marketId) {
  const horizon = addDays(today(), 60);
  const rules =
    await sql`SELECT * FROM nexo.finance_recurring_rules WHERE market_id=${marketId} AND active AND next_due_date<=${horizon}::date ORDER BY next_due_date LIMIT 200`;
  for (const rule of rules) {
    let due = dateOnly(rule.next_due_date);
    let generated = 0;
    while (
      due <= horizon &&
      (!rule.end_date || due <= dateOnly(rule.end_date)) &&
      generated < 24
    ) {
      const status = due < today() ? "overdue" : "pending";
      await sql`
        INSERT INTO nexo.finance_transactions(
          market_id,unit_id,account_id,category_id,supplier_id,recurring_rule_id,type,description,
          amount,issue_date,due_date,payment_method,status,origin,created_by
        ) VALUES(
          ${marketId},${rule.unit_id},${rule.account_id},${rule.category_id},${rule.supplier_id},${rule.id},
          ${rule.transaction_type},${rule.description},${rule.amount},${due},${due},${rule.payment_method},${status},'recurring',${rule.created_by}
        ) ON CONFLICT DO NOTHING
      `;
      due = addFrequency(due, rule.frequency, rule.due_day);
      generated += 1;
    }
    const active = !rule.end_date || due <= dateOnly(rule.end_date);
    await sql`UPDATE nexo.finance_recurring_rules SET next_due_date=${due},active=${active},updated_date=now() WHERE id=${rule.id} AND market_id=${marketId}`;
  }
  await sql`UPDATE nexo.finance_transactions SET status='overdue',updated_date=now() WHERE market_id=${marketId} AND status IN ('pending','partial') AND due_date<current_date`;
}

async function ensureFinanceMaintenance(sql, user) {
  const marketId = user.market_id;
  const current = financeMaintenance.get(marketId);
  if (current?.promise) return current.promise;
  if (current?.completedAt > Date.now() - FINANCE_MAINTENANCE_TTL) return;

  const promise = (async () => {
    await ensureFinanceSetup(sql, user);
    await generateRecurringTransactions(sql, marketId);
  })();
  financeMaintenance.set(marketId, { promise, completedAt: 0 });
  try {
    await promise;
    financeMaintenance.set(marketId, {
      promise: null,
      completedAt: Date.now(),
    });
  } catch (error) {
    financeMaintenance.delete(marketId);
    throw error;
  }
}

function invalidateFinanceMaintenance(marketId) {
  financeMaintenance.delete(marketId);
}

function saleMetrics(sales, productsById, settings) {
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
    for (const payment of sale.payments || []) {
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

function transactionMetrics(transactions, payments, range) {
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

async function loadDashboard(sql, marketId, query) {
  const range = parseRange(query);
  const previousTo = addDays(range.from, -1);
  const previousFrom = addDays(previousTo, -range.days + 1);
  const [
    sales,
    previousSales,
    transactions,
    payments,
    products,
    fiados,
    settingsRows,
    accounts,
    goals,
    allSalePayments,
  ] = await Promise.all([
    sql`SELECT id,data,created_date FROM nexo.records WHERE market_id=${marketId} AND entity='sales' AND created_date>=${range.from}::date AND created_date<${range.toExclusive}::date AND data->>'status'='concluida'`,
    sql`SELECT id,data,created_date FROM nexo.records WHERE market_id=${marketId} AND entity='sales' AND created_date>=${previousFrom}::date AND created_date<${addDays(previousTo, 1)}::date AND data->>'status'='concluida'`,
    sql`SELECT transaction.*,category.name AS category_name,supplier.name AS supplier_name,account.name AS account_name,transfer_account.name AS transfer_account_name FROM nexo.finance_transactions transaction LEFT JOIN nexo.finance_categories category ON category.id=transaction.category_id LEFT JOIN nexo.finance_suppliers supplier ON supplier.id=transaction.supplier_id LEFT JOIN nexo.finance_accounts account ON account.id=transaction.account_id LEFT JOIN nexo.finance_accounts transfer_account ON transfer_account.id=transaction.transfer_account_id WHERE transaction.market_id=${marketId}`,
    sql`SELECT payment.* FROM nexo.finance_payments payment WHERE payment.market_id=${marketId} AND payment.paid_at>=${previousFrom}::date AND payment.paid_at<${range.toExclusive}::date`,
    sql`SELECT id,data FROM nexo.records WHERE market_id=${marketId} AND entity='products'`,
    sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${marketId} AND entity='fiado_records'`,
    sql`SELECT * FROM nexo.finance_settings WHERE market_id=${marketId}`,
    sql`SELECT * FROM nexo.finance_accounts WHERE market_id=${marketId} AND active ORDER BY is_default DESC,name`,
    sql`SELECT * FROM nexo.finance_goals WHERE market_id=${marketId} AND period=${range.to.slice(0, 7)}`,
    sql`SELECT payment->>'method' AS method,COALESCE(sum(CASE WHEN payment->>'amount' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (payment->>'amount')::numeric ELSE 0 END),0)::numeric AS amount FROM nexo.records sale,jsonb_array_elements(COALESCE(sale.data->'payments','[]'::jsonb)) payment WHERE sale.market_id=${marketId} AND sale.entity='sales' AND sale.data->>'status'='concluida' AND payment->>'method'<>'fiado' GROUP BY payment->>'method'`,
  ]);
  const settings = settingsRows[0] || {};
  const productsById = new Map(
    products.map((row) => [String(row.id), row.data || {}]),
  );
  const currentSales = saleMetrics(sales, productsById, settings);
  const oldSales = saleMetrics(previousSales, productsById, settings);
  const currentTransactions = transactionMetrics(transactions, payments, range);
  const oldTransactions = transactionMetrics(transactions, payments, {
    from: previousFrom,
    to: previousTo,
  });
  let fiadoPending = 0;
  let fiadoReceived = 0;
  const fiadoDaily = new Map();
  for (const row of fiados) {
    const item = row.data || {};
    if (item.status === "pendente")
      fiadoPending += Number(item.total_amount || 0);
    if (item.status === "quitado" && item.settlement_date) {
      const day = dateOnly(item.settlement_date);
      if (day >= range.from && day <= range.to) {
        fiadoReceived += Number(item.total_amount || 0);
        fiadoDaily.set(
          day,
          (fiadoDaily.get(day) || 0) + Number(item.total_amount || 0),
        );
      }
    }
  }
  const operatingExpenses = currentTransactions.expenses;
  const totalExpenses = round(operatingExpenses + currentTransactions.losses);
  const netRevenue = round(currentSales.net + currentTransactions.revenues);
  const estimatedProfit = round(
    netRevenue -
      currentSales.cogs -
      totalExpenses -
      currentSales.cardFees -
      currentSales.taxes,
  );
  const previousRevenue = round(oldSales.net + oldTransactions.revenues);
  const previousProfit = round(
    previousRevenue -
      oldSales.cogs -
      oldTransactions.expenses -
      oldTransactions.losses -
      oldSales.cardFees -
      oldSales.taxes,
  );
  const series = [];
  for (
    let cursor = range.from;
    cursor <= range.to;
    cursor = addDays(cursor, 1)
  ) {
    const saleDay = currentSales.daily.get(cursor) || {};
    const txDay = currentTransactions.daily.get(cursor) || {};
    const revenue = round(
      Number(saleDay.revenue || 0) +
        Number(txDay.revenue || 0) +
        Number(fiadoDaily.get(cursor) || 0),
    );
    const expense = round(Number(txDay.expense || 0));
    const profit = round(revenue - Number(saleDay.cogs || 0) - expense);
    series.push({ date: cursor, revenue, expense, profit });
  }
  const automaticReceipts = new Map(
    allSalePayments.map((item) => [item.method, Number(item.amount || 0)]),
  );
  for (const row of fiados)
    if (row.data?.status === "quitado" && row.data?.settlement_method)
      automaticReceipts.set(
        row.data.settlement_method,
        (automaticReceipts.get(row.data.settlement_method) || 0) +
          Number(row.data.total_amount || 0),
      );
  const accountBalances = accounts.map((account) => {
    let balance = Number(account.opening_balance || 0);
    for (const transaction of transactions) {
      if (["cancelled", "reversed"].includes(transaction.status)) continue;
      const realized = Number(transaction.paid_amount || 0);
      if (transaction.account_id === account.id)
        balance +=
          transaction.type === "revenue"
            ? realized
            : transaction.type === "transfer" ||
                transaction.type === "expense" ||
                transaction.type === "loss"
              ? -realized
              : 0;
      if (
        transaction.type === "transfer" &&
        transaction.transfer_account_id === account.id
      )
        balance += realized;
    }
    const paymentMap = settings.payment_account_map || {};
    for (const [method, amount] of automaticReceipts)
      if (paymentMap[method] === account.id) balance += amount;
    return { ...account, balance: round(balance) };
  });
  const financialBalance = round(
    accountBalances.reduce((sum, account) => sum + account.balance, 0),
  );
  const cashAvailable = round(
    accountBalances
      .filter((account) => ["cash", "safe", "wallet"].includes(account.type))
      .reduce((sum, account) => sum + account.balance, 0),
  );
  const margin = netRevenue ? round((estimatedProfit / netRevenue) * 100) : 0;
  const expensesByCategory = [...currentTransactions.byCategory]
    .map(([label, value]) => ({ label, value: round(value) }))
    .sort((a, b) => b.value - a.value);
  const topProducts = [...currentSales.byProduct.values()]
    .map((item) => ({
      ...item,
      revenue: round(item.revenue),
      cost: round(item.cost),
      profit: round(item.revenue - item.cost),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  const topCategories = [...currentSales.byCategory.values()]
    .map((item) => ({
      ...item,
      revenue: round(item.revenue),
      cost: round(item.cost),
      profit: round(item.revenue - item.cost),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  const alerts = [];
  const alertLimit = addDays(today(), Number(settings.alert_days || 3));
  const overdue = transactions.filter((item) => item.status === "overdue");
  const upcoming = transactions.filter(
    (item) =>
      ["pending", "partial"].includes(item.status) &&
      item.due_date &&
      item.due_date <= alertLimit,
  );
  if (overdue.length)
    alerts.push({
      type: "overdue",
      severity: "critical",
      title: `${overdue.length} conta(s) atrasada(s)`,
      description:
        "Revise os vencimentos e registre os pagamentos ou renegociações.",
    });
  if (upcoming.length)
    alerts.push({
      type: "upcoming",
      severity: "warning",
      title: `${upcoming.length} conta(s) próxima(s) do vencimento`,
      description: `Vencimentos previstos até ${new Date(`${alertLimit}T12:00:00`).toLocaleDateString("pt-BR")}.`,
    });
  if (currentSales.missingCost)
    alerts.push({
      type: "missing_cost",
      severity: "warning",
      title: `${currentSales.missingCost} item(ns) vendido(s) sem custo confiável`,
      description:
        "O lucro estimado pode estar maior que o real. Complete os custos no estoque.",
    });
  const negativeMargin = topProducts.filter((item) => item.profit < 0);
  if (negativeMargin.length)
    alerts.push({
      type: "negative_margin",
      severity: "critical",
      title: `${negativeMargin.length} produto(s) vendido(s) abaixo do custo`,
      description: "Revise preços e custos para interromper margens negativas.",
    });
  if (financialBalance < currentTransactions.payable)
    alerts.push({
      type: "insufficient_balance",
      severity: "warning",
      title: "Saldo abaixo dos compromissos em aberto",
      description:
        "O saldo financeiro atual não cobre todas as contas a pagar.",
    });
  const dre = [
    {
      key: "gross_revenue",
      label: "Receita bruta",
      value: currentSales.gross,
      help: "Total vendido antes de descontos.",
    },
    {
      key: "deductions",
      label: "Descontos, devoluções e cancelamentos",
      value: -currentSales.discounts,
      help: "Valores que reduziram as vendas.",
    },
    {
      key: "net_revenue",
      label: "Receita líquida",
      value: currentSales.net,
      help: "Vendas após descontos, devoluções e cancelamentos.",
    },
    {
      key: "cogs",
      label: "Custo das mercadorias vendidas",
      value: -currentSales.cogs,
      help: "Custo dos produtos que saíram no período.",
    },
    {
      key: "gross_profit",
      label: "Lucro bruto",
      value: round(currentSales.net - currentSales.cogs),
      help: "Receita líquida de vendas menos o custo dos produtos.",
    },
    {
      key: "operating_expenses",
      label: "Despesas operacionais",
      value: -operatingExpenses,
      help: "Gastos necessários para manter a loja.",
    },
    {
      key: "fees_taxes",
      label: "Taxas e impostos estimados",
      value: -round(currentSales.cardFees + currentSales.taxes),
      help: "Taxas de cartão e imposto configurado.",
    },
    {
      key: "other",
      label: "Outras receitas e despesas",
      value: round(currentTransactions.revenues - currentTransactions.losses),
      help: "Lançamentos externos e perdas registradas.",
    },
    {
      key: "result",
      label: "Resultado estimado",
      value: estimatedProfit,
      help: "Estimativa final considerando receitas, custos e despesas.",
    },
  ];
  const goalProgress = goals.map((goal) => {
    const categorySpent = transactions
      .filter(
        (item) =>
          item.category_id === goal.category_id &&
          item.issue_date >= range.from &&
          item.issue_date <= range.to &&
          !["cancelled", "reversed"].includes(item.status),
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const current =
      goal.type === "revenue"
        ? netRevenue
        : goal.type === "profit"
          ? estimatedProfit
          : goal.type === "expense_limit"
            ? operatingExpenses
            : goal.type === "margin"
              ? margin
              : goal.type === "category_limit"
                ? categorySpent
                : currentTransactions.losses;
    return {
      ...goal,
      target_value: Number(goal.target_value),
      current_value: round(current),
      progress: Number(goal.target_value)
        ? round((current / Number(goal.target_value)) * 100)
        : 0,
    };
  });
  return {
    range,
    summary: {
      gross_revenue: currentSales.gross,
      net_revenue: netRevenue,
      expenses: totalExpenses,
      estimated_profit: estimatedProfit,
      margin,
      payable: currentTransactions.payable,
      receivable: round(currentTransactions.receivable + fiadoPending),
      financial_balance: financialBalance,
      cash_available: cashAvailable,
      fiado_received: round(fiadoReceived),
      cogs: currentSales.cogs,
      inventory_value: round(
        products.reduce(
          (sum, row) =>
            sum +
            Number(row.data?.quantity || 0) * Number(row.data?.cost_price || 0),
          0,
        ),
      ),
      missing_cost_items: currentSales.missingCost,
    },
    comparison: {
      revenue: percentage(netRevenue, previousRevenue),
      expenses: percentage(
        totalExpenses,
        round(oldTransactions.expenses + oldTransactions.losses),
      ),
      profit: percentage(estimatedProfit, previousProfit),
      previous: {
        revenue: previousRevenue,
        expenses: round(oldTransactions.expenses + oldTransactions.losses),
        profit: previousProfit,
      },
    },
    payments: currentSales.payments,
    series,
    expenses_by_category: expensesByCategory,
    top_products: topProducts,
    top_categories: topCategories,
    accounts: accountBalances,
    alerts,
    dre,
    goals: goalProgress,
    trace: {
      sales_count: sales.length,
      manual_transactions: transactions.filter(
        (item) => item.issue_date >= range.from && item.issue_date <= range.to,
      ).length,
      product_cost_fallbacks: currentSales.missingCost,
    },
  };
}

async function defaultAccountId(sql, marketId, requested) {
  if (requested) {
    if (!validUuid(requested))
      throw new AppError(400, "INVALID_ACCOUNT", "Conta financeira inválida.");
    const [account] =
      await sql`SELECT id FROM nexo.finance_accounts WHERE id=${requested} AND market_id=${marketId} AND active`;
    if (!account)
      throw new AppError(
        400,
        "INVALID_ACCOUNT",
        "A conta financeira não está disponível.",
      );
    return account.id;
  }
  const [account] =
    await sql`SELECT id FROM nexo.finance_accounts WHERE market_id=${marketId} AND active ORDER BY is_default DESC,created_date LIMIT 1`;
  if (!account)
    throw new AppError(
      409,
      "FINANCE_ACCOUNT_REQUIRED",
      "Cadastre uma conta financeira antes de lançar movimentações.",
    );
  return account.id;
}

async function ownedReference(
  sql,
  table,
  id,
  marketId,
  label,
  { active = false } = {},
) {
  if (!id) return null;
  if (!validUuid(id))
    throw new AppError(400, "INVALID_REFERENCE", `${label} inválido(a).`);
  const rows = await sql.query(
    `SELECT id FROM nexo.${table} WHERE id=$1 AND market_id=$2 ${active ? "AND active" : ""} LIMIT 1`,
    [id, marketId],
  );
  if (!rows.length)
    throw new AppError(
      400,
      "INVALID_REFERENCE",
      `${label} não pertence a este mercadinho ou está indisponível.`,
    );
  return id;
}

function cleanTransactionInput(source, current = null) {
  const type = TRANSACTION_TYPES.has(source.type) ? source.type : current?.type;
  const description = text(source.description ?? current?.description, 180);
  const amount = safeAmount(source.amount ?? current?.amount);
  const issueDate = source.issue_date ?? current?.issue_date ?? today();
  const dueDate =
    source.due_date === ""
      ? null
      : (source.due_date ?? current?.due_date ?? issueDate);
  if (
    !type ||
    !description ||
    !validDate(issueDate) ||
    (dueDate && (!validDate(dueDate) || dueDate < issueDate))
  )
    throw new AppError(
      400,
      "INVALID_TRANSACTION",
      "Revise tipo, descrição e datas do lançamento.",
    );
  const paymentMethod =
    source.payment_method === ""
      ? null
      : text(source.payment_method ?? current?.payment_method, 40);
  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod))
    throw new AppError(
      400,
      "INVALID_PAYMENT_METHOD",
      "Forma de pagamento inválida.",
    );
  return {
    type,
    description,
    amount,
    issueDate,
    dueDate,
    paymentMethod,
    notes: text(source.notes ?? current?.notes, 2000),
    attachmentUrl:
      source.attachment_url === undefined
        ? current?.attachment_url || null
        : normalizeAttachment(source.attachment_url),
  };
}

async function listTransactions(sql, marketId, query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.max(
    10,
    Math.min(100, Number.parseInt(query.page_size, 10) || 25),
  );
  const offset = (page - 1) * pageSize;
  const type = text(query.type, 30),
    status = text(query.status, 30),
    categoryId = text(query.category_id, 64),
    accountId = text(query.account_id, 64),
    supplierId = text(query.supplier_id, 64),
    search = text(query.search, 160).toLowerCase();
  const from = validDate(query.from) ? query.from : "",
    to = validDate(query.to) ? query.to : "";
  const rows = await sql`
    SELECT transaction.*,category.name AS category_name,supplier.name AS supplier_name,account.name AS account_name,
      transfer_account.name AS transfer_account_name,COALESCE(actor.full_name,actor.email,'Sistema') AS created_by_name,
      count(*) OVER()::int AS total_count
    FROM nexo.finance_transactions transaction
    LEFT JOIN nexo.finance_categories category ON category.id=transaction.category_id
    LEFT JOIN nexo.finance_suppliers supplier ON supplier.id=transaction.supplier_id
    LEFT JOIN nexo.finance_accounts account ON account.id=transaction.account_id
    LEFT JOIN nexo.finance_accounts transfer_account ON transfer_account.id=transaction.transfer_account_id
    LEFT JOIN nexo.users actor ON actor.id=transaction.created_by
    WHERE transaction.market_id=${marketId}
      AND (${type}='' OR transaction.type=${type})
      AND (${status}='' OR (${status}='open' AND transaction.status IN ('pending','partial','overdue')) OR transaction.status=${status})
      AND (${categoryId}='' OR transaction.category_id::text=${categoryId})
      AND (${accountId}='' OR transaction.account_id::text=${accountId} OR transaction.transfer_account_id::text=${accountId})
      AND (${supplierId}='' OR transaction.supplier_id::text=${supplierId})
      AND (${from}='' OR transaction.issue_date>=${from}::date)
      AND (${to}='' OR transaction.issue_date<=${to}::date)
      AND (${search}='' OR lower(transaction.description) LIKE ${`%${search}%`} OR lower(COALESCE(supplier.name,'')) LIKE ${`%${search}%`})
    ORDER BY CASE transaction.status WHEN 'overdue' THEN 0 WHEN 'pending' THEN 1 WHEN 'partial' THEN 2 ELSE 3 END,COALESCE(transaction.due_date,transaction.issue_date),transaction.created_date DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const total = Number(rows[0]?.total_count || 0);
  return {
    items: rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      paid_amount: Number(row.paid_amount),
      total_count: undefined,
    })),
    page,
    page_size: pageSize,
    total,
    page_count: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function transactionDetail(sql, marketId, id) {
  if (!validUuid(id))
    throw new AppError(400, "INVALID_TRANSACTION", "Lançamento inválido.");
  const [transaction] = await sql`
    SELECT transaction.*,category.name AS category_name,supplier.name AS supplier_name,
      account.name AS account_name,transfer_account.name AS transfer_account_name,
      COALESCE(actor.full_name,actor.email,'Sistema') AS created_by_name
    FROM nexo.finance_transactions transaction
    LEFT JOIN nexo.finance_categories category ON category.id=transaction.category_id
    LEFT JOIN nexo.finance_suppliers supplier ON supplier.id=transaction.supplier_id
    LEFT JOIN nexo.finance_accounts account ON account.id=transaction.account_id
    LEFT JOIN nexo.finance_accounts transfer_account ON transfer_account.id=transaction.transfer_account_id
    LEFT JOIN nexo.users actor ON actor.id=transaction.created_by
    WHERE transaction.id=${id} AND transaction.market_id=${marketId}
  `;
  if (!transaction)
    throw new AppError(
      404,
      "TRANSACTION_NOT_FOUND",
      "Lançamento não encontrado.",
    );
  const [payments, events] = await Promise.all([
    sql`SELECT payment.*,account.name AS account_name,COALESCE(actor.full_name,actor.email,'Sistema') AS created_by_name FROM nexo.finance_payments payment LEFT JOIN nexo.finance_accounts account ON account.id=payment.account_id LEFT JOIN nexo.users actor ON actor.id=payment.created_by WHERE payment.transaction_id=${id} AND payment.market_id=${marketId} ORDER BY payment.paid_at DESC`,
    sql`SELECT event.*,COALESCE(actor.full_name,actor.email,event.actor_name) AS user_name FROM nexo.finance_transaction_events event LEFT JOIN nexo.users actor ON actor.id=event.actor_id WHERE event.transaction_id=${id} AND event.market_id=${marketId} ORDER BY event.created_date DESC`,
  ]);
  return {
    ...transaction,
    amount: Number(transaction.amount),
    paid_amount: Number(transaction.paid_amount),
    payments: payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
    })),
    events,
  };
}

async function createTransaction(sql, user, source) {
  const value = cleanTransactionInput(source);
  const accountId = await defaultAccountId(
    sql,
    user.market_id,
    source.account_id,
  );
  const transferAccountId =
    value.type === "transfer"
      ? await ownedReference(
          sql,
          "finance_accounts",
          source.transfer_account_id,
          user.market_id,
          "Conta de destino",
          { active: true },
        )
      : null;
  if (value.type === "transfer" && accountId === transferAccountId)
    throw new AppError(
      400,
      "SAME_TRANSFER_ACCOUNT",
      "Escolha contas diferentes para a transferência.",
    );
  const categoryId = await ownedReference(
    sql,
    "finance_categories",
    source.category_id,
    user.market_id,
    "Categoria",
    { active: true },
  );
  const supplierId = await ownedReference(
    sql,
    "finance_suppliers",
    source.supplier_id,
    user.market_id,
    "Fornecedor",
    { active: true },
  );
  if (["expense", "revenue", "loss"].includes(value.type) && !categoryId)
    throw new AppError(
      400,
      "CATEGORY_REQUIRED",
      "Selecione uma categoria para o lançamento.",
    );
  const requestedStatus = source.status === "paid" ? "paid" : "pending";
  const paidAmount =
    requestedStatus === "paid" || value.type === "transfer" ? value.amount : 0;
  const status = value.type === "transfer" ? "paid" : requestedStatus;
  const [created] = await sql`
    WITH transaction AS (
      INSERT INTO nexo.finance_transactions(market_id,unit_id,account_id,transfer_account_id,category_id,supplier_id,type,description,amount,paid_amount,issue_date,due_date,settled_at,payment_method,status,origin,attachment_url,notes,created_by)
      VALUES(${user.market_id},${source.unit_id || user.unit_id || null},${accountId},${transferAccountId},${categoryId},${supplierId},${value.type},${value.description},${value.amount},${paidAmount},${value.issueDate},${value.dueDate},${paidAmount ? new Date() : null},${value.paymentMethod},${status},${source.origin === "external" ? "external" : "manual"},${value.attachmentUrl},${value.notes},${user.id})
      RETURNING *
    ),payment AS (
      INSERT INTO nexo.finance_payments(market_id,transaction_id,account_id,amount,paid_at,payment_method,attachment_url,created_by)
      SELECT market_id,id,account_id,amount,COALESCE(settled_at,now()),payment_method,attachment_url,created_by FROM transaction WHERE paid_amount>0 AND type<>'transfer'
    ),event AS (
      INSERT INTO nexo.finance_transaction_events(market_id,transaction_id,action,new_data,actor_id,actor_name)
      SELECT market_id,id,'created',to_jsonb(transaction),${user.id},${user.full_name || user.email} FROM transaction
    ) SELECT * FROM transaction
  `;
  return {
    ...created,
    amount: Number(created.amount),
    paid_amount: Number(created.paid_amount),
  };
}

async function updateTransaction(sql, user, id, source) {
  if (!validUuid(id))
    throw new AppError(400, "INVALID_TRANSACTION", "Lançamento inválido.");
  const [current] =
    await sql`SELECT * FROM nexo.finance_transactions WHERE id=${id} AND market_id=${user.market_id}`;
  if (!current)
    throw new AppError(
      404,
      "TRANSACTION_NOT_FOUND",
      "Lançamento não encontrado.",
    );
  if (["cancelled", "reversed", "paid"].includes(current.status))
    throw new AppError(
      409,
      "TRANSACTION_LOCKED",
      "Lançamentos pagos, cancelados ou estornados não podem ser editados.",
    );
  const value = cleanTransactionInput(source, current);
  if (value.amount < Number(current.paid_amount))
    throw new AppError(
      400,
      "AMOUNT_BELOW_PAID",
      "O valor não pode ser menor que o total já pago.",
    );
  const accountId =
    source.account_id === undefined
      ? current.account_id
      : await defaultAccountId(sql, user.market_id, source.account_id);
  const categoryId =
    source.category_id === undefined
      ? current.category_id
      : await ownedReference(
          sql,
          "finance_categories",
          source.category_id,
          user.market_id,
          "Categoria",
          { active: true },
        );
  const supplierId =
    source.supplier_id === undefined
      ? current.supplier_id
      : await ownedReference(
          sql,
          "finance_suppliers",
          source.supplier_id,
          user.market_id,
          "Fornecedor",
          { active: true },
        );
  const status =
    Number(current.paid_amount) > 0
      ? "partial"
      : value.dueDate && value.dueDate < today()
        ? "overdue"
        : "pending";
  const [updated] = await sql`
    WITH updated AS (
      UPDATE nexo.finance_transactions SET account_id=${accountId},category_id=${categoryId},supplier_id=${supplierId},description=${value.description},amount=${value.amount},issue_date=${value.issueDate},due_date=${value.dueDate},payment_method=${value.paymentMethod},status=${status},attachment_url=${value.attachmentUrl},notes=${value.notes},updated_date=now()
      WHERE id=${id} AND market_id=${user.market_id} RETURNING *
    ),event AS (
      INSERT INTO nexo.finance_transaction_events(market_id,transaction_id,action,previous_data,new_data,actor_id,actor_name)
      SELECT market_id,id,'updated',${JSON.stringify(current)}::jsonb,to_jsonb(updated),${user.id},${user.full_name || user.email} FROM updated
    ) SELECT * FROM updated
  `;
  return {
    ...updated,
    amount: Number(updated.amount),
    paid_amount: Number(updated.paid_amount),
  };
}

async function payTransaction(sql, user, id, source) {
  if (!validUuid(id))
    throw new AppError(400, "INVALID_TRANSACTION", "Lançamento inválido.");
  const [current] =
    await sql`SELECT * FROM nexo.finance_transactions WHERE id=${id} AND market_id=${user.market_id}`;
  if (!current)
    throw new AppError(
      404,
      "TRANSACTION_NOT_FOUND",
      "Lançamento não encontrado.",
    );
  if (!["pending", "partial", "overdue"].includes(current.status))
    throw new AppError(
      409,
      "TRANSACTION_NOT_PAYABLE",
      "Este lançamento não aceita novos pagamentos.",
    );
  const amount = safeAmount(source.amount);
  const remaining = round(Number(current.amount) - Number(current.paid_amount));
  if (amount > remaining)
    throw new AppError(
      400,
      "PAYMENT_ABOVE_BALANCE",
      `O pagamento máximo é ${remaining.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    );
  const accountId = await defaultAccountId(
    sql,
    user.market_id,
    source.account_id || current.account_id,
  );
  const paidAt = source.paid_at ? new Date(source.paid_at) : new Date();
  if (Number.isNaN(paidAt.getTime()))
    throw new AppError(
      400,
      "INVALID_PAYMENT_DATE",
      "Data de pagamento inválida.",
    );
  const method =
    text(source.payment_method || current.payment_method, 40) || null;
  if (method && !PAYMENT_METHODS.has(method))
    throw new AppError(
      400,
      "INVALID_PAYMENT_METHOD",
      "Forma de pagamento inválida.",
    );
  const attachment = normalizeAttachment(source.attachment_url);
  const nextPaid = round(Number(current.paid_amount) + amount),
    nextStatus =
      nextPaid + 0.009 >= Number(current.amount) ? "paid" : "partial";
  const [updated] = await sql`
    WITH payment AS (
      INSERT INTO nexo.finance_payments(market_id,transaction_id,account_id,amount,paid_at,payment_method,notes,attachment_url,created_by)
      VALUES(${user.market_id},${id},${accountId},${amount},${paidAt},${method},${text(source.notes, 1000)},${attachment},${user.id}) RETURNING *
    ),updated AS (
      UPDATE nexo.finance_transactions SET paid_amount=${nextPaid},status=${nextStatus},settled_at=CASE WHEN ${nextStatus}='paid' THEN ${paidAt} ELSE settled_at END,account_id=${accountId},payment_method=COALESCE(${method},payment_method),updated_date=now()
      WHERE id=${id} AND market_id=${user.market_id} RETURNING *
    ),event AS (
      INSERT INTO nexo.finance_transaction_events(market_id,transaction_id,action,previous_data,new_data,actor_id,actor_name)
      SELECT market_id,id,'payment_registered',${JSON.stringify(current)}::jsonb,to_jsonb(updated)||jsonb_build_object('payment_amount',${amount}::numeric),${user.id}::uuid,${user.full_name || user.email}::text FROM updated
    ) SELECT * FROM updated
  `;
  return {
    ...updated,
    amount: Number(updated.amount),
    paid_amount: Number(updated.paid_amount),
  };
}

async function cancelTransaction(sql, user, id, reason) {
  if (!validUuid(id))
    throw new AppError(400, "INVALID_TRANSACTION", "Lançamento inválido.");
  const cancellationReason = text(reason, 500);
  if (cancellationReason.length < 5)
    throw new AppError(
      400,
      "CANCELLATION_REASON_REQUIRED",
      "Explique o motivo do cancelamento ou estorno.",
    );
  const [current] =
    await sql`SELECT * FROM nexo.finance_transactions WHERE id=${id} AND market_id=${user.market_id}`;
  if (!current)
    throw new AppError(
      404,
      "TRANSACTION_NOT_FOUND",
      "Lançamento não encontrado.",
    );
  if (["cancelled", "reversed"].includes(current.status))
    throw new AppError(
      409,
      "ALREADY_CANCELLED",
      "Este lançamento já foi cancelado ou estornado.",
    );
  const status = Number(current.paid_amount) > 0 ? "reversed" : "cancelled";
  const [updated] = await sql`
    WITH updated AS (
      UPDATE nexo.finance_transactions SET status=${status},cancelled_by=${user.id},cancelled_at=now(),cancellation_reason=${cancellationReason},updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING *
    ),reversed AS (
      UPDATE nexo.finance_payments SET reversed_at=now(),reversed_by=${user.id},reversal_reason=${cancellationReason} WHERE transaction_id=${id} AND reversed_at IS NULL RETURNING id
    ),event AS (
      INSERT INTO nexo.finance_transaction_events(market_id,transaction_id,action,previous_data,new_data,actor_id,actor_name)
      SELECT market_id,id,${status === "reversed" ? "reversed" : "cancelled"},${JSON.stringify(current)}::jsonb,to_jsonb(updated),${user.id},${user.full_name || user.email} FROM updated
    ) SELECT * FROM updated
  `;
  return {
    ...updated,
    amount: Number(updated.amount),
    paid_amount: Number(updated.paid_amount),
  };
}

async function duplicateTransaction(sql, user, id) {
  if (!validUuid(id))
    throw new AppError(400, "INVALID_TRANSACTION", "Lançamento inválido.");
  const [current] =
    await sql`SELECT * FROM nexo.finance_transactions WHERE id=${id} AND market_id=${user.market_id}`;
  if (!current)
    throw new AppError(
      404,
      "TRANSACTION_NOT_FOUND",
      "Lançamento não encontrado.",
    );
  return createTransaction(sql, user, {
    ...current,
    id: undefined,
    description: `${current.description} (cópia)`,
    status: "pending",
    paid_amount: 0,
    issue_date: today(),
    due_date: current.due_date ? today() : null,
    origin: "manual",
  });
}

async function referenceList(sql, table, marketId) {
  const order =
    table === "finance_categories" ? "type,name" : "active DESC,name";
  const rows = await sql.query(
    `SELECT * FROM nexo.${table} WHERE market_id=$1 ORDER BY ${order}`,
    [marketId],
  );
  return rows.map((row) => ({
    ...row,
    ...("opening_balance" in row
      ? { opening_balance: Number(row.opening_balance) }
      : {}),
  }));
}

async function saveCategory(sql, user, id, source) {
  const name = text(source.name, 100),
    type = CATEGORY_TYPES.has(source.type) ? source.type : "expense";
  if (!name)
    throw new AppError(
      400,
      "CATEGORY_NAME_REQUIRED",
      "Informe o nome da categoria.",
    );
  if (id) {
    if (!validUuid(id))
      throw new AppError(400, "INVALID_CATEGORY", "Categoria inválida.");
    const [row] =
      await sql`UPDATE nexo.finance_categories SET name=${name},type=${type},active=${source.active !== false},updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND system_key IS NULL RETURNING *`;
    if (!row)
      throw new AppError(
        404,
        "CATEGORY_NOT_EDITABLE",
        "Categoria não encontrada ou categoria padrão protegida.",
      );
    return row;
  }
  const [row] =
    await sql`INSERT INTO nexo.finance_categories(market_id,name,type,created_by) VALUES(${user.market_id},${name},${type},${user.id}) RETURNING *`;
  return row;
}

async function saveSupplier(sql, user, id, source) {
  const name = text(source.name, 140);
  if (!name)
    throw new AppError(
      400,
      "SUPPLIER_NAME_REQUIRED",
      "Informe o nome do fornecedor.",
    );
  const email = text(source.email, 254).toLowerCase();
  if (email && !EMAIL_PATTERN.test(email))
    throw new AppError(400, "INVALID_EMAIL", "E-mail do fornecedor inválido.");
  const values = {
    name,
    document: text(source.document, 30),
    contact: text(source.contact_name, 120),
    email,
    phone: text(source.phone, 40),
    address: text(source.address, 400),
    notes: text(source.notes, 2000),
    active: source.active !== false,
  };
  if (id) {
    if (!validUuid(id))
      throw new AppError(400, "INVALID_SUPPLIER", "Fornecedor inválido.");
    const [row] =
      await sql`UPDATE nexo.finance_suppliers SET name=${values.name},document=${values.document},contact_name=${values.contact},email=${values.email},phone=${values.phone},address=${values.address},notes=${values.notes},active=${values.active},updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING *`;
    if (!row)
      throw new AppError(
        404,
        "SUPPLIER_NOT_FOUND",
        "Fornecedor não encontrado.",
      );
    return row;
  }
  const [row] =
    await sql`INSERT INTO nexo.finance_suppliers(market_id,name,document,contact_name,email,phone,address,notes,active,created_by) VALUES(${user.market_id},${values.name},${values.document},${values.contact},${values.email},${values.phone},${values.address},${values.notes},true,${user.id}) RETURNING *`;
  return row;
}

async function saveAccount(sql, user, id, source) {
  const name = text(source.name, 100),
    type = ACCOUNT_TYPES.has(source.type) ? source.type : "bank";
  if (!name)
    throw new AppError(
      400,
      "ACCOUNT_NAME_REQUIRED",
      "Informe o nome da conta financeira.",
    );
  const opening = safeAmount(source.opening_balance ?? 0, { allowZero: true });
  const isDefault = bool(source.is_default),
    active = source.active !== false;
  if (id && !validUuid(id))
    throw new AppError(400, "INVALID_ACCOUNT", "Conta financeira inválida.");
  const queries = [];
  if (isDefault)
    queries.push(
      sql`UPDATE nexo.finance_accounts SET is_default=false,updated_date=now() WHERE market_id=${user.market_id} AND id<>${id || null}::uuid`,
    );
  if (id)
    queries.push(
      sql`UPDATE nexo.finance_accounts SET name=${name},type=${type},opening_balance=${opening},is_default=${isDefault},active=${active},unit_id=${source.unit_id || null},updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING *`,
    );
  else
    queries.push(
      sql`INSERT INTO nexo.finance_accounts(market_id,unit_id,name,type,opening_balance,is_default,active,created_by) VALUES(${user.market_id},${source.unit_id || user.unit_id || null},${name},${type},${opening},${isDefault},true,${user.id}) RETURNING *`,
    );
  const result = await sql.transaction(queries);
  const row = result.at(-1)?.[0];
  if (!row)
    throw new AppError(
      404,
      "ACCOUNT_NOT_FOUND",
      "Conta financeira não encontrada.",
    );
  return { ...row, opening_balance: Number(row.opening_balance) };
}

async function saveRecurring(sql, user, id, source) {
  const description = text(source.description, 180),
    amount = safeAmount(source.amount),
    frequency = FREQUENCIES.has(source.frequency) ? source.frequency : null;
  const transactionType =
    source.transaction_type === "revenue" ? "revenue" : "expense";
  const start = source.start_date || today(),
    end = source.end_date || null,
    dueDay = Math.max(
      1,
      Math.min(
        31,
        Number.parseInt(source.due_day, 10) ||
          new Date(`${start}T12:00:00Z`).getUTCDate(),
      ),
    );
  if (
    !description ||
    !frequency ||
    !validDate(start) ||
    (end && (!validDate(end) || end < start))
  )
    throw new AppError(
      400,
      "INVALID_RECURRENCE",
      "Revise descrição, frequência e período da recorrência.",
    );
  const accountId = await defaultAccountId(
    sql,
    user.market_id,
    source.account_id,
  );
  const categoryId = await ownedReference(
    sql,
    "finance_categories",
    source.category_id,
    user.market_id,
    "Categoria",
    { active: true },
  );
  const supplierId = await ownedReference(
    sql,
    "finance_suppliers",
    source.supplier_id,
    user.market_id,
    "Fornecedor",
    { active: true },
  );
  const paymentMethod = text(source.payment_method, 40) || null;
  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod))
    throw new AppError(
      400,
      "INVALID_PAYMENT_METHOD",
      "Forma de pagamento inválida.",
    );
  if (id) {
    if (!validUuid(id))
      throw new AppError(400, "INVALID_RECURRENCE", "Recorrência inválida.");
    const [row] =
      await sql`UPDATE nexo.finance_recurring_rules SET account_id=${accountId},category_id=${categoryId},supplier_id=${supplierId},transaction_type=${transactionType},description=${description},amount=${amount},amount_kind=${source.amount_kind === "estimated" ? "estimated" : "fixed"},frequency=${frequency},start_date=${start},end_date=${end},due_day=${dueDay},next_due_date=GREATEST(next_due_date,${start}::date),payment_method=${paymentMethod},active=${source.active !== false},updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING *`;
    if (!row)
      throw new AppError(
        404,
        "RECURRENCE_NOT_FOUND",
        "Recorrência não encontrada.",
      );
    return { ...row, amount: Number(row.amount) };
  }
  const [row] =
    await sql`INSERT INTO nexo.finance_recurring_rules(market_id,unit_id,account_id,category_id,supplier_id,transaction_type,description,amount,amount_kind,frequency,start_date,end_date,due_day,next_due_date,payment_method,active,created_by) VALUES(${user.market_id},${source.unit_id || user.unit_id || null},${accountId},${categoryId},${supplierId},${transactionType},${description},${amount},${source.amount_kind === "estimated" ? "estimated" : "fixed"},${frequency},${start},${end},${dueDay},${start},${paymentMethod},true,${user.id}) RETURNING *`;
  await generateRecurringTransactions(sql, user.market_id);
  return { ...row, amount: Number(row.amount) };
}

function cleanPurchaseItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 500)
    throw new AppError(
      400,
      "PURCHASE_ITEMS_REQUIRED",
      "Adicione ao menos um produto à compra.",
    );
  return items.map((item) => {
    if (!validUuid(item.product_id))
      throw new AppError(
        400,
        "INVALID_PURCHASE_PRODUCT",
        "Há um produto inválido na compra.",
      );
    const quantity = Number(item.quantity),
      unitCost = Number(item.unit_cost);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitCost) ||
      unitCost < 0
    )
      throw new AppError(
        400,
        "INVALID_PURCHASE_ITEM",
        "Revise quantidades e custos dos produtos.",
      );
    return {
      product_id: item.product_id,
      quantity: Math.round(quantity * 1000) / 1000,
      unit_cost: Math.round(unitCost * 10000) / 10000,
      total: round(quantity * unitCost),
    };
  });
}

function cleanInstallments(items, total, issueDate) {
  const installments =
    Array.isArray(items) && items.length
      ? items
      : [{ amount: total, due_date: issueDate, status: "paid" }];
  if (installments.length > 120)
    throw new AppError(
      400,
      "TOO_MANY_INSTALLMENTS",
      "A compra possui parcelas demais.",
    );
  const clean = installments.map((item) => ({
    amount: safeAmount(item.amount),
    due_date: item.due_date || issueDate,
    status: item.status === "paid" ? "paid" : "pending",
  }));
  if (clean.some((item) => !validDate(item.due_date)))
    throw new AppError(
      400,
      "INVALID_INSTALLMENT_DATE",
      "Há vencimentos inválidos nas parcelas.",
    );
  if (
    Math.abs(clean.reduce((sum, item) => sum + item.amount, 0) - total) > 0.01
  )
    throw new AppError(
      400,
      "INSTALLMENT_TOTAL_MISMATCH",
      "A soma das parcelas deve ser igual ao total da compra.",
    );
  return clean;
}

async function createPurchase(sql, user, source) {
  const supplierId = await ownedReference(
    sql,
    "finance_suppliers",
    source.supplier_id,
    user.market_id,
    "Fornecedor",
    { active: true },
  );
  if (!supplierId)
    throw new AppError(
      400,
      "SUPPLIER_REQUIRED",
      "Selecione o fornecedor da compra.",
    );
  const accountId = await defaultAccountId(
    sql,
    user.market_id,
    source.account_id,
  );
  const items = cleanPurchaseItems(source.items);
  const productIds = [...new Set(items.map((item) => item.product_id))];
  const owned =
    await sql`SELECT id FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND id=ANY(${productIds}::uuid[])`;
  if (owned.length !== productIds.length)
    throw new AppError(
      400,
      "PURCHASE_PRODUCT_NOT_OWNED",
      "A compra possui produto inexistente ou de outro mercadinho.",
    );
  const issueDate = validDate(source.issue_date) ? source.issue_date : today(),
    subtotal = round(items.reduce((sum, item) => sum + item.total, 0)),
    discount = safeAmount(source.discount || 0, { allowZero: true }),
    freight = safeAmount(source.freight || 0, { allowZero: true }),
    total = round(Math.max(0, subtotal - discount + freight));
  if (total <= 0)
    throw new AppError(
      400,
      "INVALID_PURCHASE_TOTAL",
      "O total da compra deve ser maior que zero.",
    );
  const installments = cleanInstallments(source.installments, total, issueDate),
    attachment = normalizeAttachment(source.attachment_url);
  const [purchase] = await sql`
    WITH number AS (UPDATE nexo.markets SET next_purchase_number=next_purchase_number+1 WHERE id=${user.market_id} RETURNING next_purchase_number-1 AS value),
    purchase AS (
      INSERT INTO nexo.finance_purchases(market_id,unit_id,supplier_id,account_id,purchase_number,issue_date,subtotal,discount,freight,total,payment_method,installments,invoice_number,attachment_url,notes,created_by)
      SELECT ${user.market_id},${source.unit_id || user.unit_id || null},${supplierId},${accountId},number.value,${issueDate},${subtotal},${discount},${freight},${total},${text(source.payment_method, 40) || null},${JSON.stringify(installments)}::jsonb,${text(source.invoice_number, 80)},${attachment},${text(source.notes, 2000)},${user.id} FROM number RETURNING *
    ),items AS (
      INSERT INTO nexo.finance_purchase_items(purchase_id,product_id,quantity,unit_cost,total)
      SELECT purchase.id,(item->>'product_id')::uuid,(item->>'quantity')::numeric,(item->>'unit_cost')::numeric,(item->>'total')::numeric FROM purchase,jsonb_array_elements(${JSON.stringify(items)}::jsonb) item
    ) SELECT * FROM purchase
  `;
  return {
    ...purchase,
    subtotal: Number(purchase.subtotal),
    discount: Number(purchase.discount),
    freight: Number(purchase.freight),
    total: Number(purchase.total),
    items,
  };
}

async function confirmPurchase(sql, user, id) {
  if (!validUuid(id))
    throw new AppError(400, "INVALID_PURCHASE", "Compra inválida.");
  const [purchase] =
    await sql`SELECT purchase.*,category.id AS category_id FROM nexo.finance_purchases purchase LEFT JOIN nexo.finance_categories category ON category.market_id=purchase.market_id AND category.system_key='merchandise' WHERE purchase.id=${id} AND purchase.market_id=${user.market_id}`;
  if (!purchase)
    throw new AppError(404, "PURCHASE_NOT_FOUND", "Compra não encontrada.");
  if (purchase.status !== "draft")
    throw new AppError(
      409,
      "PURCHASE_ALREADY_PROCESSED",
      "Somente compras em rascunho podem ser confirmadas.",
    );
  const installments = cleanInstallments(
    purchase.installments,
    Number(purchase.total),
    dateOnly(purchase.issue_date),
  );
  const [confirmed] = await sql`
    WITH confirmed AS (
      UPDATE nexo.finance_purchases SET status='confirmed',confirmed_by=${user.id},confirmed_at=now(),updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND status='draft' RETURNING *
    ),stock_source AS (
      SELECT item.product_id,item.quantity,item.unit_cost FROM nexo.finance_purchase_items item JOIN confirmed ON confirmed.id=item.purchase_id
    ),stock AS (
      UPDATE nexo.records product SET data=product.data||jsonb_build_object(
        'quantity',(CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END)+stock_source.quantity,
        'cost_price',CASE WHEN ((CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END)+stock_source.quantity)>0 THEN round((((CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END)*COALESCE(NULLIF(product.data->>'cost_price','')::numeric,0))+(stock_source.quantity*stock_source.unit_cost))/((CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END)+stock_source.quantity),4) ELSE stock_source.unit_cost END
      ),updated_date=now() FROM stock_source WHERE product.id=stock_source.product_id AND product.market_id=${user.market_id} AND product.entity='products' RETURNING product.id
    ),bills AS (
      INSERT INTO nexo.finance_transactions(market_id,unit_id,account_id,category_id,supplier_id,type,description,amount,paid_amount,issue_date,due_date,settled_at,payment_method,status,origin,origin_id,attachment_url,notes,created_by)
      SELECT confirmed.market_id,confirmed.unit_id,confirmed.account_id,${purchase.category_id},confirmed.supplier_id,'expense','Compra #'||confirmed.purchase_number||CASE WHEN count(*) OVER()>1 THEN ' · parcela '||row_number() OVER() ELSE '' END,(installment->>'amount')::numeric,CASE WHEN installment->>'status'='paid' THEN (installment->>'amount')::numeric ELSE 0 END,confirmed.issue_date,(installment->>'due_date')::date,CASE WHEN installment->>'status'='paid' THEN now() ELSE NULL END,confirmed.payment_method,CASE WHEN installment->>'status'='paid' THEN 'paid' WHEN (installment->>'due_date')::date<current_date THEN 'overdue' ELSE 'pending' END,'purchase',confirmed.id,confirmed.attachment_url,confirmed.notes,${user.id}
      FROM confirmed,jsonb_array_elements(${JSON.stringify(installments)}::jsonb) installment RETURNING *
    ),payments AS (
      INSERT INTO nexo.finance_payments(market_id,transaction_id,account_id,amount,paid_at,payment_method,attachment_url,created_by)
      SELECT market_id,id,account_id,paid_amount,settled_at,payment_method,attachment_url,created_by FROM bills WHERE paid_amount>0
    ),events AS (
      INSERT INTO nexo.finance_transaction_events(market_id,transaction_id,action,new_data,actor_id,actor_name)
      SELECT market_id,id,'created_from_purchase',to_jsonb(bills),${user.id},${user.full_name || user.email} FROM bills
    ) SELECT * FROM confirmed
  `;
  if (!confirmed)
    throw new AppError(
      409,
      "PURCHASE_CONFIRMATION_CONFLICT",
      "A compra foi processada por outro usuário.",
    );
  return {
    ...confirmed,
    subtotal: Number(confirmed.subtotal),
    discount: Number(confirmed.discount),
    freight: Number(confirmed.freight),
    total: Number(confirmed.total),
  };
}

async function listPurchases(sql, marketId) {
  const rows =
    await sql`SELECT purchase.*,supplier.name AS supplier_name,account.name AS account_name,COALESCE(actor.full_name,actor.email) AS created_by_name,(SELECT count(*)::int FROM nexo.finance_purchase_items item WHERE item.purchase_id=purchase.id) AS item_count FROM nexo.finance_purchases purchase LEFT JOIN nexo.finance_suppliers supplier ON supplier.id=purchase.supplier_id LEFT JOIN nexo.finance_accounts account ON account.id=purchase.account_id LEFT JOIN nexo.users actor ON actor.id=purchase.created_by WHERE purchase.market_id=${marketId} ORDER BY purchase.created_date DESC LIMIT 500`;
  return rows.map((row) => ({
    ...row,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    freight: Number(row.freight),
    total: Number(row.total),
  }));
}

async function cancelPurchase(sql, user, id, reason) {
  if (!validUuid(id))
    throw new AppError(400, "INVALID_PURCHASE", "Compra inválida.");
  const cancellationReason = text(reason, 500);
  if (cancellationReason.length < 5)
    throw new AppError(
      400,
      "CANCELLATION_REASON_REQUIRED",
      "Explique o motivo do cancelamento.",
    );
  const [purchase] =
    await sql`UPDATE nexo.finance_purchases SET status='cancelled',cancelled_by=${user.id},cancelled_at=now(),cancellation_reason=${cancellationReason},updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND status='draft' RETURNING *`;
  if (!purchase)
    throw new AppError(
      409,
      "PURCHASE_NOT_CANCELLABLE",
      "Somente compras em rascunho podem ser canceladas. Compras confirmadas exigem estorno auditado dos lançamentos e do estoque.",
    );
  return {
    ...purchase,
    subtotal: Number(purchase.subtotal),
    discount: Number(purchase.discount),
    freight: Number(purchase.freight),
    total: Number(purchase.total),
  };
}

async function saveGoal(sql, user, id, source) {
  const period = text(source.period, 7),
    type = GOAL_TYPES.has(source.type) ? source.type : null,
    target = safeAmount(source.target_value, { allowZero: true });
  if (!/^[0-9]{4}-[0-9]{2}$/.test(period) || !type)
    throw new AppError(
      400,
      "INVALID_GOAL",
      "Revise o período e o tipo da meta.",
    );
  const categoryId = await ownedReference(
    sql,
    "finance_categories",
    source.category_id,
    user.market_id,
    "Categoria",
  );
  if (type === "category_limit" && !categoryId)
    throw new AppError(
      400,
      "GOAL_CATEGORY_REQUIRED",
      "Selecione a categoria da meta.",
    );
  if (id) {
    if (!validUuid(id))
      throw new AppError(400, "INVALID_GOAL", "Meta inválida.");
    const [row] =
      await sql`UPDATE nexo.finance_goals SET period=${period},type=${type},target_value=${target},category_id=${categoryId},unit_id=${source.unit_id || null},updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING *`;
    if (!row) throw new AppError(404, "GOAL_NOT_FOUND", "Meta não encontrada.");
    return { ...row, target_value: Number(row.target_value) };
  }
  const [row] =
    await sql`INSERT INTO nexo.finance_goals(market_id,unit_id,category_id,period,type,target_value,created_by) VALUES(${user.market_id},${source.unit_id || null},${categoryId},${period},${type},${target},${user.id}) RETURNING *`;
  return { ...row, target_value: Number(row.target_value) };
}

async function saveSettings(sql, user, source) {
  if (
    source.email_alerts &&
    (!(user.enabled_features || []).includes("financial_email_alerts") ||
      !(user.enabled_features || []).includes("email_sending"))
  )
    throw new AppError(
      403,
      "FEATURE_NOT_AVAILABLE",
      "Alertas financeiros por e-mail não estão incluídos neste plano.",
    );
  const number = (value, min, max, label) => {
    const result = Number(value);
    if (!Number.isFinite(result) || result < min || result > max)
      throw new AppError(
        400,
        "INVALID_FINANCE_SETTING",
        `${label} está fora do intervalo permitido.`,
      );
    return result;
  };
  const tax = number(source.tax_rate ?? 0, 0, 100, "Imposto"),
    debit = number(source.debit_card_fee ?? 0, 0, 100, "Taxa de débito"),
    credit = number(source.credit_card_fee ?? 0, 0, 100, "Taxa de crédito"),
    alertDays = Math.round(
      number(source.alert_days ?? 3, 0, 90, "Dias de alerta"),
    );
  const map =
    source.payment_account_map && typeof source.payment_account_map === "object"
      ? source.payment_account_map
      : {};
  for (const accountId of Object.values(map))
    if (accountId)
      await ownedReference(
        sql,
        "finance_accounts",
        accountId,
        user.market_id,
        "Conta de recebimento",
        { active: true },
      );
  const [row] =
    await sql`INSERT INTO nexo.finance_settings(market_id,tax_rate,debit_card_fee,credit_card_fee,alert_days,currency,timezone,email_alerts,payment_account_map,updated_by) VALUES(${user.market_id},${tax},${debit},${credit},${alertDays},'BRL',${text(source.timezone, 80) || "America/Bahia"},${bool(source.email_alerts)},${JSON.stringify(map)}::jsonb,${user.id}) ON CONFLICT(market_id) DO UPDATE SET tax_rate=excluded.tax_rate,debit_card_fee=excluded.debit_card_fee,credit_card_fee=excluded.credit_card_fee,alert_days=excluded.alert_days,timezone=excluded.timezone,email_alerts=excluded.email_alerts,payment_account_map=excluded.payment_account_map,updated_by=excluded.updated_by,updated_date=now() RETURNING *`;
  return {
    ...row,
    tax_rate: Number(row.tax_rate),
    debit_card_fee: Number(row.debit_card_fee),
    credit_card_fee: Number(row.credit_card_fee),
  };
}

async function saveUserPermissions(sql, user, targetUserId, source) {
  if (!validUuid(targetUserId))
    throw new AppError(400, "INVALID_USER", "Usuário inválido.");
  const [target] =
    await sql`SELECT id,role FROM nexo.users WHERE id=${targetUserId} AND market_id=${user.market_id} AND active`;
  if (!target)
    throw new AppError(
      404,
      "USER_NOT_FOUND",
      "Usuário não encontrado neste mercadinho.",
    );
  if (target.role === "admin")
    throw new AppError(
      400,
      "ADMIN_PERMISSIONS_FIXED",
      "Administradores possuem acesso financeiro completo.",
    );
  const permissions = Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, bool(source[key])]),
  );
  const [row] =
    await sql`INSERT INTO nexo.finance_user_permissions(user_id,market_id,permissions,updated_by) VALUES(${targetUserId},${user.market_id},${JSON.stringify(permissions)}::jsonb,${user.id}) ON CONFLICT(user_id) DO UPDATE SET permissions=excluded.permissions,updated_by=excluded.updated_by,updated_date=now() RETURNING *`;
  return row;
}

async function loadBootstrap(sql, user, permissions) {
  const [
    categories,
    accounts,
    suppliers,
    recurring,
    settingsRows,
    users,
    permissionRows,
    units,
  ] = await Promise.all([
    referenceList(sql, "finance_categories", user.market_id),
    referenceList(sql, "finance_accounts", user.market_id),
    referenceList(sql, "finance_suppliers", user.market_id),
    sql`SELECT rule.*,category.name AS category_name,supplier.name AS supplier_name,account.name AS account_name FROM nexo.finance_recurring_rules rule LEFT JOIN nexo.finance_categories category ON category.id=rule.category_id LEFT JOIN nexo.finance_suppliers supplier ON supplier.id=rule.supplier_id LEFT JOIN nexo.finance_accounts account ON account.id=rule.account_id WHERE rule.market_id=${user.market_id} ORDER BY rule.active DESC,rule.next_due_date`,
    sql`SELECT * FROM nexo.finance_settings WHERE market_id=${user.market_id}`,
    sql`SELECT id,COALESCE(full_name,email) AS name,role FROM nexo.users WHERE market_id=${user.market_id} AND active ORDER BY COALESCE(full_name,email)`,
    sql`SELECT user_id,permissions FROM nexo.finance_user_permissions WHERE market_id=${user.market_id}`,
    sql`SELECT id,name,code,active FROM nexo.market_units WHERE market_id=${user.market_id} ORDER BY active DESC,name`,
  ]);
  const permissionMap = new Map(
    permissionRows.map((row) => [row.user_id, row.permissions]),
  );
  return {
    permissions,
    enabled_features: user.enabled_features || [],
    categories,
    accounts,
    suppliers,
    recurring: recurring.map((row) => ({ ...row, amount: Number(row.amount) })),
    settings: settingsRows[0]
      ? {
          ...settingsRows[0],
          tax_rate: Number(settingsRows[0].tax_rate),
          debit_card_fee: Number(settingsRows[0].debit_card_fee),
          credit_card_fee: Number(settingsRows[0].credit_card_fee),
        }
      : {
          tax_rate: 0,
          debit_card_fee: 0,
          credit_card_fee: 0,
          alert_days: 3,
          currency: "BRL",
          timezone: "America/Bahia",
          email_alerts: false,
          payment_account_map: {},
        },
    users: users.map((row) => ({
      ...row,
      permissions: {
        ...(DEFAULT_PERMISSIONS[row.role] || DEFAULT_PERMISSIONS.vendedor),
        ...(permissionMap.get(row.id) || {}),
      },
    })),
    units,
    permission_keys: PERMISSION_KEYS,
  };
}

async function loadPurchaseProducts(sql, marketId) {
  const rows = await sql`
    SELECT id,
      data->>'name' AS name,
      data->>'internal_code' AS internal_code,
      data->>'barcode' AS barcode,
      COALESCE(NULLIF(data->>'quantity','')::numeric,0) AS quantity,
      NULLIF(data->>'cost_price','')::numeric AS cost_price,
      data->>'unit' AS unit
    FROM nexo.records
    WHERE market_id=${marketId}
      AND entity='products'
      AND COALESCE(data->>'status','ativo')<>'inativo'
    ORDER BY data->>'name'
    LIMIT 3000
  `;
  return rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    cost_price: row.cost_price === null ? null : Number(row.cost_price),
  }));
}

async function loadLedger(sql, marketId, query) {
  const range = parseRange(query);
  const [transactions, sales, fiados] = await Promise.all([
    sql`SELECT transaction.*,category.name AS category_name,account.name AS account_name,COALESCE(actor.full_name,actor.email,'Sistema') AS actor_name FROM nexo.finance_transactions transaction LEFT JOIN nexo.finance_categories category ON category.id=transaction.category_id LEFT JOIN nexo.finance_accounts account ON account.id=transaction.account_id LEFT JOIN nexo.users actor ON actor.id=transaction.created_by WHERE transaction.market_id=${marketId} AND transaction.issue_date>=${range.from}::date AND transaction.issue_date<=${range.to}::date`,
    sql`SELECT id,data,created_date FROM nexo.records WHERE market_id=${marketId} AND entity='sales' AND created_date>=${range.from}::date AND created_date<${range.toExclusive}::date`,
    sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${marketId} AND entity='fiado_records' AND ((data->>'settlement_date')::timestamptz>=${range.from}::date AND (data->>'settlement_date')::timestamptz<${range.toExclusive}::date)`,
  ]);
  const items = transactions.map((item) => ({
    id: item.id,
    date: item.settled_at || item.created_date,
    type: item.type,
    description: item.description,
    amount: Number(item.amount),
    realized_amount: Number(item.paid_amount),
    status: item.status,
    origin: item.origin,
    account: item.account_name,
    category: item.category_name,
    actor: item.actor_name,
    trace_id: item.origin_id || item.id,
  }));
  for (const row of sales) {
    const sale = row.data || {};
    items.push({
      id: `sale:${row.id}`,
      date: row.created_date,
      type: "revenue",
      description: `Venda #${sale.sale_number}`,
      amount: Number(sale.total || 0),
      realized_amount: Number(sale.paid_amount || 0),
      status: sale.status === "concluida" ? "paid" : "cancelled",
      origin: "sale",
      account: "Conforme forma de pagamento",
      category: "Vendas do PDV",
      actor: sale.seller_name || "PDV",
      trace_id: row.id,
    });
  }
  for (const row of fiados)
    if (row.data?.status === "quitado")
      items.push({
        id: `fiado:${row.id}`,
        date: row.data.settlement_date,
        type: "revenue",
        description: `Recebimento fiado · ${row.data.responsible_name}`,
        amount: Number(row.data.total_amount || 0),
        realized_amount: Number(row.data.total_amount || 0),
        status: "paid",
        origin: "fiado",
        account: row.data.settlement_method,
        category: "Contas a receber",
        actor: row.data.settled_by_name || "Sistema",
        trace_id: row.id,
      });
  return {
    range,
    items: items
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 2000),
  };
}

async function loadReceivables(sql, marketId, query) {
  const range = parseRange(query);
  const [transactions, fiados] = await Promise.all([
    sql`SELECT transaction.*,category.name AS category_name,account.name AS account_name FROM nexo.finance_transactions transaction LEFT JOIN nexo.finance_categories category ON category.id=transaction.category_id LEFT JOIN nexo.finance_accounts account ON account.id=transaction.account_id WHERE transaction.market_id=${marketId} AND transaction.type='revenue' AND transaction.status IN ('pending','partial','overdue') AND COALESCE(transaction.due_date,transaction.issue_date)>=${range.from}::date AND COALESCE(transaction.due_date,transaction.issue_date)<=${range.to}::date ORDER BY COALESCE(transaction.due_date,transaction.issue_date)`,
    sql`SELECT id,data,created_date FROM nexo.records WHERE market_id=${marketId} AND entity='fiado_records' AND data->>'status'='pendente' ORDER BY COALESCE((data->>'due_date')::date,created_date::date)`,
  ]);
  const items = transactions.map((item) => ({
    id: item.id,
    kind: "transaction",
    client: null,
    description: item.description,
    original_amount: Number(item.amount),
    received_amount: Number(item.paid_amount),
    remaining_amount: round(Number(item.amount) - Number(item.paid_amount)),
    due_date: item.due_date,
    status: item.status,
    origin: item.origin,
    installments: 1,
    category: item.category_name,
    account: item.account_name,
  }));
  for (const row of fiados) {
    const item = row.data || {};
    items.push({
      id: row.id,
      kind: "fiado",
      client:
        item.responsible_name || item.customer_name || "Cliente não informado",
      description: `Venda fiada #${item.sale_number || "—"}`,
      original_amount: Number(item.total_amount || 0),
      received_amount: 0,
      remaining_amount: Number(item.total_amount || 0),
      due_date: item.due_date || null,
      status: item.due_date && item.due_date < today() ? "overdue" : "pending",
      origin: "fiado",
      installments: Number(item.installments || 1),
      category: "Vendas fiadas",
      account: null,
    });
  }
  const total = round(
    items.reduce((sum, item) => sum + item.remaining_amount, 0),
  );
  return {
    range,
    total,
    items: items.sort((a, b) =>
      String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")),
    ),
  };
}

async function loadReconciliation(sql, marketId, query) {
  const range = parseRange(query);
  const [sessions, sales, movements] = await Promise.all([
    sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${marketId} AND entity='cash_sessions' AND COALESCE((data->>'opened_at')::timestamptz,created_date)>=${range.from}::date AND COALESCE((data->>'opened_at')::timestamptz,created_date)<${range.toExclusive}::date ORDER BY created_date DESC`,
    sql`SELECT id,data,created_date FROM nexo.records WHERE market_id=${marketId} AND entity='sales' AND created_date>=${range.from}::date AND created_date<${range.toExclusive}::date`,
    sql`SELECT id,data,created_date FROM nexo.records WHERE market_id=${marketId} AND entity='cash_movements' AND created_date>=${range.from}::date AND created_date<${range.toExclusive}::date`,
  ]);
  const result = sessions.map((row) => {
    const session = row.data || {},
      sessionSales = sales.filter(
        (sale) =>
          sale.data?.cash_session_id === row.id &&
          sale.data?.status === "concluida",
      ),
      sessionMovements = movements.filter(
        (item) => item.data?.cash_session_id === row.id,
      );
    const payments = {
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      fiado: 0,
      outros: 0,
    };
    for (const sale of sessionSales)
      for (const payment of sale.data?.payments || [])
        payments[
          payments[payment.method] === undefined ? "outros" : payment.method
        ] += Number(payment.amount || 0);
    const entries = sessionMovements
        .filter((item) => item.data?.type === "entrada")
        .reduce((sum, item) => sum + Number(item.data?.amount || 0), 0),
      withdrawals = sessionMovements
        .filter((item) => item.data?.type === "retirada")
        .reduce((sum, item) => sum + Number(item.data?.amount || 0), 0);
    const expectedCash = round(
        Number(session.opening_amount || 0) +
          payments.dinheiro +
          entries -
          withdrawals,
      ),
      declared =
        session.closing_amount === null || session.closing_amount === undefined
          ? null
          : Number(session.closing_amount),
      difference = declared === null ? null : round(declared - expectedCash);
    return {
      id: row.id,
      operator: session.seller_name || "Não informado",
      opened_at: session.opened_at || row.created_date,
      closed_at: session.closed_at || null,
      status: session.status || "aberto",
      opening_amount: Number(session.opening_amount || 0),
      payments: Object.fromEntries(
        Object.entries(payments).map(([key, value]) => [key, round(value)]),
      ),
      entries: round(entries),
      withdrawals: round(withdrawals),
      expected_cash: expectedCash,
      declared_cash: declared,
      difference,
      sales_count: sessionSales.length,
      has_difference: difference !== null && Math.abs(difference) >= 0.01,
    };
  });
  const totals = {
    sales: round(
      result.reduce(
        (sum, item) =>
          sum +
          Object.values(item.payments).reduce(
            (value, current) => value + current,
            0,
          ),
        0,
      ),
    ),
    expected_cash: round(
      result.reduce((sum, item) => sum + item.expected_cash, 0),
    ),
    differences: round(
      result.reduce((sum, item) => sum + Number(item.difference || 0), 0),
    ),
    sessions_with_difference: result.filter((item) => item.has_difference)
      .length,
  };
  return { range, totals, sessions: result };
}

async function loadHistory(sql, marketId, query) {
  const limit = Math.max(
    10,
    Math.min(500, Number.parseInt(query.limit, 10) || 100),
  );
  return sql`SELECT event.*,COALESCE(actor.full_name,actor.email,event.actor_name) AS user_name,transaction.description,transaction.amount FROM nexo.finance_transaction_events event LEFT JOIN nexo.users actor ON actor.id=event.actor_id LEFT JOIN nexo.finance_transactions transaction ON transaction.id=event.transaction_id WHERE event.market_id=${marketId} ORDER BY event.created_date DESC LIMIT ${limit}`;
}

export async function handleFinanceRequest({ req, res, sql, user, path }) {
  if (!user.market_id)
    return send(res, 400, { message: "Usuário sem mercadinho vinculado." });
  const section = path[1] || "dashboard",
    id = path[2],
    action = path[3];
  await ensureFinanceMaintenance(sql, user);
  const permissions = await financePermissions(sql, user);
  requirePermission(permissions, "view");

  if (section === "bootstrap" && req.method === "GET")
    return send(res, 200, await loadBootstrap(sql, user, permissions));
  if (section === "dashboard" && req.method === "GET") {
    const dashboard = await loadDashboard(sql, user.market_id, req.query);
    if (!permissions.view_profit) {
      delete dashboard.summary.estimated_profit;
      delete dashboard.summary.margin;
      delete dashboard.dre;
      delete dashboard.goals;
      dashboard.series = dashboard.series.map(({ profit, ...item }) => {
        void profit;
        return item;
      });
    }
    if (!permissions.view_costs) {
      delete dashboard.summary.cogs;
      delete dashboard.summary.inventory_value;
      dashboard.top_products = dashboard.top_products.map(
        ({ cost, profit, ...item }) => item,
      );
      dashboard.top_categories = dashboard.top_categories.map(
        ({ cost, profit, ...item }) => item,
      );
    }
    return send(res, 200, dashboard);
  }
  if (section === "ledger" && req.method === "GET")
    return send(res, 200, await loadLedger(sql, user.market_id, req.query));
  if (section === "receivables" && req.method === "GET")
    return send(
      res,
      200,
      await loadReceivables(sql, user.market_id, req.query),
    );
  if (section === "reconciliation" && req.method === "GET")
    return send(
      res,
      200,
      await loadReconciliation(sql, user.market_id, req.query),
    );
  if (section === "history" && req.method === "GET")
    return send(res, 200, await loadHistory(sql, user.market_id, req.query));
  if (section === "products" && req.method === "GET") {
    if (!(user.enabled_features || []).includes("integrated_purchases"))
      throw new AppError(
        403,
        "FEATURE_NOT_AVAILABLE",
        "Compras integradas ao estoque não estão incluídas neste plano.",
      );
    requirePermission(permissions, "manage_purchases");
    return send(res, 200, await loadPurchaseProducts(sql, user.market_id));
  }

  if (section === "transactions") {
    if (!id && req.method === "GET")
      return send(
        res,
        200,
        await listTransactions(sql, user.market_id, req.query),
      );
    if (!id && req.method === "POST") {
      requirePermission(permissions, "create");
      return send(res, 201, await createTransaction(sql, user, req.body || {}));
    }
    if (id && id !== "batch" && !action && req.method === "GET")
      return send(res, 200, await transactionDetail(sql, user.market_id, id));
    if (id && req.method === "PATCH") {
      requirePermission(permissions, "edit");
      return send(
        res,
        200,
        await updateTransaction(sql, user, id, req.body || {}),
      );
    }
    if (id && action === "pay" && req.method === "POST") {
      requirePermission(permissions, "pay");
      return send(
        res,
        200,
        await payTransaction(sql, user, id, req.body || {}),
      );
    }
    if (id && action === "cancel" && req.method === "POST") {
      requirePermission(permissions, "cancel");
      return send(
        res,
        200,
        await cancelTransaction(sql, user, id, req.body?.reason),
      );
    }
    if (id && action === "duplicate" && req.method === "POST") {
      requirePermission(permissions, "create");
      return send(res, 201, await duplicateTransaction(sql, user, id));
    }
    if (id === "batch" && req.method === "POST") {
      const ids = Array.isArray(req.body.ids)
        ? [...new Set(req.body.ids.filter(validUuid))].slice(0, 100)
        : [];
      if (!ids.length)
        throw new AppError(
          400,
          "BATCH_EMPTY",
          "Selecione ao menos um lançamento.",
        );
      if (req.body.action === "cancel") {
        requirePermission(permissions, "cancel");
        const results = [];
        for (const transactionId of ids)
          results.push(
            await cancelTransaction(sql, user, transactionId, req.body.reason),
          );
        return send(res, 200, { items: results });
      }
      if (req.body.action === "pay") {
        requirePermission(permissions, "pay");
        const results = [];
        for (const transactionId of ids) {
          const detail = await transactionDetail(
            sql,
            user.market_id,
            transactionId,
          );
          const remaining = round(detail.amount - detail.paid_amount);
          if (
            remaining > 0 &&
            ["pending", "partial", "overdue"].includes(detail.status)
          )
            results.push(
              await payTransaction(sql, user, transactionId, {
                ...req.body,
                amount: remaining,
              }),
            );
        }
        return send(res, 200, { items: results });
      }
      throw new AppError(400, "INVALID_BATCH_ACTION", "Ação em lote inválida.");
    }
    return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
  }

  if (section === "categories") {
    if (req.method === "GET")
      return send(
        res,
        200,
        await referenceList(sql, "finance_categories", user.market_id),
      );
    requirePermission(permissions, "manage_settings");
    if (!id && req.method === "POST")
      return send(
        res,
        201,
        await saveCategory(sql, user, null, req.body || {}),
      );
    if (id && req.method === "PATCH")
      return send(res, 200, await saveCategory(sql, user, id, req.body || {}));
    if (id && req.method === "DELETE") {
      if (!validUuid(id))
        throw new AppError(400, "INVALID_CATEGORY", "Categoria inválida.");
      const [row] =
        await sql`UPDATE nexo.finance_categories SET active=false,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND system_key IS NULL RETURNING *`;
      if (!row)
        throw new AppError(
          404,
          "CATEGORY_NOT_EDITABLE",
          "Categoria não encontrada ou protegida.",
        );
      return send(res, 200, row);
    }
  }
  if (section === "suppliers") {
    if (req.method === "GET")
      return send(
        res,
        200,
        await referenceList(sql, "finance_suppliers", user.market_id),
      );
    requirePermission(permissions, "manage_suppliers");
    if (!id && req.method === "POST")
      return send(
        res,
        201,
        await saveSupplier(sql, user, null, req.body || {}),
      );
    if (id && req.method === "PATCH")
      return send(res, 200, await saveSupplier(sql, user, id, req.body || {}));
    if (id && req.method === "DELETE") {
      if (!validUuid(id))
        throw new AppError(400, "INVALID_SUPPLIER", "Fornecedor inválido.");
      const [row] =
        await sql`UPDATE nexo.finance_suppliers SET active=false,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING *`;
      if (!row)
        throw new AppError(
          404,
          "SUPPLIER_NOT_FOUND",
          "Fornecedor não encontrado.",
        );
      return send(res, 200, row);
    }
  }
  if (section === "accounts") {
    if (req.method === "GET")
      return send(
        res,
        200,
        await referenceList(sql, "finance_accounts", user.market_id),
      );
    requirePermission(permissions, "manage_accounts");
    if (!id && req.method === "POST")
      return send(res, 201, await saveAccount(sql, user, null, req.body || {}));
    if (id && req.method === "PATCH")
      return send(res, 200, await saveAccount(sql, user, id, req.body || {}));
  }
  if (section === "recurring") {
    if (!(user.enabled_features || []).includes("recurring_finance"))
      throw new AppError(
        403,
        "FEATURE_NOT_AVAILABLE",
        "Despesas recorrentes não estão incluídas neste plano.",
      );
    if (req.method === "GET") {
      const rows =
        await sql`SELECT * FROM nexo.finance_recurring_rules WHERE market_id=${user.market_id} ORDER BY active DESC,next_due_date`;
      return send(
        res,
        200,
        rows.map((row) => ({ ...row, amount: Number(row.amount) })),
      );
    }
    requirePermission(permissions, "create");
    if (!id && req.method === "POST") {
      const row = await saveRecurring(sql, user, null, req.body || {});
      invalidateFinanceMaintenance(user.market_id);
      return send(res, 201, row);
    }
    if (id && req.method === "PATCH") {
      const row = await saveRecurring(sql, user, id, req.body || {});
      invalidateFinanceMaintenance(user.market_id);
      return send(res, 200, row);
    }
  }
  if (section === "purchases") {
    if (!(user.enabled_features || []).includes("integrated_purchases"))
      throw new AppError(
        403,
        "FEATURE_NOT_AVAILABLE",
        "Compras integradas ao estoque não estão incluídas neste plano.",
      );
    requirePermission(permissions, "manage_purchases");
    if (!id && req.method === "GET")
      return send(res, 200, await listPurchases(sql, user.market_id));
    if (!id && req.method === "POST")
      return send(res, 201, await createPurchase(sql, user, req.body || {}));
    if (id && action === "confirm" && req.method === "POST")
      return send(res, 200, await confirmPurchase(sql, user, id));
    if (id && action === "cancel" && req.method === "POST")
      return send(
        res,
        200,
        await cancelPurchase(sql, user, id, req.body?.reason),
      );
  }
  if (section === "goals") {
    if (req.method === "GET") {
      const rows =
        await sql`SELECT goal.*,category.name AS category_name FROM nexo.finance_goals goal LEFT JOIN nexo.finance_categories category ON category.id=goal.category_id WHERE goal.market_id=${user.market_id} ORDER BY period DESC,type`;
      return send(
        res,
        200,
        rows.map((row) => ({ ...row, target_value: Number(row.target_value) })),
      );
    }
    requirePermission(permissions, "manage_settings");
    if (!id && req.method === "POST")
      return send(res, 201, await saveGoal(sql, user, null, req.body || {}));
    if (id && req.method === "PATCH")
      return send(res, 200, await saveGoal(sql, user, id, req.body || {}));
    if (id && req.method === "DELETE") {
      if (!validUuid(id))
        throw new AppError(400, "INVALID_GOAL", "Meta inválida.");
      const [row] =
        await sql`DELETE FROM nexo.finance_goals WHERE id=${id} AND market_id=${user.market_id} RETURNING id`;
      return send(
        res,
        row ? 200 : 404,
        row || { message: "Meta não encontrada." },
      );
    }
  }
  if (section === "settings") {
    if (req.method === "GET") {
      const rows =
        await sql`SELECT * FROM nexo.finance_settings WHERE market_id=${user.market_id}`;
      return send(res, 200, rows[0] || {});
    }
    requirePermission(permissions, "manage_settings");
    if (req.method === "PATCH")
      return send(res, 200, await saveSettings(sql, user, req.body || {}));
  }
  if (section === "permissions") {
    requirePermission(permissions, "manage_permissions");
    if (req.method === "PATCH" && id)
      return send(
        res,
        200,
        await saveUserPermissions(sql, user, id, req.body || {}),
      );
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
}
