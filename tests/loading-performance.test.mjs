import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/App.jsx');
const layout = read('src/components/Layout.jsx');
const apiClient = [
  read('src/api/nexoApi.js'),
  read('src/api/http/http-client.js'),
  read('src/api/http/cache-policy.js'),
].join('\n');
const financeService = read('server/finance.js');
const financePage = read('src/pages/Financeiro.jsx');
const reportsPage = read('src/pages/Relatorios.jsx');
const pdvPage = read('src/pages/PDV.jsx');
const salesPage = read('src/pages/Vendas.jsx');
const receiptModal = read('src/components/pdv/ReceiptModal.jsx');
const migration = read('database/migrations/015_performance_indexes.sql');
const database = read('server/db.js');

assert.doesNotMatch(
  app,
  /fullScreen label="Abrindo a página/,
  'A troca de rota não deve esconder toda a aplicação.',
);
assert.match(
  layout,
  /Suspense fallback=\{<PageSkeleton/,
  'O layout deve manter a navegação visível enquanto a rota abre.',
);
assert.doesNotMatch(
  layout,
  /onTouchStart=.*ROUTE_PREFETCHERS/,
  'Rolagem por toque não deve disparar pré-carregamentos acidentais.',
);
assert.match(
  apiClient,
  /latestControllers/,
  'Buscas substituídas devem ser canceladas.',
);
assert.match(
  apiClient,
  /cache\.clear\(path\)/,
  'Mutações devem invalidar apenas caches relacionados.',
);
assert.match(
  financeService,
  /ensureFinanceMaintenance/,
  'A preparação financeira concorrente deve ser deduplicada.',
);
assert.match(
  financeService,
  /loadPurchaseProducts/,
  'Produtos de compras devem ser carregados sob demanda.',
);
assert.doesNotMatch(
  financePage,
  /from 'recharts'/,
  'A tela financeira não deve bloquear o conteúdo essencial nos gráficos.',
);
assert.doesNotMatch(
  reportsPage,
  /from 'recharts'/,
  'Relatórios devem carregar a biblioteca de gráficos progressivamente.',
);
assert.doesNotMatch(
  pdvPage,
  /from '@\/lib\/sales-pdf'/,
  'O PDV deve carregar o gerador de PDF apenas quando exportar.',
);
assert.doesNotMatch(
  salesPage,
  /from '@\/lib\/sales-pdf'/,
  'Historico de vendas deve carregar PDF apenas quando solicitado.',
);
assert.doesNotMatch(
  receiptModal,
  /from '@\/lib\/sales-pdf'/,
  'O modal de recibo deve gerar PDF sob demanda.',
);
assert.match(migration, /gin_trgm_ops/);
assert.match(migration, /nexo_finance_transactions_type_period_idx/);
assert.match(database, /CURRENT_SCHEMA_VERSION = 17/);

console.log('Teste de carregamento e performance aprovado.');
