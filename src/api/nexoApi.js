const responseCache = new Map();
const inFlightRequests = new Map();

function invalidateCache() {
  responseCache.clear();
}

async function performRequest(path, options = {}) {
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 30_000);
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      headers: options.body instanceof FormData
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...options,
      signal: options.signal || controller.signal,
      body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    const timedOut = cause?.name === 'AbortError';
    throw Object.assign(new Error(timedOut ? 'O servidor demorou para responder. Tente novamente.' : 'Não foi possível conectar ao servidor.'), {
      code: timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      cause,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/me') && typeof window !== 'undefined') {
      responseCache.clear();
      window.dispatchEvent(new CustomEvent('nexo:session-expired'));
    }
    throw Object.assign(new Error(data.message || 'Erro ao acessar o servidor.'), {
      status: response.status,
      code: data.code,
      requestId: data.requestId,
      data,
    });
  }
  return data;
}

const request = (path, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const cacheTTL = method === 'GET' ? Number(options.cacheTTL || 0) : 0;
  const cacheKey = `${method}:${path}`;

  if (cacheTTL > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
    if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey);
  }

  const promise = performRequest(path, options).then(data => {
    if (method === 'GET' && cacheTTL > 0) responseCache.set(cacheKey, { data, expiresAt: Date.now() + cacheTTL });
    if (method !== 'GET') invalidateCache();
    return data;
  }).finally(() => inFlightRequests.delete(cacheKey));

  if (cacheTTL > 0) inFlightRequests.set(cacheKey, promise);
  return promise;
};

const entity = name => ({
  list: (sort = '-created_date', limit = 500) => request(`/entities/${name}?sort=${encodeURIComponent(sort)}&limit=${limit}`, { cacheTTL: name === 'SystemConfig' ? 45_000 : name === 'Product' ? 20_000 : 8_000 }),
  filter: (filters, sort = '-created_date', limit = 500) => request(`/entities/${name}?filters=${encodeURIComponent(JSON.stringify(filters))}&sort=${encodeURIComponent(sort)}&limit=${limit}`, { cacheTTL: name === 'SystemConfig' ? 45_000 : 8_000 }),
  get: id => request(`/entities/${name}/${id}`, { cacheTTL: 10_000 }),
  create: data => request(`/entities/${name}`, { method: 'POST', body: data }),
  update: (id, data) => request(`/entities/${name}/${id}`, { method: 'PATCH', body: data }),
  delete: id => request(`/entities/${name}/${id}`, { method: 'DELETE' }),
});

const entityNames = ['Product', 'Sale', 'FiadoRecord', 'GeneralAudit', 'ProductAudit', 'SystemConfig', 'User', 'Market'];

export const nexoApi = {
  entities: Object.fromEntries(entityNames.map(name => [name, entity(name)])),
  cache: { clear: invalidateCache },
  auth: {
    me: () => request('/auth/me', { cacheTTL: 15_000 }),
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    logout: async redirect => { await request('/auth/logout', { method: 'POST' }); if (redirect) window.location.href = redirect; },
  },
  users: { create: data => request('/users', { method: 'POST', body: data }) },
  markets: {
    list: () => request('/markets', { cacheTTL: 15_000 }),
    create: data => request('/markets', { method: 'POST', body: data }),
    update: (id, data) => request(`/markets/${id}`, { method: 'PATCH', body: data }),
  },
  products: {
    catalog: (limit = 1000) => request(`/products/catalog?limit=${limit}`, { cacheTTL: 20_000 }),
    lookupBarcode: barcode => request(`/products/barcode-lookup?barcode=${encodeURIComponent(barcode)}`, { cacheTTL: 86_400_000 }),
    deleteInactive: () => request('/products/delete-inactive', { method: 'POST', body: { confirmation: 'APAGAR_INATIVOS' }, timeout: 60_000 }),
  },
  stock: { bulkUpdate: (products, existingMode = 'update') => request('/stock/import', { method: 'POST', body: { products, existing_mode: existingMode }, timeout: 60_000 }) },
  stockAlerts: {
    settings: () => request('/stock-alerts/settings', { cacheTTL: 10_000 }),
    updateSettings: settings => request('/stock-alerts/settings', { method:'PATCH', body:settings }),
    preview: () => request('/stock-alerts/preview'),
    addRecipient: data => request('/stock-alerts/recipients', { method:'POST', body:data }),
    updateRecipient: (id, data) => request(`/stock-alerts/recipients/${id}`, { method:'PATCH', body:data }),
    removeRecipient: id => request(`/stock-alerts/recipients/${id}`, { method:'DELETE' }),
    test: email => request('/stock-alerts/test', { method:'POST', body:{ email }, timeout:60_000 }),
  },
  maintenance: {
    reset: (target, confirmation) => request('/maintenance/reset', { method: 'POST', body: { target, confirmation }, timeout: 60_000 }),
  },
  cash: {
    current: () => request('/cash/current', { cacheTTL: 5_000 }),
    open: openingAmount => request('/cash/open', { method: 'POST', body: { opening_amount: openingAmount } }),
    close: closingAmount => request('/cash/close', { method: 'POST', body: { closing_amount: closingAmount } }),
    updateSettings: requireCashRegister => request('/cash/settings', { method: 'PATCH', body: { require_cash_register: requireCashRegister } }),
  },
  sales: {
    complete: data => request('/sales/complete', { method: 'POST', body: data }),
    nextNumber: () => request('/sales/next', { cacheTTL: 3_000 }),
    list: ({ page = 1, pageSize = 20, search = '', sellerId = '', payment = '', status = '', from = '', to = '', includeSellers = false } = {}) => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (search) params.set('search', search);
      if (sellerId) params.set('seller_id', sellerId);
      if (payment) params.set('payment', payment);
      if (status) params.set('status', status);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (includeSellers) params.set('include_sellers', '1');
      return request(`/sales/list?${params.toString()}`, { cacheTTL: 5_000 });
    },
    report: ({ from, to, sellerId = '', payment = '' }) => {
      const params = new URLSearchParams({ from, to });
      if (sellerId) params.set('seller_id', sellerId);
      if (payment) params.set('payment', payment);
      return request(`/sales/report?${params.toString()}`, { cacheTTL: 5_000 });
    },
    cancel: (id, reason) => request(`/sales/${id}/cancel`, { method: 'POST', body: { reason } }),
    delete: id => request(`/sales/${id}`, { method: 'DELETE' }),
  },
};
