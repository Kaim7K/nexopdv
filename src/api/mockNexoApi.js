const STORE_KEY = 'nexo:mock-db:v2';
const LATENCY = 80;

const today = () => localDate(new Date());
const nowIso = () => new Date().toISOString();
const localDate = (date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const addDays = (days, hour = 10, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const round = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const clone = (value) => JSON.parse(JSON.stringify(value));
const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const demoUser = {
  id: 'usr_demo_admin',
  full_name: 'Maria Oliveira',
  name: 'Maria Oliveira',
  email: 'demo@nexopdv.local',
  role: 'admin',
  market_id: 'market_demo',
  market_name: 'Mercadinho Alameda das Árvores',
  unit_id: 'unit_main',
  unit_name: 'Unidade principal',
  primary_color: '#16a06a',
  require_cash_register: true,
  enabled_modules: [
    'pdv',
    'estoque',
    'vendas',
    'caixas',
    'fiados',
    'relatorios',
    'financeiro',
    'auditoria',
    'usuarios',
    'configuracoes',
  ],
  enabled_features: [
    'market_logo',
    'sidebar_customization',
    'product_image_upload',
    'automatic_image_search',
    'quick_product_creation',
    'report_export',
    'recurring_finance',
    'integrated_purchases',
    'stock_email_alerts',
    'email_sending',
    'financial_email_alerts',
  ],
};

const mockSuperUser = {
  id: 'usr_mock_super',
  full_name: 'Super Admin',
  name: 'Super Admin',
  email: 'super@nexopdv.local',
  role: 'super_admin',
  market_name: 'Nexo Plataforma',
  primary_color: '#16a06a',
  platform_notice: '',
};

function sessionUserFallback() {
  try {
    const cached = JSON.parse(localStorage.getItem('nexo:session-user') || 'null');
    if (cached?.user?.role === 'super_admin') return { ...mockSuperUser, ...cached.user };
  } catch {
    /* mock opcional */
  }
  return { ...demoUser };
}

const productNames = [
  ['Pão francês', 'Padaria', 0.5, 38],
  ['Bala de Morango', 'Bomboniere', 0.2, 120],
  ['Café Torrado 500g', 'Mercearia', 14.9, 16],
  ['Arroz Tipo 1 5kg', 'Mercearia', 25.9, 22],
  ['Feijão Carioca 1kg', 'Mercearia', 8.49, 18],
  ['Açúcar Cristal 1kg', 'Mercearia', 4.79, 34],
  ['Leite Integral 1L', 'Laticínios', 5.99, 12],
  ['Refrigerante Cola 2L', 'Bebidas', 8.99, 9],
  ['Água Mineral 500ml', 'Bebidas', 2, 48],
  ['Detergente Neutro', 'Limpeza', 2.29, 6],
  ['Sabão em pó 800g', 'Limpeza', 9.9, 4],
  ['Papel Higiênico 4un', 'Higiene Pessoal', 7.5, 2],
  ['Absorvente Cotton Line', 'Higiene Pessoal', 3.1, 0],
  ['Tempero Sazón Carne', 'Temperos/Condimentos', 1, 0],
  ['Cigarro Rothmans', 'Tabacaria', 11.5, 5],
  ['Maionese 250g', 'Mercearia', 4.8, 7],
  ['Bolacha Recheada', 'Bomboniere', 3.49, 20],
  ['Banana prata kg', 'Hortifruti', 6.89, 14],
  ['Tomate kg', 'Hortifruti', 7.9, 8],
  ['Cerveja Lata 350ml', 'Bebidas', 5, 24],
  ['Doce de leite pote', 'Bomboniere', 6.5, 3],
  ['Acetona Juliana', 'Cosméticos', 5.2, 19],
];

function makeProduct([name, category, salePrice, quantity], index) {
  return {
    id: `prd_${index + 1}`,
    name,
    category,
    barcode: `789${String(8000000000 + index * 731).padStart(10, '0')}`,
    internal_code: `NX${String(240000 + index * 137)}`,
    sale_price: salePrice,
    cost_price: round(salePrice * 0.62),
    quantity,
    unit: category === 'Hortifruti' ? 'peso' : 'unidade',
    status: 'ativo',
    image_url: '',
    sales_count: Math.max(0, 40 - index),
    last_sale_at: index % 4 === 0 ? addDays(-index, 14, 20) : null,
    created_date: addDays(-40 + index, 9),
    updated_date: nowIso(),
  };
}

function makeSale(number, offsetDays, hour, payment, products) {
  const itemA = products[number % products.length];
  const itemB = products[(number + 3) % products.length];
  const items = [
    saleItem(itemA, 1 + (number % 3)),
    saleItem(itemB, 1),
  ];
  const subtotal = round(items.reduce((sum, item) => sum + item.subtotal, 0));
  const discount = number % 7 === 0 ? 1 : 0;
  const total = round(subtotal - discount);
  const created = addDays(offsetDays, hour, (number * 7) % 55);
  return {
    id: `sale_${number}`,
    sale_number: number,
    seller_id: demoUser.id,
    seller_name: demoUser.full_name,
    market_id: demoUser.market_id,
    unit_id: demoUser.unit_id,
    customer_name: number % 6 === 0 ? 'Cliente fiado' : '',
    status: number % 13 === 0 ? 'cancelada' : 'concluida',
    type: number % 6 === 0 ? 'fiado' : 'normal',
    payment_method: payment,
    payments: [{ method: payment, amount: total }],
    items,
    subtotal,
    discount,
    addition: 0,
    total,
    cash_session_id: 'cash_today',
    created_date: created,
    updated_date: created,
  };
}

function saleItem(product, quantity) {
  return {
    product_id: product.id,
    product_name: product.name,
    name: product.name,
    quantity,
    weight: product.unit === 'peso' ? quantity : null,
    unit: product.unit,
    unit_price: Number(product.sale_price || 0),
    subtotal: round(Number(product.sale_price || 0) * quantity),
  };
}

function seedDb() {
  const products = productNames.map(makeProduct);
  const payments = ['dinheiro', 'pix', 'debito', 'credito'];
  const sales = Array.from({ length: 42 }, (_, index) =>
    makeSale(120 + index, index < 18 ? 0 : -Math.ceil(index / 6), 7 + (index % 11), payments[index % payments.length], products),
  );
  const cashSessions = [
    {
      id: 'cash_today',
      seller_id: demoUser.id,
      seller_name: demoUser.full_name,
      market_id: demoUser.market_id,
      unit_id: demoUser.unit_id,
      unit_name: demoUser.unit_name,
      opening_amount: 89,
      closing_amount: null,
      closing_expense: 0,
      closing_entry: 0,
      status: 'aberto',
      opened_at: addDays(0, 6, 27),
      closed_at: null,
      created_date: addDays(0, 6, 27),
      updated_date: nowIso(),
    },
    {
      id: 'cash_yesterday',
      seller_id: demoUser.id,
      seller_name: demoUser.full_name,
      market_id: demoUser.market_id,
      unit_id: demoUser.unit_id,
      unit_name: demoUser.unit_name,
      opening_amount: 75,
      closing_amount: 352.4,
      closing_expense: 24,
      closing_entry: 12,
      status: 'fechado',
      opened_at: addDays(-1, 6, 40),
      closed_at: addDays(-1, 18, 10),
      created_date: addDays(-1, 6, 40),
      updated_date: addDays(-1, 18, 10),
    },
  ];
  const users = [
    demoUser,
    {
      ...demoUser,
      id: 'usr_vendedor',
      full_name: 'Caliane Santos',
      name: 'Caliane Santos',
      email: 'caliane@nexopdv.local',
      role: 'vendedor',
    },
  ];
  return {
    products,
    sales,
    users,
    cashSessions,
    cashMovements: [
      {
        id: 'mov_1',
        cash_session_id: 'cash_today',
        type: 'entrada',
        amount: 20,
        note: 'Troco adicionado',
        origin: 'manual',
        operator_name: demoUser.full_name,
        created_at: addDays(0, 8, 10),
      },
    ],
    fiados: [
      {
        id: 'fiado_1',
        sale_id: 'sale_126',
        sale_number: 126,
        responsible_name: 'José Almeida',
        phone: '(71) 99999-0001',
        amount: 29.4,
        paid_amount: 10,
        pending_amount: 19.4,
        status: 'pendente',
        created_date: addDays(-2, 15),
      },
    ],
    finance: {
      accounts: [
        {
          id: 'acc_cash',
          name: 'Caixa principal',
          type: 'cash',
          balance: 620.55,
          is_default: true,
          active: true,
        },
        {
          id: 'acc_bank',
          name: 'Conta bancária',
          type: 'bank',
          balance: 2350,
          active: true,
        },
      ],
      categories: [
        { id: 'cat_goods', name: 'Compra de mercadorias', type: 'expense' },
        { id: 'cat_energy', name: 'Energia', type: 'expense' },
        { id: 'cat_sales', name: 'Venda externa', type: 'revenue' },
      ],
      suppliers: [
        { id: 'sup_1', name: 'Distribuidora Bahia', phone: '(71) 3333-1010' },
      ],
      transactions: [
        {
          id: 'trx_1',
          type: 'expense',
          description: 'Compra de mercadorias',
          amount: 380,
          paid_amount: 200,
          status: 'partial',
          due_date: today(),
          payment_method: 'pix',
          category_id: 'cat_goods',
          account_id: 'acc_cash',
          supplier_id: 'sup_1',
          created_date: addDays(-1, 11),
        },
        {
          id: 'trx_2',
          type: 'expense',
          description: 'Conta de energia',
          amount: 180.5,
          paid_amount: 0,
          status: 'pending',
          due_date: localDate(new Date(Date.now() + 3 * 86_400_000)),
          category_id: 'cat_energy',
          account_id: 'acc_bank',
          created_date: addDays(-3, 9),
        },
        {
          id: 'trx_3',
          type: 'revenue',
          description: 'Venda externa',
          amount: 95,
          paid_amount: 95,
          status: 'paid',
          due_date: today(),
          payment_method: 'dinheiro',
          category_id: 'cat_sales',
          account_id: 'acc_cash',
          created_date: addDays(0, 13),
        },
      ],
      purchases: [],
      goals: [],
      recurring: [],
      settings: {
        tax_rate: 0,
        alert_days: 3,
        debit_card_fee: 1.8,
        credit_card_fee: 3.2,
        email_alerts: false,
      },
    },
    systemConfig: [
      { id: 'cfg_1', key: 'nome_mercado', value: demoUser.market_name },
      { id: 'cfg_2', key: 'limite_estoque_baixo', value: '3' },
      { id: 'cfg_3', key: 'limite_vendas_minimizadas', value: '3' },
      {
        id: 'cfg_4',
        key: 'product_categories',
        value: JSON.stringify([
          'Açougue e Frios',
          'Bebidas',
          'Bomboniere',
          'Cosméticos',
          'Higiene Pessoal',
          'Hortifruti',
          'Laticínios',
          'Limpeza',
          'Mercearia',
          'Padaria',
          'Tabacaria',
          'Temperos/Condimentos',
        ]),
      },
    ],
    audits: [],
    productAudits: [],
    stockAlerts: {
      enabled: true,
      schedule: 'weekly',
      recipients: [{ id: 'rcp_1', email: 'admin@nexopdv.local', active: true }],
    },
  };
}

function readDb() {
  const seeded = seedDb();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalizeDb(JSON.parse(raw), seeded);
  } catch {
    /* localStorage opcional */
  }
  const db = normalizeDb(seeded, seeded);
  writeDb(db);
  return db;
}

function normalizeDb(db, seeded = seedDb()) {
  const next = db && typeof db === 'object' ? db : {};
  next.products = Array.isArray(next.products) ? next.products : seeded.products;
  next.sales = Array.isArray(next.sales) ? next.sales : seeded.sales;
  next.cashSessions = Array.isArray(next.cashSessions)
    ? next.cashSessions
    : seeded.cashSessions;
  next.cashMovements = Array.isArray(next.cashMovements)
    ? next.cashMovements
    : seeded.cashMovements;
  next.fiados = Array.isArray(next.fiados) ? next.fiados : seeded.fiados;
  next.users = Array.isArray(next.users) && next.users.length ? next.users : seeded.users;
  next.systemConfig = Array.isArray(next.systemConfig)
    ? next.systemConfig
    : seeded.systemConfig;
  next.audits = Array.isArray(next.audits) ? next.audits : [];
  next.productAudits = Array.isArray(next.productAudits) ? next.productAudits : [];
  next.stockAlerts =
    next.stockAlerts && typeof next.stockAlerts === 'object'
      ? {
          ...seeded.stockAlerts,
          ...next.stockAlerts,
          recipients: Array.isArray(next.stockAlerts.recipients)
            ? next.stockAlerts.recipients
            : seeded.stockAlerts.recipients,
        }
      : seeded.stockAlerts;
  next.finance =
    next.finance && typeof next.finance === 'object'
      ? {
          ...seeded.finance,
          ...next.finance,
          accounts: Array.isArray(next.finance.accounts)
            ? next.finance.accounts
            : seeded.finance.accounts,
          categories: Array.isArray(next.finance.categories)
            ? next.finance.categories
            : seeded.finance.categories,
          suppliers: Array.isArray(next.finance.suppliers)
            ? next.finance.suppliers
            : seeded.finance.suppliers,
          transactions: Array.isArray(next.finance.transactions)
            ? next.finance.transactions
            : seeded.finance.transactions,
          purchases: Array.isArray(next.finance.purchases)
            ? next.finance.purchases
            : [],
          goals: Array.isArray(next.finance.goals) ? next.finance.goals : [],
          recurring: Array.isArray(next.finance.recurring)
            ? next.finance.recurring
            : [],
          settings: {
            ...seeded.finance.settings,
            ...(next.finance.settings || {}),
          },
        }
      : seeded.finance;
  return next;
}

function writeDb(db) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch {
    /* localStorage opcional */
  }
}

