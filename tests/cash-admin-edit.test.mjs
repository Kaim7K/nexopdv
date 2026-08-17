import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = join(process.cwd());

test('cash closing expense affects expected cash and admin can reopen/edit closed cash', () => {
  const modal = readFileSync(join(root, 'src', 'components', 'pdv', 'CashRegisterModal.jsx'), 'utf8');
  const api = [
    readFileSync(join(root, 'api', 'index.js'), 'utf8'),
    readFileSync(join(root, 'server', 'entities', 'routes.js'), 'utf8'),
    readFileSync(join(root, 'server', 'cash', 'routes.js'), 'utf8'),
  ].join('\n');
  const history = [
    readFileSync(join(root, 'src', 'pages', 'HistoricoCaixas.jsx'), 'utf8'),
    readFileSync(
      join(root, 'src', 'features', 'cash-history', 'components', 'CashDetail.jsx'),
      'utf8',
    ),
  ].join('\n');
  const client = readFileSync(join(root, 'src', 'api', 'nexoApi.js'), 'utf8');

  assert.match(modal, /expectedCash/);
  assert.match(modal, /parseCurrencyDigits\(closingExpense\)/);
  assert.match(api, /Apenas administradores podem editar ou reabrir um caixa/);
  assert.match(api, /caixa_reaberto/);
  assert.match(api, /caixa_editado/);
  assert.match(client, /reopen: \(id\)/);
  assert.match(client, /update: \(id, data\)/);
  assert.match(history, /Reabrir/);
  assert.match(history, /Editar caixa/);
  assert.match(history, /Salvar alterações/);
});
