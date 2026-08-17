const ENTITY_MODULES = {
  Sale: 'vendas',
  FiadoRecord: 'fiados',
  User: 'usuarios',
};

function cashModule(action) {
  return ['current', 'open', 'close', 'settings'].includes(action)
    ? 'pdv'
    : 'caixas';
}

function salesModule(action) {
  if (['complete', 'next'].includes(action)) return 'pdv';
  if (action === 'report') return 'relatorios';
  return 'vendas';
}

function requiredModule(path) {
  const modules = {
    finance: 'financeiro',
    stock: 'estoque',
    'stock-alerts': 'configuracoes',
    cash: cashModule(path[1]),
    sales: salesModule(path[1]),
    users: 'usuarios',
    maintenance: 'configuracoes',
    entities: ENTITY_MODULES[path[1]],
  };
  if (['products', 'product-media'].includes(path[0])) return null;
  return modules[path[0]] || null;
}

function requiredOptions(path, method) {
  const isEntityRead = path[0] === 'entities' && method === 'GET';
  if (isEntityRead && path[1] === 'Sale') return ['vendas', 'relatorios'];
  if (isEntityRead && path[1] === 'FiadoRecord') return ['fiados', 'relatorios'];
  const module = requiredModule(path);
  return module ? [module] : [];
}

export function moduleAccessError(user, path, method) {
  if (user.role === 'super_admin') return null;
  const enabled = user.enabled_modules || [];
  const options = requiredOptions(path, method);
  if (options.length && !options.some((module) => enabled.includes(module))) {
    return 'Esta funcionalidade não está habilitada para o mercado.';
  }
  const isProductEntity = path[0] === 'entities' && path[1] === 'Product';
  if (isProductEntity && !['pdv', 'estoque'].some((module) => enabled.includes(module))) {
    return 'Produtos não estão habilitados para o mercado.';
  }
  return null;
}