function withDb(mutator) {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return delay(clone(result));
}

function delay(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY));
}

function matchesFilters(item, filters = {}) {
  return Object.entries(filters || {}).every(([key, expected]) => {
    if (expected === undefined || expected === null || expected === '') return true;
    return String(item[key] ?? '') === String(expected);
  });
}

function sortItems(items, sort = '-created_date') {
  const desc = String(sort).startsWith('-');
  const key = String(sort).replace(/^-/, '') || 'created_date';
  return [...items].sort((a, b) => {
    const left = a[key] ?? '';
    const right = b[key] ?? '';
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), 'pt-BR', { numeric: true });
    return desc ? -result : result;
  });
}

function collection(db, name) {
  const map = {
    Product: 'products',
    Sale: 'sales',
    FiadoRecord: 'fiados',
    GeneralAudit: 'audits',
    ProductAudit: 'productAudits',
    SystemConfig: 'systemConfig',
    User: 'users',
    Market: 'markets',
  };
  const key = map[name];
  if (key === 'markets') {
    db.markets ||= [{ id: demoUser.market_id, name: demoUser.market_name, status: 'active' }];
  }
  db[key] ||= [];
  return db[key];
}

function entityApi(name) {
  return {
    list: (sort = '-created_date', limit = 500) =>
      withDb((db) => sortItems(collection(db, name), sort).slice(0, limit)),
    filter: (filters, sort = '-created_date', limit = 500) =>
      withDb((db) =>
        sortItems(collection(db, name).filter((item) => matchesFilters(item, filters)), sort).slice(0, limit),
      ),
    get: (itemId) =>
      withDb((db) => collection(db, name).find((item) => item.id === itemId) || null),
    create: (data) =>
      withDb((db) => {
        const item = { id: id(name.toLowerCase()), ...data, created_date: nowIso(), updated_date: nowIso() };
        collection(db, name).unshift(item);
        return item;
      }),
    update: (itemId, data) =>
      withDb((db) => {
        const items = collection(db, name);
        const index = items.findIndex((item) => item.id === itemId);
        if (index < 0) throw new Error('Registro não encontrado.');
        items[index] = { ...items[index], ...data, updated_date: nowIso() };
        return items[index];
      }),
    delete: (itemId) =>
      withDb((db) => {
        const items = collection(db, name);
        const index = items.findIndex((item) => item.id === itemId);
        if (index >= 0) items.splice(index, 1);
        return { ok: true };
      }),
  };
}

