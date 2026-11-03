import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { productInsights, managementModules, canReadPayables, marginDeclines } from '../src/lib/management-insights.js';
import { completeWithConfirmation } from '../src/lib/sale-confirmation.js';
import { handleManagement } from '../server/management.js';
import { handleSalesRequest } from '../server/sales/routes.js';
import { handlePasswordRecovery } from '../server/password-recovery.js';
import { createSession, currentUser } from '../server/auth.js';
import { PLAN_CATALOG } from '../src/lib/plan-catalog.js';

function response() {
  return { code: 0, body: null, headers: {}, setHeader(key, value) { this.headers[key] = value; }, getHeader(key) { return this.headers[key]; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('product actions ignore inactive products and distinguish unknown costs from low margins', () => {
  const now = Date.parse('2026-11-03T15:00:00Z');
  const result = productInsights([
    { id: 'low', name: 'Arroz', quantity: 2, sale_price: 10, cost_price: 9.5, created_date: '2026-09-01' },
    { id: 'unknown', quantity: 8, sale_price: 10, cost_price: null, last_sale_at: '2026-11-02' },
    { id: 'inactive', status: 'inativo', quantity: 0, sale_price: 10, cost_price: 10 },
    { id: 'untracked', track_stock: false, quantity: 0, sale_price: 10, cost_price: 1 },
  ], 5, now);
  assert.equal(result.total, 3);
  assert.deepEqual(result.low.products.map(item => item.id), ['low']);
  assert.deepEqual(result.idle.products.map(item => item.id), ['low']);
  assert.deepEqual(result.margin.products.map(item => item.id), ['low']);
});

test('management respects plan entitlements, tenant boundary and individual financial permissions', async () => {
  const basic = PLAN_CATALOG.find(plan => plan.key === 'essencial');
  const source = { ...basic, role: 'gerente', market_id: 'market-A', id: 'user-A' };
  assert.equal(canReadPayables(source), false);
  assert.equal(managementModules({ ...source, enabled_modules: [...basic.enabled_modules, 'fiados'] }).includes('fiados'), false);
  const queries = [];
  const sql = async (parts, ...values) => {
    const query = parts.join('?'); queries.push(query);
    assert.ok(values.includes('market-A'));
    if (query.includes('finance_user_permissions')) return [{ permissions: { view: false, view_profit: false } }];
    if (query.includes("entity='products'")) return [{ id: 'p', name: 'Produto', quantity: 1, cost_price: 10, sale_price: 10 }];
    return [];
  };
  const res = response();
  await handleManagement({ req: { method: 'GET' }, res, sql, user: { ...source, enabled_features: [], enabled_modules: ['estoque','financeiro'] } });
  assert.equal(res.code, 200);
  assert.equal(res.body.payables, null);
  assert.equal(res.body.products.margin, null);
  assert.equal(queries.some(query => query.includes('FROM nexo.finance_transactions')), false);
  const denied = response();
  await handleManagement({ req: { method: 'GET' }, res: denied, sql: () => assert.fail('seller must not query management data'), user: { ...source, role: 'vendedor' } });
  assert.equal(denied.code, 403);
});

test('margin decline uses sold costs and actual discounted revenue without inventing costs for legacy sales', () => {
  const now = Date.parse('2026-11-03T15:00:00Z');
  const item = { product_id: 'p', product_name: 'Arroz', quantity: 1, unit: 'unidade', unit_price: 10, subtotal: 10, unit_cost: 5 };
  const result = marginDeclines([
    { status: 'concluida', created_date: '2026-10-31T15:00:00Z', total: 8, items: [item] },
    { status: 'concluida', created_date: '2026-09-20T15:00:00Z', total: 10, items: [item] },
    { status: 'cancelada', created_date: '2026-10-30T15:00:00Z', total: 2, items: [item] },
    { status: 'concluida', created_date: '2026-10-30T15:00:00Z', total: 2, items: [{ ...item, unit_cost: undefined }] },
  ], now);
  assert.equal(result.count, 1);
  assert.equal(result.products[0].drop, 12.5);
});

test('lost sale response is recovered by operation without posting twice; an uncertain result stays uncertain', async () => {
  let posts = 0;
  const payload = { client_operation_id: 'operation-1' };
  const sale = { id: 'sale-1' };
  assert.equal(await completeWithConfirmation({ complete: async () => { posts++; throw new Error('network'); }, operation: async id => { assert.equal(id, payload.client_operation_id); return { sale }; } }, payload), sale);
  assert.equal(posts, 1);
  await assert.rejects(completeWithConfirmation({ complete: async () => { throw new Error('network'); }, operation: async () => ({ sale: null }) }, payload), error => error.uncertain === true);
  await assert.rejects(completeWithConfirmation({ complete: async () => { throw Object.assign(new Error('invalid'), { status: 400 }); }, operation: async () => assert.fail('validation errors do not need recovery') }, payload), /invalid/);
});

test('committed operation is returned before changed cash or product validation and cannot cross sellers', async () => {
  const user = { id: 'seller-A', market_id: 'market-A' };
  const row = { id: 'sale-A', data: { seller_id: user.id } };
  const context = { req: { method: 'POST', body: { client_operation_id: 'valid-id' } }, res: response(), sql: async (parts, ...values) => { assert.ok(values.includes(user.market_id)); return [row]; }, user, path: ['sales','complete'] };
  const helpers = { isUuid: () => true, recordFromRow: row => ({ id: row.id, ...row.data }), findOpenCashSession: () => assert.fail('must recover first') };
  await handleSalesRequest(context, helpers);
  assert.equal(context.res.body.id, row.id);
  row.data.seller_id = 'another-seller';
  context.res = response();
  await handleSalesRequest(context, helpers);
  assert.equal(context.res.code, 409);
});

test('password recovery delivers only a temporary secret, consumes it once, and invalidates old sessions', async () => {
  const saved = { ...process.env };
  process.env.PUBLIC_APP_URL = 'https://nexo.example';
  process.env.EMAIL_FROM = 'Nexo <no-reply@example.com>';
  process.env.BREVO_API_KEY = 'test-key';
  process.env.DATABASE_URL = 'postgresql://local/test';
  process.env.JWT_SECRET = 'test-only-secret-with-more-than-32-characters';
  try {
    const user = { id: 'user-1', email: 'user@example.com', password_hash: await bcrypt.hash('old-password', 4) };
    const sessionBefore = response();
    await createSession(user, sessionBefore);
    let stored, rawToken, used = false;
    const sql = async (parts, ...values) => {
      const query = parts.join('?');
      if (query.includes('INSERT INTO nexo.password_reset_limits')) return [{ key: values[0] }];
      if (query.includes('SELECT u.id,u.email')) return [user];
      if (query.includes('INSERT INTO nexo.password_reset_tokens')) { stored = values; return []; }
      if (query.includes('SELECT token.user_id')) return used ? [] : [{ user_id: user.id, password_fingerprint: stored[2], password_hash: user.password_hash }];
      if (query.includes('WITH claimed')) { used = true; user.password_hash = values[1]; user.password_reset_at = new Date().toISOString(); return [{ id: user.id }]; }
      return [user];
    };
    const req = { method: 'POST', headers: {}, body: { email: user.email } };
    const res = response();
    await handlePasswordRecovery({ req, res, sql, path: ['auth','forgot-password'] }, { deliver: async (_url, options) => {
      const email = JSON.parse(options.body);
      rawToken = /#token=([a-f0-9]{64})/.exec(email.textContent)[1];
      assert.equal(email.to[0].email, user.email);
      return { ok: true };
    } });
    assert.equal(res.code, 200);
    assert.equal(stored[0], createHash('sha256').update(rawToken).digest('hex'));
    assert.notEqual(stored[0], rawToken);
    const reset = { req: { method: 'POST', body: { token: rawToken, password: 'new-password-123' } }, res: response(), sql, path: ['auth','reset-password'] };
    await handlePasswordRecovery(reset);
    assert.equal(await bcrypt.compare('new-password-123', user.password_hash), true);
    await assert.rejects(handlePasswordRecovery(reset), error => error.code === 'RESET_LINK_EXPIRED');
    const oldRequest = { headers: { cookie: sessionBefore.headers['Set-Cookie'] } };
    assert.equal(await currentUser(oldRequest, sql), null);
    const sessionAfter = response();
    await createSession(user, sessionAfter);
    assert.equal((await currentUser({ headers: { cookie: sessionAfter.headers['Set-Cookie'] } }, sql)).id, user.id);
  } finally {
    for (const key of ['PUBLIC_APP_URL','EMAIL_FROM','BREVO_API_KEY','DATABASE_URL','JWT_SECRET']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
