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
assert.match(
  stress,
  /screenMode: 'fetch'/,
  'O stress test deve validar rotas por fetch por padrao para respeitar frame-ancestors none.',
);
assert.match(
  stress,
  /roleTests: true/,
  'O stress test deve incluir testes de usuarios com perfis diferentes.',
);
assert.match(
  stress,
  /async function runRolePermissionTests\(products\)/,
  'O stress test deve executar vendas e permissoes como vendedor, gerente e admin.',
);
assert.match(
  stress,
  /async function runPlanTests\(currentUser\)/,
  'O stress test deve validar planos quando houver perfil de super admin ou bloqueio esperado.',
);
assert.match(
  stress,
  /async function runPdvPrintAndSaveTests\(currentUser, products, sampleSale\)/,
  'O stress test deve validar salvamento local, impressao e download do PDV.',
);
assert.match(
  stress,
  /method, amount: money\(total \+ 1\)/,
  'O stress test deve pagar vendas normais com margem para evitar falso negativo por arredondamento.',
);
assert.match(
  stress,
  /sum \+ money\(qty \* item\.unit_price\)/,
  'O stress test deve arredondar subtotal por item como o backend.',
);
assert.doesNotMatch(
  stress,
  /barcode: .*\.slice\(0, 13\)/,
  'O stress test nao pode truncar o contador do codigo de barras e gerar duplicados.',
);
assert.doesNotMatch(
  stress,
  /frame\.src = `\$\{route\}/,
  'O stress test nao deve carregar rotas do app em iframe, pois a CSP frame-ancestors none bloqueia esse modo em producao.',
);

console.log('Teste de casts runtime e stress aprovado.');