function completedSales(db) {
  return db.sales.filter((sale) => sale.status === 'concluida');
}

function saleInRange(sale, from, to) {
  const date = new Date(sale.created_date).getTime();
  return (!from || date >= new Date(from).getTime()) && (!to || date < new Date(to).getTime());
}

function summarizeSales(sales) {
  const payments = {};
  for (const sale of sales) {
    for (const payment of sale.payments || [{ method: sale.payment_method, amount: sale.total }]) {
      payments[payment.method || 'outros'] = round((payments[payment.method || 'outros'] || 0) + Number(payment.amount || 0));
    }
  }
  const total = round(sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0));
  return {
    total,
    gross_total: round(sales.reduce((sum, sale) => sum + Number(sale.subtotal || sale.total || 0), 0)),
    count: sales.length,
    payments,
    cash_sales: payments.dinheiro || 0,
    sales,
    filters: {},
  };
}

function cashSummary(db, session) {
  const sales = completedSales(db).filter((sale) =>
    session.id === 'cash_today'
      ? localDate(new Date(sale.created_date)) === today()
      : sale.cash_session_id === session.id,
  );
  const movements = db.cashMovements.filter((item) => item.cash_session_id === session.id);
  const summary = summarizeSales(sales);
  const entries = round(movements.filter((item) => item.type === 'entrada').reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const withdrawals = round(movements.filter((item) => item.type === 'retirada').reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const opening = Number(session.opening_amount || 0);
  const closingEntry = Number(session.closing_entry || 0);
  const closingExpense = Number(session.closing_expense || 0);
  const expectedCash = round(opening + (summary.payments.dinheiro || 0) + entries - withdrawals + closingEntry - closingExpense);
  const finalAmount = Number(session.closing_amount ?? expectedCash);
  return {
    ...summary,
    opening_amount: opening,
    entries,
    withdrawals,
    movements,
    closing_entry: closingEntry,
    closing_expense: closingExpense,
    expected_cash: expectedCash,
    expected_cash_before_expense: round(opening + (summary.payments.dinheiro || 0) + entries - withdrawals),
    final_amount: finalAmount,
    difference: round(finalAmount - expectedCash),
  };
}

function filterSales(db, filters = {}) {
  const query = normalize(filters.search);
  return db.sales.filter((sale) => {
    const text = normalize(`${sale.sale_number} ${sale.seller_name} ${sale.payment_method} ${sale.customer_name}`);
    return (
      (!query || text.includes(query)) &&
      (!filters.sellerId || sale.seller_id === filters.sellerId) &&
      (!filters.payment || (sale.payments || []).some((payment) => payment.method === filters.payment)) &&
      (!filters.status || sale.status === filters.status) &&
      saleInRange(sale, filters.from, filters.to)
    );
  });
}

function financeBootstrap(db) {
  const permissionKeys = [
    'view',
    'create',
    'edit',
    'pay',
    'view_profit',
    'view_costs',
    'export',
    'manage_suppliers',
    'manage_accounts',
    'manage_purchases',
    'approve_payments',
    'cancel',
    'manage_settings',
    'manage_permissions',
  ];
  return {
    accounts: db.finance.accounts,
    categories: db.finance.categories,
    suppliers: db.finance.suppliers,
    recurring: db.finance.recurring,
    settings: db.finance.settings,
    users: mockUsers(db).map((user) => ({
      ...user,
      permissions: Object.fromEntries(permissionKeys.map((key) => [key, true])),
    })),
    permissions: Object.fromEntries(permissionKeys.map((key) => [key, true])),
    permission_keys: permissionKeys,
    enabled_features: demoUser.enabled_features,
  };
}

function mockUsers(db) {
  return Array.isArray(db.users) && db.users.length ? db.users : [demoUser];
}

function financeDashboard(db) {
  const sales = completedSales(db);
  const revenue = round(sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0));
  const expenses = round(
    db.finance.transactions
      .filter((item) => item.type === 'expense' && item.status !== 'cancelled')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  );
  const series = Array.from({ length: 7 }, (_, index) => {
    const date = localDate(new Date(Date.now() - (6 - index) * 86_400_000));
    const dayRevenue = round(sales.filter((sale) => localDate(new Date(sale.created_date)) === date).reduce((sum, sale) => sum + Number(sale.total || 0), 0));
    return { date, revenue: dayRevenue, expense: index % 3 === 0 ? 40 : 0, profit: round(dayRevenue - (index % 3 === 0 ? 40 : 0)) };
  });
  return {
    summary: {
      gross_revenue: revenue,
      net_revenue: revenue,
      expenses,
      estimated_profit: round(revenue - expenses),
      margin: revenue ? round(((revenue - expenses) / revenue) * 100) : 0,
      cogs: round(revenue * 0.62),
      inventory_value: round(db.products.reduce((sum, product) => sum + Number(product.cost_price || 0) * Number(product.quantity || 0), 0)),
      receivables: round(db.fiados.reduce((sum, item) => sum + Number(item.pending_amount || 0), 0)),
      payables: round(db.finance.transactions.filter((item) => item.type === 'expense' && item.status !== 'paid').reduce((sum, item) => sum + Number(item.amount || 0) - Number(item.paid_amount || 0), 0)),
    },
    series,
    accounts: db.finance.accounts,
    top_products: db.products.slice(0, 5),
    top_categories: [],
    goals: db.finance.goals,
    dre: [],
  };
}

function transactionList(db, filters = {}) {
  const items = db.finance.transactions.filter((item) => {
    const text = normalize(`${item.description} ${item.status} ${item.type}`);
    return (
      (!filters.search || text.includes(normalize(filters.search))) &&
      (!filters.type || item.type === filters.type) &&
      (!filters.status || item.status === filters.status)
    );
  });
  return {
    items,
    total: items.length,
    page: Number(filters.page || 1),
    page_count: 1,
    summary: {
      total: round(items.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
      paid: round(items.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0)),
      pending: round(items.reduce((sum, item) => sum + Number(item.amount || 0) - Number(item.paid_amount || 0), 0)),
    },
  };
}

export const mockNexoApi = {
  entities: Object.fromEntries(
    ['Product', 'Sale', 'FiadoRecord', 'GeneralAudit', 'ProductAudit', 'SystemConfig', 'User', 'Market'].map((name) => [name, entityApi(name)]),
  ),
  cache: {
    clear: () => {},
    resetMock: () => {
      localStorage.removeItem(STORE_KEY);
      return readDb();
    },
  },
  auth: {
    me: () => delay(sessionUserFallback()),
    login: (email = '', _password = '', _remember = true) =>
      delay({
        user: String(email).toLowerCase().includes('super')
          ? { ...mockSuperUser }
          : { ...demoUser },
      }),
    logout: async (redirect) => {
      if (redirect) window.location.href = redirect;
      return { ok: true };
    },
  },
  users: {
    create: (data) =>
      withDb((db) => {
        const user = { id: id('usr'), market_id: demoUser.market_id, unit_id: demoUser.unit_id, ...data };
        db.users.push(user);
        return user;
      }),
  },
  markets: {
    list: () => delay([{ id: demoUser.market_id, name: demoUser.market_name, status: 'active' }]),
    create: (data) => delay({ id: id('market'), ...data }),
    update: (marketId, data) => delay({ id: marketId, ...data }),
    detail: (marketId) => delay({ id: marketId, name: demoUser.market_name }),
    close: () => delay({ ok: true }),
  },
  products: {
    catalog: (limit = 1000) =>
      withDb((db) => sortItems(db.products, 'name').slice(0, limit)),
    lookupBarcode: (barcode) =>
      withDb((db) => db.products.find((product) => product.barcode === barcode) || null),
    quickCreate: (barcode, name, salePrice) =>
      withDb((db) => {
        const product = makeProduct([name, 'Sem categoria', Number(salePrice || 0), 0], db.products.length);
        product.barcode = barcode;
        db.products.unshift(product);
        return product;
      }),
    deleteInactive: () =>
      withDb((db) => {
        const before = db.products.length;
        db.products = db.products.filter((product) => product.status !== 'inativo');
        return { deleted: before - db.products.length };
      }),
  },
  stock: {
    bulkUpdate: (products) =>
      withDb((db) => {
        for (const product of products || []) {
          const existing = db.products.find((item) => item.id === product.id || item.barcode === product.barcode);
          if (existing) Object.assign(existing, product, { updated_date: nowIso() });
          else db.products.push({ id: id('prd'), status: 'ativo', created_date: nowIso(), ...product });
        }
        return { imported: products?.length || 0, updated: products?.length || 0, created: 0, errors: [] };
      }),
  },
  stockAlerts: {
    settings: () => withDb((db) => db.stockAlerts),
    updateSettings: (settings) => withDb((db) => (db.stockAlerts = { ...db.stockAlerts, ...settings })),
    preview: () => withDb((db) => ({ products: db.products.filter((product) => Number(product.quantity || 0) <= 3), count: db.products.filter((product) => Number(product.quantity || 0) <= 3).length })),
    addRecipient: (data) => withDb((db) => {
      const recipient = { id: id('rcp'), active: true, ...data };
      db.stockAlerts.recipients.push(recipient);
      return recipient;
    }),
    updateRecipient: (recipientId, data) => withDb((db) => {
      const recipient = db.stockAlerts.recipients.find((item) => item.id === recipientId);
      Object.assign(recipient, data);
      return recipient;
    }),
    removeRecipient: (recipientId) => withDb((db) => {
      db.stockAlerts.recipients = db.stockAlerts.recipients.filter((item) => item.id !== recipientId);
      return { ok: true };
    }),
    test: () => withDb((db) => ({ ok: true, product_count: db.products.filter((product) => Number(product.quantity || 0) <= 3).length })),
  },
  maintenance: {
    reset: () => delay({ ok: true }),
  },
  cash: {
    current: () =>
      withDb((db) => {
        const session = db.cashSessions.find((item) => item.status === 'aberto') || null;
        return {
          required: true,
          market_requires_cash: true,
          session,
          summary: session ? cashSummary(db, session) : null,
        };
      }),
    open: (openingAmount) =>
      withDb((db) => {
        const session = {
          id: id('cash'),
          seller_id: demoUser.id,
          seller_name: demoUser.full_name,
          unit_id: demoUser.unit_id,
          unit_name: demoUser.unit_name,
          opening_amount: round(openingAmount),
          status: 'aberto',
          opened_at: nowIso(),
          created_date: nowIso(),
        };
        db.cashSessions.unshift(session);
        return { session, summary: cashSummary(db, session) };
      }),
    close: (closingAmount, closingExpense = 0, closingEntry = 0) =>
      withDb((db) => {
        const session = db.cashSessions.find((item) => item.status === 'aberto');
        if (!session) throw new Error('Nenhum caixa aberto.');
        Object.assign(session, {
          status: 'fechado',
          closing_amount: round(closingAmount),
          closing_expense: round(closingExpense),
          closing_entry: round(closingEntry),
          closed_at: nowIso(),
          updated_date: nowIso(),
        });
        return { session, summary: cashSummary(db, session) };
      }),
    update: (cashId, data) =>
      withDb((db) => {
        const session = db.cashSessions.find((item) => item.id === cashId);
        Object.assign(session, data, { updated_date: nowIso() });
        return { session, summary: cashSummary(db, session) };
      }),
    reopen: (cashId) =>
      withDb((db) => {
        const session = db.cashSessions.find((item) => item.id === cashId);
        Object.assign(session, { status: 'aberto', closed_at: null, updated_date: nowIso() });
        return { session, summary: cashSummary(db, session) };
      }),
    updateSettings: () => delay({ ok: true }),
    history: ({ page = 1, pageSize = 20, from = '', to = '', operatorId = '', status = '', unitId = '' } = {}) =>
      withDb((db) => {
        const items = db.cashSessions
          .filter((session) => (!operatorId || session.seller_id === operatorId) && (!status || session.status === status) && (!unitId || session.unit_id === unitId) && saleInRange({ created_date: session.opened_at }, from, to))
          .map((session) => {
            const summary = cashSummary(db, session);
            return {
              ...session,
              summary,
              total_sales: summary.total,
              entries: summary.entries + Number(session.closing_entry || 0),
              withdrawals: summary.withdrawals + Number(session.closing_expense || 0),
              final_amount: summary.final_amount,
              difference: summary.difference,
            };
          });
        const start = (page - 1) * pageSize;
        return {
          items: items.slice(start, start + pageSize),
          total: items.length,
          page_count: Math.max(1, Math.ceil(items.length / pageSize)),
          operators: mockUsers(db).map((user) => ({ id: user.id, name: user.full_name || user.email })),
          units: [{ id: demoUser.unit_id, name: demoUser.unit_name }],
        };
      }),
    detail: (cashId) =>
      withDb((db) => {
        const session = db.cashSessions.find((item) => item.id === cashId);
        return { session, summary: cashSummary(db, session) };
      }),
    remove: (cashId) =>
      withDb((db) => {
        db.cashSessions = db.cashSessions.filter((item) => item.id !== cashId);
        return { ok: true };
      }),
    addMovement: (cashId, data) =>
      withDb((db) => {
        const movement = {
          id: id('mov'),
          cash_session_id: cashId,
          type: data.type,
          amount: round(data.amount),
          note: data.note || '',
          origin: 'manual',
          operator_name: demoUser.full_name,
          created_at: nowIso(),
        };
        db.cashMovements.push(movement);
        return movement;
      }),
  },
  sales: {
    complete: (data) =>
      withDb((db) => {
        const number = Math.max(0, ...db.sales.map((sale) => Number(sale.sale_number || 0))) + 1;
        const items = (data.items || []).map((item) => ({
          ...item,
          product_name: item.product_name || item.name,
          subtotal: round(Number(item.subtotal || 0)),
        }));
        const subtotal = round(items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
        const discount = round(data.discount || 0);
        const total = round(data.total ?? subtotal - discount + Number(data.addition || 0));
        const paymentMethod = data.payment_method || data.paymentMethod || data.payments?.[0]?.method || 'dinheiro';
        const currentCash = db.cashSessions.find((item) => item.status === 'aberto');
        const sale = {
          id: id('sale'),
          sale_number: number,
          seller_id: demoUser.id,
          seller_name: demoUser.full_name,
          status: paymentMethod === 'fiado' ? 'pendente' : 'concluida',
          type: paymentMethod === 'fiado' ? 'fiado' : 'normal',
          payment_method: paymentMethod,
          payments: data.payments || [{ method: paymentMethod, amount: total }],
          items,
          subtotal,
          discount,
          addition: round(data.addition || 0),
          total,
          cash_session_id: currentCash?.id,
          customer_name: data.customer_name || data.customerName || '',
          created_date: nowIso(),
          updated_date: nowIso(),
        };
        db.sales.unshift(sale);
        for (const item of items) {
          const product = db.products.find((candidate) => candidate.id === item.product_id);
          if (product) {
            product.quantity = round(Number(product.quantity || 0) - Number(item.quantity || item.weight || 0));
            product.sales_count = round(Number(product.sales_count || 0) + Number(item.quantity || item.weight || 0));
            product.last_sale_at = sale.created_date;
          }
        }
        if (paymentMethod === 'fiado') {
          db.fiados.unshift({
            id: id('fiado'),
            sale_id: sale.id,
            sale_number: sale.sale_number,
            responsible_name: sale.customer_name || 'Cliente fiado',
            amount: total,
            paid_amount: 0,
            pending_amount: total,
            status: 'pendente',
            created_date: sale.created_date,
          });
        }
        return sale;
      }),
    nextNumber: () =>
      withDb((db) => ({ sale_number: Math.max(0, ...db.sales.map((sale) => Number(sale.sale_number || 0))) + 1 })),
    list: (filters = {}) =>
      withDb((db) => {
        const page = Number(filters.page || 1);
        const pageSize = Number(filters.pageSize || 20);
        const items = sortItems(filterSales(db, filters), '-created_date');
        const start = (page - 1) * pageSize;
        return {
          items: items.slice(start, start + pageSize),
          total: items.length,
          page_count: Math.max(1, Math.ceil(items.length / pageSize)),
          summary: summarizeSales(items.filter((sale) => sale.status === 'concluida')),
          sellers: mockUsers(db).map((user) => ({ id: user.id, name: user.full_name || user.email })),
        };
      }),
    report: (filters) =>
      withDb((db) => {
        const sales = filterSales(db, filters).filter((sale) => sale.status === 'concluida');
        return { sales, summary: summarizeSales(sales), filters };
      }),
    cancel: (saleId) =>
      withDb((db) => {
        const sale = db.sales.find((item) => item.id === saleId);
        if (sale) sale.status = 'cancelada';
        return sale;
      }),
    delete: (saleId) =>
      withDb((db) => {
        db.sales = db.sales.filter((sale) => sale.id !== saleId);
        return { ok: true };
      }),
  },
  finance: {
    bootstrap: () => withDb(financeBootstrap),
    products: () => withDb((db) => db.products),
    dashboard: () => withDb(financeDashboard),
    ledger: (filters) => withDb((db) => transactionList(db, filters)),
    receivables: (filters) => withDb((db) => transactionList(db, { ...filters, type: 'revenue' })),
    reconciliation: () => withDb((db) => ({ items: db.finance.transactions, summary: { pending: 0, matched: db.finance.transactions.length } })),
    history: (limit = 100) => withDb((db) => db.finance.transactions.slice(0, limit)),
    transactions: {
      list: (filters) => withDb((db) => transactionList(db, filters)),
      detail: (transactionId) => withDb((db) => db.finance.transactions.find((item) => item.id === transactionId)),
      create: (data) => withDb((db) => {
        const item = { id: id('trx'), status: 'pending', paid_amount: 0, created_date: nowIso(), ...data };
        db.finance.transactions.unshift(item);
        return item;
      }),
      update: (transactionId, data) => withDb((db) => {
        const item = db.finance.transactions.find((candidate) => candidate.id === transactionId);
        Object.assign(item, data, { updated_date: nowIso() });
        return item;
      }),
      pay: (transactionId, data) => withDb((db) => {
        const item = db.finance.transactions.find((candidate) => candidate.id === transactionId);
        item.paid_amount = round(Number(item.paid_amount || 0) + Number(data.amount || item.amount || 0));
        item.status = item.paid_amount >= Number(item.amount || 0) ? 'paid' : 'partial';
        item.paid_at = nowIso();
        return item;
      }),
      cancel: (transactionId) => withDb((db) => {
        const item = db.finance.transactions.find((candidate) => candidate.id === transactionId);
        item.status = 'cancelled';
        return item;
      }),
      duplicate: (transactionId) => withDb((db) => {
        const item = db.finance.transactions.find((candidate) => candidate.id === transactionId);
        const copy = { ...item, id: id('trx'), status: 'pending', paid_amount: 0, created_date: nowIso() };
        db.finance.transactions.unshift(copy);
        return copy;
      }),
      batch: (data) => withDb((db) => {
        const items = (data.items || []).map((item) => ({ id: id('trx'), status: 'pending', paid_amount: 0, created_date: nowIso(), ...item }));
        db.finance.transactions.unshift(...items);
        return { created: items.length, items };
      }),
    },
    categories: {
      create: (data) => withDb((db) => {
        const item = { id: id('cat'), ...data };
        db.finance.categories.push(item);
        return item;
      }),
      update: (categoryId, data) => withDb((db) => {
        const item = db.finance.categories.find((candidate) => candidate.id === categoryId);
        Object.assign(item, data);
        return item;
      }),
      remove: (categoryId) => withDb((db) => {
        db.finance.categories = db.finance.categories.filter((item) => item.id !== categoryId);
        return { ok: true };
      }),
    },
    suppliers: {
      create: (data) => withDb((db) => {
        const item = { id: id('sup'), ...data };
        db.finance.suppliers.push(item);
        return item;
      }),
      update: (supplierId, data) => withDb((db) => {
        const item = db.finance.suppliers.find((candidate) => candidate.id === supplierId);
        Object.assign(item, data);
        return item;
      }),
      remove: (supplierId) => withDb((db) => {
        db.finance.suppliers = db.finance.suppliers.filter((item) => item.id !== supplierId);
        return { ok: true };
      }),
    },
    accounts: {
      create: (data) => withDb((db) => {
        const item = { id: id('acc'), active: true, ...data };
        db.finance.accounts.push(item);
        return item;
      }),
      update: (accountId, data) => withDb((db) => {
        const item = db.finance.accounts.find((candidate) => candidate.id === accountId);
        Object.assign(item, data);
        return item;
      }),
    },
    recurring: {
      create: (data) => withDb((db) => {
        const item = { id: id('rec'), active: true, ...data };
        db.finance.recurring.push(item);
        return item;
      }),
      update: (recurringId, data) => withDb((db) => {
        const item = db.finance.recurring.find((candidate) => candidate.id === recurringId);
        Object.assign(item, data);
        return item;
      }),
    },
    purchases: {
      list: () => withDb((db) => db.finance.purchases),
      create: (data) => withDb((db) => {
        const item = { id: id('pur'), status: 'draft', purchase_number: db.finance.purchases.length + 1, created_date: nowIso(), ...data };
        db.finance.purchases.unshift(item);
        return item;
      }),
      confirm: (purchaseId) => withDb((db) => {
        const item = db.finance.purchases.find((candidate) => candidate.id === purchaseId);
        item.status = 'confirmed';
        return item;
      }),
      cancel: (purchaseId) => withDb((db) => {
        const item = db.finance.purchases.find((candidate) => candidate.id === purchaseId);
        item.status = 'cancelled';
        return item;
      }),
    },
    goals: {
      create: (data) => withDb((db) => {
        const item = { id: id('goal'), ...data };
        db.finance.goals.push(item);
        return item;
      }),
      update: (goalId, data) => withDb((db) => {
        const item = db.finance.goals.find((candidate) => candidate.id === goalId);
        Object.assign(item, data);
        return item;
      }),
      remove: (goalId) => withDb((db) => {
        db.finance.goals = db.finance.goals.filter((item) => item.id !== goalId);
        return { ok: true };
      }),
    },
    settings: {
      update: (data) => withDb((db) => (db.finance.settings = { ...db.finance.settings, ...data })),
    },
    permissions: {
      update: () => delay({ ok: true }),
    },
  },
  admin: {
    overview: () => delay({ markets: 1, users: 2, revenue: 0 }),
    plans: {
      list: () => delay([]),
      create: (data) => delay({ id: id('plan'), ...data }),
      update: (planId, data) => delay({ id: planId, ...data }),
      delete: () => delay({ ok: true }),
    },
    subscriptions: { list: () => delay([]), update: (subscriptionId, data) => delay({ id: subscriptionId, ...data }) },
    payments: { list: () => delay([]), create: (data) => delay({ id: id('pay'), ...data }) },
    reports: () => delay({}),
    logs: () => delay([]),
    settings: { get: () => delay({}), update: (data) => delay(data) },
  },
};
