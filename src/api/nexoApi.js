const request = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      ...options,
      body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    throw Object.assign(new Error('Não foi possível conectar ao servidor.'), {
      code: 'NETWORK_ERROR',
      cause,
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.message || 'Erro ao acessar o servidor.'), {
      status: response.status,
      code: data.code,
      requestId: data.requestId,
    });
  }
  return data;
};

const entity = name => ({
  list: (sort = '-created_date', limit = 500) => request(`/entities/${name}?sort=${encodeURIComponent(sort)}&limit=${limit}`),
  filter: (filters, sort = '-created_date', limit = 500) => request(`/entities/${name}?filters=${encodeURIComponent(JSON.stringify(filters))}&sort=${encodeURIComponent(sort)}&limit=${limit}`),
  get: id => request(`/entities/${name}/${id}`),
  create: data => request(`/entities/${name}`, { method: 'POST', body: data }),
  update: (id, data) => request(`/entities/${name}/${id}`, { method: 'PATCH', body: data }),
  delete: id => request(`/entities/${name}/${id}`, { method: 'DELETE' }),
});

const entityNames = ['Product', 'Sale', 'FiadoRecord', 'GeneralAudit', 'ProductAudit', 'SystemConfig', 'User', 'Market'];

export const nexoApi = {
  entities: Object.fromEntries(entityNames.map(name => [name, entity(name)])),
  auth: {
    me: () => request('/auth/me'),
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    logout: async redirect => { await request('/auth/logout', { method: 'POST' }); if (redirect) window.location.href = redirect; },
  },
  users: { create: data => request('/users', { method: 'POST', body: data }) },
  markets: {
    list: () => request('/markets'),
    create: data => request('/markets', { method: 'POST', body: data }),
    update: (id, data) => request(`/markets/${id}`, { method: 'PATCH', body: data }),
  },
  stock: { bulkUpdate: products => request('/stock/import', { method: 'POST', body: { products } }) },
  sales: {
    complete: data => request('/sales/complete', { method: 'POST', body: data }),
    nextNumber: () => request('/sales/next'),
    cancel: (id, reason) => request(`/sales/${id}/cancel`, { method: 'POST', body: { reason } }),
    delete: id => request(`/sales/${id}`, { method: 'DELETE' }),
  },
};
