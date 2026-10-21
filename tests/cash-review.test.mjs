import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewCashSession } from '../server/cash/review.js';
import { cashReviewFingerprint, cashReviewState } from '../src/lib/cash-review.js';

function fixture() {
  const session = { id: 'cash', status: 'fechado', seller_name: 'Ana', opening_amount: 50, closing_amount: 90, closed_at: '2026-10-20T20:00:00Z' };
  const summary = { total: 40, expected_cash: 90, sales_count: 2, payments: { dinheiro: 40 } };
  let updatedAt = '2026-10-20T20:00:00Z';
  let audits = 0;
  let conflict = false;
  const sql = async (strings, ...values) => {
    const source = strings.join('?');
    if (source.includes('WITH reviewed AS')) {
      assert.ok(source.includes("entity='cash_sessions'"));
      assert.ok(source.includes("data->>'status'='fechado'"));
      assert.ok(source.includes('INSERT INTO nexo.records'));
      assert.equal(values[2], 'market');
      if (conflict || values[3] !== updatedAt) return [];
      Object.assign(session, JSON.parse(values[0]));
      updatedAt = new Date().toISOString();
      audits++;
    } else if (values[0] !== 'cash' || values[1] !== 'market') return [];
    return [{ id: session.id, data: { ...session }, updated_date: updatedAt }];
  };
  const call = async (role = 'gerente', market = 'market', method = 'POST', version = cashReviewFingerprint(session, summary), reviewedAt = session.reviewed_at) => {
    const res = { getHeader() {}, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return data; } };
    await reviewCashSession({ req: { method, body: { version, reviewed_at: reviewedAt } }, res, sql, user: { id: 'manager', full_name: 'Gerente', role, market_id: market }, path: ['cash', 'cash', 'review'] }, {
      recordFromRow: row => ({ ...row.data, id: row.id }),
      getCashSessionSummary: async () => summary,
    });
    return res;
  };
  return { session, summary, call, audits: () => audits, conflict: () => { conflict = true; } };
}

test('review is persisted with the reviewer and retries preserve the first review and audit', async () => {
  const f = fixture();
  const first = await f.call();
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.review_valid, true);
  assert.equal(first.body.reviewed_by_name, 'Gerente');
  assert.ok(first.body.reviewed_at);
  const retry = await f.call('admin');
  assert.deepEqual(retry.body, first.body);
  assert.equal(f.audits(), 1);
});

test('financial changes invalidate a review, including edits and reopening', async () => {
  const f = fixture();
  await f.call();
  f.summary.total = 45;
  assert.equal(cashReviewState(f.session, f.summary).review_valid, false);
  await f.call();
  assert.equal(f.audits(), 2);
  f.session.status = 'aberto';
  assert.equal(cashReviewState(f.session, f.summary).review_valid, false);
  assert.equal((await f.call()).statusCode, 409);
});

test('review permissions and tenant boundaries are enforced', async () => {
  const f = fixture();
  assert.equal((await f.call('vendedor')).statusCode, 403);
  assert.equal((await f.call('admin', 'another-market')).statusCode, 404);
  assert.equal((await f.call('gerente', 'market', 'GET')).statusCode, 405);
  assert.equal(f.audits(), 0);
});

test('a concurrent cash edit is not silently marked as reviewed', async () => {
  const f = fixture();
  f.conflict();
  assert.equal((await f.call()).statusCode, 409);
  assert.equal(f.audits(), 0);
});

test('a stale visible financial snapshot cannot be marked as reviewed', async () => {
  const f = fixture();
  const oldVersion = cashReviewFingerprint(f.session, f.summary);
  f.summary.total = 60;
  assert.equal((await f.call('gerente', 'market', 'POST', oldVersion)).statusCode, 409);
  assert.equal(f.audits(), 0);
});

test('a review can be removed and marked again without duplicate removal audits', async () => {
  const f = fixture();
  await f.call();
  const removed = await f.call('gerente', 'market', 'DELETE');
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.body.review_valid, false);
  assert.equal(removed.body.reviewed_at, null);
  assert.equal(removed.body.reviewed_by, null);
  const repeated = await f.call('admin', 'market', 'DELETE');
  assert.deepEqual(repeated.body, removed.body);
  assert.equal(f.audits(), 2);
  assert.equal((await f.call()).body.review_valid, true);
  assert.equal(f.audits(), 3);
});

test('removal respects permissions, tenant isolation and the visible review version', async () => {
  const f = fixture();
  await f.call();
  assert.equal((await f.call('vendedor', 'market', 'DELETE')).statusCode, 403);
  assert.equal((await f.call('admin', 'another-market', 'DELETE')).statusCode, 404);
  assert.equal((await f.call('gerente', 'market', 'DELETE', '', 'stale-review')).statusCode, 409);
  f.conflict();
  assert.equal((await f.call('admin', 'market', 'DELETE')).statusCode, 409);
  assert.equal(f.audits(), 1);
});
