import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/App.jsx');
const layout = read('src/components/Layout.jsx');
const apiClient = read('src/api/nexoApi.js');
const financeService = read('server/finance.js');
const financePage = read('src/pages/Financeiro.jsx');
const reportsPage = read('src/pages/Relatorios.jsx');
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
  /latestRequestControllers/,
  'Buscas substituídas devem ser canceladas.',
);
assert.match(
  apiClient,
  /invalidateCache\(path/,
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
assert.match(migration, /gin_trgm_ops/);
assert.match(migration, /nexo_finance_transactions_type_period_idx/);
assert.match(database, /CURRENT_SCHEMA_VERSION = 15/);

console.log('Teste de carregamento e performance aprovado.');
