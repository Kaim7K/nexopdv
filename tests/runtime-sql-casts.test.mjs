import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../api/index.js', import.meta.url), 'utf8');
const finance = await readFile(new URL('../server/finance.js', import.meta.url), 'utf8');
const stress = await readFile(
  new URL('../scripts/chrome-stress-console.js', import.meta.url),
  'utf8',
);

assert.match(
  api,
  /jsonb_build_object\('action_type','movimentacao_caixa','entity_type','cash_session','entity_id',\$\{path\[1\]\}::uuid,'user_id',\$\{user\.id\}::uuid,'user_name',\$\{user\.full_name \|\| user\.email\}::text,'description',\$\{type === 'entrada' \? 'Entrada registrada no caixa' : 'Retirada registrada no caixa'\}::text,'details'/,
  'A auditoria de movimentacao de caixa deve tipar campos dinamicos para evitar erro 42P18.',
);

assert.match(
  finance,
  /jsonb_build_object\('payment_amount',\$\{amount\}::numeric\),\$\{user\.id\}::uuid,\$\{user\.full_name \|\| user\.email\}::text/,
  'O evento de pagamento financeiro deve tipar amount e ator para evitar erro 42P18.',
);

assert.match(
  stress,
  /const runDigits = String\(Date\.now\(\)\)\.slice\(-6\);/,
  'O stress test deve usar um prefixo curto de execucao para manter codigo de barras com 13 digitos.',
);
assert.match(
  stress,
  /barcode: `789\$\{runDigits\}\$\{String\(n\)\.padStart\(4, '0'\)\}`,/,
  'O stress test deve gerar codigo de barras unico por produto.',
);
assert.doesNotMatch(
  stress,
  /barcode: .*\.slice\(0, 13\)/,
  'O stress test nao pode truncar o contador do codigo de barras e gerar duplicados.',
);

console.log('Teste de casts runtime e stress aprovado.');
