import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [api,client,migration,moduleMigration,cashPage,quickModal,app,layout,navigation,email,plansPage,moduleCatalog] = await Promise.all([
  read('api/index.js'),read('src/api/nexoApi.js'),read('database/migrations/011_platform_administration.sql'),
  read('database/migrations/012_cash_history_module.sql'),read('src/pages/HistoricoCaixas.jsx'),read('src/components/pdv/QuickProductModal.jsx'),read('src/App.jsx'),read('src/components/Layout.jsx'),read('src/config/navigation.jsx'),read('server/stock-alerts.js'),read('src/pages/AdminPlanos.jsx'),read('src/lib/market-modules.js'),
]);

assert.match(migration,/nexo_products_market_barcode_uidx/,'O banco deve impedir códigos de barras duplicados.');
assert.doesNotMatch(migration,/UPDATE\s+nexo\.users\s+current_user/i,'A migração não pode usar current_user como alias, pois é palavra reservada do PostgreSQL.');
assert.match(migration,/UPDATE\s+nexo\.users\s+AS\s+user_record/i,'A associação da unidade padrão deve usar um alias SQL seguro.');
assert.match(migration,/CREATE TABLE IF NOT EXISTS nexo\.plans/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS nexo\.subscriptions/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS nexo\.market_units/);
assert.match(moduleMigration,/enabled_modules[\s\S]*caixas/,'A migração deve preservar o acesso ao histórico de caixas dos planos existentes.');
assert.match(api,/path\[1\] === 'history'/,'A API deve fornecer histórico paginado de caixas.');
assert.match(api,/produto_cadastrado_rapido/,'O cadastro rápido deve gerar auditoria do operador.');
assert.match(api,/ON CONFLICT DO NOTHING[\s\S]*created:\s*false/,'Conflitos concorrentes devem reutilizar o produto existente.');
assert.match(client,/quickCreate/);
assert.match(cashPage,/operatorId[\s\S]*status[\s\S]*unitId/,'A tela deve filtrar por operador, status e unidade.');
assert.match(quickModal,/autoFocus/);
assert.doesNotMatch(quickModal,/sale_price|image_url|cost_price/);
assert.match(app,/PRIVATE_ROUTES/);
assert.match(navigation,/AdminOverview/);
assert.match(navigation,/Planos e assinaturas/);
assert.match(navigation,/module: 'caixas'/,'Hist?rico de caixas deve possuir controle de acesso independente.');
assert.match(layout,/ROUTE_PREFETCHERS/);
assert.match(moduleCatalog,/Histórico de caixas/,'O catálogo do Super Admin deve listar todas as funcionalidades principais.');
assert.match(plansPage,/Excluir plano/);
assert.match(plansPage,/Desativar plano/);
assert.match(api,/PLAN_IN_USE/,'A exclusão de planos em uso deve ser bloqueada para preservar o histórico.');
assert.match(client,/method:\s*'DELETE'/,'O cliente deve oferecer exclusão de planos ao Super Admin.');
assert.match(email,/loadMarketEmailBrand/);
assert.match(email,/brand\.primaryColor/);
console.log('Teste de administração, caixas, e-mails e cadastro rápido aprovado.');
