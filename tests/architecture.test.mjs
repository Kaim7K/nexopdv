import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_SCHEMA_VERSION } from '../server/db.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

const runtimeFiles = [
  'api/index.js',
  'server/auth.js',
  'server/config.js',
  'server/db.js',
  'server/errors.js',
  'server/http.js',
];

for (const file of runtimeFiles) {
  const source = await read(file);
  assert.doesNotMatch(source, /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|SCHEMA|EXTENSION)\b/i, `${file} contém DDL em tempo de execução`);
}

const api = await read('api/index.js');
assert.match(api, /await assertDatabaseReady\(sql\)/, 'API não valida a versão do banco');
assert.match(api, /authenticateCredentials/, 'API não usa o módulo de autenticação');
assert.doesNotMatch(api, /\b(?:FROM|INTO|UPDATE|DELETE FROM)\s+(?:users|markets|records)\b/i, 'API acessa tabelas públicas legadas');

const migrationFiles = (await fs.readdir(path.join(root, 'database/migrations')))
  .filter(name => /^\d+_.+\.sql$/.test(name))
  .sort();
assert.equal(migrationFiles.length, CURRENT_SCHEMA_VERSION, 'Quantidade de migrações não corresponde à versão do banco');
assert.equal(Number(migrationFiles.at(-1).slice(0, 3)), CURRENT_SCHEMA_VERSION, 'Última migração não corresponde à versão atual');

const loginPage = await read('src/pages/Login.jsx');
assert.match(loginPage, /const \{ user \} = await nexoApi\.auth\.login/, 'Login não utiliza o usuário devolvido pela mesma requisição');
assert.doesNotMatch(loginPage, /await nexoApi\.auth\.me\(\)/, 'Login ainda faz uma segunda chamada desnecessária');

console.log('Teste de arquitetura aprovado.');
