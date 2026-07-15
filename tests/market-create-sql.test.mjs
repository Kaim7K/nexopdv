import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../api/index.js', import.meta.url), 'utf8');

assert.match(
  api,
  /jsonb_build_object\('status',\$\{requestedStatus\}::text\)/,
  'O log de criacao de mercado sem plano deve tipar status para evitar erro 42P18.',
);
assert.match(
  api,
  /jsonb_build_object\('status',\$\{requestedStatus\}::text,'plan_id',\$\{selectedPlan\.id\}::uuid\)/,
  'O log de criacao de mercado com plano deve tipar status e plano.',
);
assert.doesNotMatch(
  api,
  /jsonb_build_object\('status',\$\{requestedStatus\}\)/,
  'Status sem cast em jsonb_build_object volta a causar erro 42P18.',
);

console.log('Teste do SQL de criacao de mercado aprovado.');
