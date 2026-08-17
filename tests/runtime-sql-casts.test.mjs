import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = (
  await Promise.all([
    readFile(new URL('../api/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../server/cash/routes.js', import.meta.url), 'utf8'),
  ])
).join('\n');
const finance = await readFile(new URL('../server/finance.js', import.meta.url), 'utf8');
for (const typedValue of [
  /'entity_id',\$\{path\[1\]\}::uuid/,
  /'user_id',\$\{user\.id\}::uuid/,
  /'user_name',\$\{user\.full_name \|\| user\.email\}::text/,
  /'description',\$\{type === 'entrada' \? 'Entrada registrada no caixa' : 'Retirada registrada no caixa'\}::text/,
]) {
  assert.match(
    api,
    typedValue,
    'A auditoria de movimentacao de caixa deve tipar campos dinamicos para evitar erro 42P18.',
  );
}

assert.match(
  finance,
  /jsonb_build_object\('payment_amount',\$\{amount\}::numeric\),\$\{user\.id\}::uuid,\$\{user\.full_name \|\| user\.email\}::text/,
  'O evento de pagamento financeiro deve tipar amount e ator para evitar erro 42P18.',
);

console.log('Teste de casts runtime aprovado.');
