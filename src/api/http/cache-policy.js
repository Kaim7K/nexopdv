const GLOBAL_INVALIDATION = /^\/(auth|admin|markets|users|maintenance)(\/|$)/;

const INVALIDATION_RULES = [
  { matches: (path) => path.startsWith('/finance'), scopes: ['/finance'] },
  {
    matches: (path) => /^\/(products|stock)(\/|$)/.test(path) || path.startsWith('/entities/Product'),
    scopes: ['/products', '/entities/Product', '/finance'],
  },
  {
    matches: (path) => path.startsWith('/sales') || path.startsWith('/entities/Sale'),
    scopes: ['/sales', '/entities/Sale', '/finance', '/cash', '/products/catalog'],
  },
  { matches: (path) => path.startsWith('/entities/FiadoRecord'), scopes: ['/entities/FiadoRecord', '/finance'] },
  { matches: (path) => path.startsWith('/cash'), scopes: ['/cash', '/finance'] },
  { matches: (path) => path.startsWith('/stock-alerts'), scopes: ['/stock-alerts'] },
  {
    matches: (path) => path.startsWith('/entities/SystemConfig'),
    scopes: ['/entities/SystemConfig', '/stock-alerts', '/system/appearance'],
  },
];

export function createResponseCache({ maxEntries = 160 } = {}) {
  const entries = new Map();
  let revision = 0;

  function prune() {
    const now = Date.now();
    for (const [key, cached] of entries) {
      if (!cached || cached.expiresAt <= now) entries.delete(key);
    }
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  }

  function clear(path = '') {
    revision++;
    if (!path || GLOBAL_INVALIDATION.test(path)) {
      entries.clear();
      return;
    }
    const scopes = INVALIDATION_RULES.find((rule) => rule.matches(path))?.scopes || [path.split('/').slice(0, 3).join('/')];
    for (const key of entries.keys()) {
      if (scopes.some((scope) => key.startsWith(`GET:${scope}`))) entries.delete(key);
    }
  }

  return {
    clear,
    get revision() { return revision; },
    getCatalog(path) {
      const requested = /^\/products\/catalog\?limit=([1-9]\d*)$/.exec(path);
      if (!requested || Number(requested[1]) > 3000) return undefined;
      prune();
      const limit = Number(requested[1]);
      for (const [key, cached] of entries) {
        const previous = /^GET:\/products\/catalog\?limit=([1-9]\d*)$/.exec(key);
        if (!previous || Number(previous[1]) > 3000 || !Array.isArray(cached.data)) continue;
        const previousLimit = Number(previous[1]);
        if (previousLimit >= limit || cached.data.length < previousLimit) return cached.data.slice(0, limit);
      }
      return undefined;
    },
    get(key) {
      prune();
      const cached = entries.get(key);
      return cached?.expiresAt > Date.now() ? cached.data : undefined;
    },
    set(key, data, ttl) {
      entries.set(key, { data, expiresAt: Date.now() + ttl });
      prune();
    },
  };
}
