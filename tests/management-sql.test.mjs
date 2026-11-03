// Optional PostgreSQL WASM validation. Pass an installed PGlite module path.
// No application DATABASE_URL, remote database, or email provider is used.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { handleManagement } from '../server/management.js';
import { handlePasswordRecovery } from '../server/password-recovery.js';
import { handleSalesRequest } from '../server/sales/routes.js';

if (!process.argv[2]) throw new Error('Usage: node tests/management-sql.test.mjs <absolute PGlite module path>');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const sql = async (parts, ...values) => {
  const query = parts.reduce((query, part, index) => query + part + (index < values.length ? `$${index + 1}` : ''), '');
  return (await db.query(query, values)).rows;
};
const res = () => ({ code: 0, body: null, setHeader() {}, getHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
try {
  await db.exec('CREATE SCHEMA nexo');
  const files = (await readdir('database/migrations')).filter(file => /^\d+.*sql$/.test(file)).sort();
  for (const file of files.filter(file => Number(file.slice(0, 3)) <= 20)) {
    // pg_trgm indexes are performance-only; pgcrypto is unnecessary because
    // PostgreSQL provides gen_random_uuid() natively. No business DDL is skipped.
    if (file.startsWith('015_')) continue;
    const source = (await readFile(`database/migrations/${file}`, 'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
    await db.exec(source);
  }
  const marketId = randomUUID(), userId = randomUUID(), productId = randomUUID();
  await sql`INSERT INTO nexo.markets(id,name,slug) VALUES(${marketId},'Existing market','existing')`;
  const passwordHash = await bcrypt.hash('existing-password', 4);
  await sql`INSERT INTO nexo.users(id,market_id,email,password_hash,role) VALUES(${userId},${marketId},'existing@example.com',${passwordHash},'gerente')`;
  const product = { name: 'Existing rice', unit: 'unidade', sale_price: 10, cost_price: 6, quantity: 100, status: 'ativo' };
  await sql`INSERT INTO nexo.records(id,market_id,entity,data) VALUES(${productId},${marketId},'products',${JSON.stringify(product)}::jsonb)`;
  const before = (await db.query('SELECT id,data,created_date,updated_date FROM nexo.records')).rows;
  const migration = await readFile('database/migrations/021_password_recovery.sql','utf8');
  await db.exec(migration);
  await db.exec(migration);
  assert.deepEqual((await db.query('SELECT id,data,created_date,updated_date FROM nexo.records')).rows, before);
  assert.equal((await sql`SELECT password_hash FROM nexo.users WHERE id=${userId}`)[0].password_hash, passwordHash);

  const user = { id: userId, market_id: marketId, role: 'gerente', full_name: 'Manager', enabled_modules: ['pdv','estoque','relatorios','fiados','financeiro','vendas','configuracoes'], enabled_features: [] };
  const context = { req: { method: 'POST', body: { client_operation_id: randomUUID(), items: [{ product_id: productId, quantity: 1, unit_price: 10 }], payments: [{ method: 'dinheiro', amount: 10 }] }, query: {} }, res: res(), sql, user, path: ['sales','complete'] };
  const helpers = { PAYMENT_METHODS: new Set(['dinheiro']), findOpenCashSession: async () => null, hasFeature: () => true, isUuid: value => /^[a-f0-9-]{36}$/i.test(value || ''), text: (value, max = 1000) => String(value || '').slice(0, max), recordFromRow: row => ({ id: row.id, ...row.data, created_date: row.created_date }), parseDateQuery: () => null };
  await handleSalesRequest(context, helpers);
  assert.equal(context.res.code, 201);
  const first = context.res.body;
  context.res = res();
  await handleSalesRequest(context, helpers);
  assert.equal(context.res.body.id, first.id);
  assert.equal(Number((await sql`SELECT data->>'quantity' AS quantity FROM nexo.records WHERE id=${productId}`)[0].quantity), 99);
  assert.equal(Number((await sql`SELECT count(*) FROM nexo.records WHERE market_id=${marketId} AND entity='sales'`)[0].count), 1);
  const overview = res();
  await handleManagement({ req: { method: 'GET' }, res: overview, sql, user });
  assert.equal(overview.code, 200);
  assert.equal(Number(overview.body.sales.total), 10);

  process.env.PUBLIC_APP_URL = 'https://example.com';
  process.env.BREVO_API_KEY = 'test';
  process.env.EMAIL_FROM = 'no-reply@example.com';
  let token;
  await handlePasswordRecovery({ req: { method: 'POST', body: { email: 'existing@example.com' }, headers: {} }, res: res(), sql, path: ['auth','forgot-password'] }, { deliver: async (_url, options) => { token = /#token=([a-f0-9]{64})/.exec(JSON.parse(options.body).textContent)[1]; return { ok: true }; } });
  const reset = { req: { method: 'POST', body: { token, password: 'new-test-password' } }, res: res(), sql, path: ['auth','reset-password'] };
  await handlePasswordRecovery(reset);
  assert.equal(reset.res.code, 200);
  assert.equal(await bcrypt.compare('new-test-password', (await sql`SELECT password_hash FROM nexo.users WHERE id=${userId}`)[0].password_hash), true);
  await assert.rejects(handlePasswordRecovery(reset), error => error.code === 'RESET_LINK_EXPIRED');
  assert.equal(Number((await sql`SELECT data->>'quantity' AS quantity FROM nexo.records WHERE id=${productId}`)[0].quantity), 99);
  console.log('PostgreSQL WASM: additive migration preserves existing records/passwords; sale retry changes stock once; dashboard SQL and one-time password recovery pass.');
} finally { await db.close(); }
