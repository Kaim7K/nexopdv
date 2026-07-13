import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const catalog = read('src/lib/market-modules.js');
const migration = read('database/migrations/014_plan_features.sql');
const api = read('api/index.js');
const auth = read('server/auth.js');
const plans = read('src/pages/AdminPlanos.jsx');
const markets = read('src/pages/AdminMercados.jsx');
const settings = read('src/pages/Configuracoes.jsx');
const products = read('src/components/stock/ProductForm.jsx');

const features = [
  'email_sending',
  'email_branding',
  'market_logo',
  'sidebar_customization',
  'automatic_image_search',
  'product_image_upload',
  'stock_email_alerts',
  'quick_product_creation',
  'report_export',
  'recurring_finance',
  'integrated_purchases',
  'financial_email_alerts',
];
for (const feature of features) {
  assert.ok(
    catalog.includes(`key: '${feature}'`),
    `Catálogo não contém ${feature}.`,
  );
  assert.ok(
    migration.includes(`\"${feature}\"`),
    `Migração não habilita ${feature} para clientes existentes.`,
  );
}
assert.match(
  migration,
  /ALTER TABLE nexo\.plans ADD COLUMN IF NOT EXISTS enabled_features/,
);
assert.match(
  migration,
  /ALTER TABLE nexo\.markets ADD COLUMN IF NOT EXISTS enabled_features/,
);
assert.match(
  auth,
  /enabled_features: user\.enabled_features \|\| \[\]/,
  'Sessão não expõe os recursos contratados.',
);
assert.match(
  api,
  /FEATURE_NOT_AVAILABLE/,
  'API não bloqueia recursos ausentes no plano.',
);
assert.match(
  api,
  /hasFeature\(user,\s*'automatic_image_search'\)/,
  'Pesquisa de imagens não está protegida.',
);
assert.match(
  api,
  /hasFeature\(user,\s*'quick_product_creation'\)/,
  'Cadastro rápido não está protegido.',
);
assert.match(
  api,
  /market\.enabled_features \? 'email_sending'/,
  'Envio agendado não respeita o plano.',
);
assert.match(
  plans,
  /Recursos do plano/,
  'Editor de planos não lista recursos específicos.',
);
assert.match(
  markets,
  /Recursos específicos/,
  'Mercadinhos não permitem exceções individuais.',
);
assert.match(
  settings,
  /hasMarketFeature\(user,\s*'sidebar_customization'\)/,
  'Cores da barra lateral não respeitam o plano.',
);
assert.match(
  products,
  /hasMarketFeature\(user,\s*'automatic_image_search'\)/,
  'Formulário de produto não respeita pesquisa de imagem.',
);

console.log('Teste de recursos granulares dos planos aprovado.');
