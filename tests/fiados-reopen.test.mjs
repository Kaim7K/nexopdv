import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('fiado settlement can be reopened by admin or gerente', () => {
  const api = readFileSync(join(root, 'api', 'index.js'), 'utf8');
  const fiados = readFileSync(join(root, 'src', 'pages', 'Fiados.jsx'), 'utf8');

  assert.match(api, /status: 'pendente'/);
  assert.match(api, /fiado_quitacao_desfeita/);
  assert.match(api, /Somente fiados quitados podem ser reabertos/);
  assert.match(fiados, /Desfazer quitação/);
  assert.match(fiados, /RotateCcw/);
  assert.match(fiados, /Itens da venda/);
  assert.match(fiados, /Sale\.get\(settleFiado\.sale_id\)/);
});
