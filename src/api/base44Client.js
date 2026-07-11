// Cliente compatível com a API antiga, agora atendido pelas funções serverless do Nexo PDV.
const request = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || 'Erro ao acessar o servidor'), { status: response.status });
  return data;
};

const entity = (name) => ({
  list: (sort = '-created_date', limit = 500) => request(`/entities/${name}?sort=${encodeURIComponent(sort)}&limit=${limit}`),
  filter: (filters, sort = '-created_date', limit = 500) => request(`/entities/${name}?filters=${encodeURIComponent(JSON.stringify(filters))}&sort=${encodeURIComponent(sort)}&limit=${limit}`),
  get: (id) => request(`/entities/${name}/${id}`),
  create: (data) => request(`/entities/${name}`, { method: 'POST', body: data }),
  update: (id, data) => request(`/entities/${name}/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/entities/${name}/${id}`, { method: 'DELETE' }),
});

const entityNames = ['Product', 'Sale', 'FiadoRecord', 'GeneralAudit', 'ProductAudit', 'SystemConfig', 'User', 'Market'];

export const base44 = {
  entities: Object.fromEntries(entityNames.map(name => [name, entity(name)])),
  auth: {
    me: () => request('/auth/me'),
    loginViaEmailPassword: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    logout: async (redirect) => { await request('/auth/logout', { method: 'POST' }); if (redirect) window.location.href = redirect; },
    resetPasswordRequest: () => Promise.reject(new Error('Solicite a redefinição ao administrador do seu mercado.')),
  },
  users: { create: (data) => request('/users', { method: 'POST', body: data }) },
  markets: {
    list: () => request('/markets'),
    create: (data) => request('/markets', { method: 'POST', body: data }),
    update: (id, data) => request(`/markets/${id}`, { method: 'PATCH', body: data }),
  },
  stock: { bulkUpdate: (products) => request('/stock/import', { method: 'POST', body: { products } }) },
  sales: {
    complete: (data) => request('/sales/complete', { method: 'POST', body: data }),
    nextNumber: () => request('/sales/next'),
    cancel: (id, reason) => request(`/sales/${id}/cancel`, { method: 'POST', body: { reason } }),
    delete: (id) => request(`/sales/${id}`, { method: 'DELETE' }),
  },
  integrations: { Core: { UploadFile: async () => { throw new Error('Use uma URL de imagem ou configure armazenamento externo.'); } } },
};
