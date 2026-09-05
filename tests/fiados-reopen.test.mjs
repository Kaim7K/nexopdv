import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchesFiadoFilters } from '../src/lib/fiado-filters.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('fiado settlement can be reopened by admin or gerente', () => {
  const api = [
    readFileSync(join(root, 'api', 'index.js'), 'utf8'),
    readFileSync(join(root, 'server', 'entities', 'routes.js'), 'utf8'),
    readFileSync(join(root, 'server', 'sales', 'routes.js'), 'utf8'),
  ].join('\n');
  const fiados = readFileSync(join(root, 'src', 'pages', 'Fiados.jsx'), 'utf8');
  const vendas = [
    readFileSync(join(root, 'src', 'pages', 'Vendas.jsx'), 'utf8'),
    readFileSync(
      join(root, 'src', 'components', 'sales', 'SaleHistory.jsx'),
      'utf8',
    ),
  ].join('\n');

  assert.match(api, /status: 'pendente'/);
  assert.match(api, /fiado_quitacao_desfeita/);
  assert.match(api, /Somente fiados quitados podem ser reabertos/);
  assert.match(api, /data->>'status'='pendente'/);
  assert.match(fiados, /Desfazer quitação/);
  assert.match(fiados, /RotateCcw/);
  assert.match(fiados, /Itens da venda/);
  assert.match(fiados, /Sale\.get\(settleFiado\.sale_id\)/);
  assert.match(fiados, /settledFrom/);
  assert.match(fiados, /settledTo/);
  assert.match(fiados, /matchesFiadoFilters/);
  assert.match(vendas, /printSaleReceipt/);
  assert.match(vendas, /Imprimir recibo/);
  assert.match(vendas, /onPrint=\{\(\) => printReceipt\(sale\)\}/);
});

test('período filtra pela quitação sem esconder pendências antigas', () => {
  const period = { settledFrom: '2026-09-01', settledTo: '2026-09-30' };
  assert.equal(
    matchesFiadoFilters(
      { status: 'pendente', created_date: '2024-01-01T12:00:00.000Z' },
      period,
    ),
    true,
  );
  assert.equal(
    matchesFiadoFilters(
      { status: 'quitado', settlement_date: '2026-09-15T12:00:00.000Z' },
      period,
    ),
    true,
  );
  assert.equal(
    matchesFiadoFilters(
      { status: 'quitado', settlement_date: '2026-08-31T23:59:00.000Z' },
      period,
    ),
    false,
  );
});
