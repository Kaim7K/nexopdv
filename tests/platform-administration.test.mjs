import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [api,client,migration,cashPage,quickModal,app,layout,email] = await Promise.all([
  read('api/index.js'),read('src/api/nexoApi.js'),read('database/migrations/011_platform_administration.sql'),
  read('src/pages/HistoricoCaixas.jsx'),read('src/components/pdv/QuickProductModal.jsx'),read('src/App.jsx'),read('src/components/Layout.jsx'),read('server/stock-alerts.js'),
]);

assert.match(migration,/nexo_products_market_barcode_uidx/,'O banco deve impedir códigos de barras duplicados.');
assert.doesNotMatch(migration,/UPDATE\s+nexo\.users\s+current_user/i,'A migração não pode usar current_user como alias, pois é palavra reservada do PostgreSQL.');
assert.match(migration,/UPDATE\s+nexo\.users\s+AS\s+user_record/i,'A associação da unidade padrão deve usar um alias SQL seguro.');
assert.match(migration,/CREATE TABLE IF NOT EXISTS nexo\.plans/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS nexo\.subscriptions/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS nexo\.market_units/);
assert.match(api,/path\[1\] === 'history'/,'A API deve fornecer histórico paginado de caixas.');
assert.match(api,/produto_cadastrado_rapido/,'O cadastro rápido deve gerar auditoria do operador.');
assert.match(api,/ON CONFLICT DO NOTHING[\s\S]*created:false/,'Conflitos concorrentes devem reutilizar o produto existente.');
assert.match(client,/quickCreate/);
assert.match(cashPage,/operatorId[\s\S]*status[\s\S]*unitId/,'A tela deve filtrar por operador, status e unidade.');
assert.match(quickModal,/autoFocus/);
assert.doesNotMatch(quickModal,/sale_price|image_url|cost_price/);
assert.match(app,/AdminOverview/);
assert.match(layout,/Planos e assinaturas/);
assert.match(email,/loadMarketEmailBrand/);
assert.match(email,/brand\.primaryColor/);
console.log('Teste de administração, caixas, e-mails e cadastro rápido aprovado.');
