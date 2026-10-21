import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { handleCashRequest } from '../server/cash/routes.js';
import { cashClosingSituation } from '../src/lib/cash-history.js';
import { useCashDetailModel } from '../src/features/cash-history/hooks/use-cash-detail-model.js';

function cashDetailAmounts(session, summary) {
  let model;
  function Probe() {
    model = useCashDetailModel({
      session,
      summary,
      currentUser: { id: 'admin', role: 'admin' },
      salePaymentFilter: '',
    });
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return model;
}

test('value without drawer uses expected cash independently of surplus or shortage', () => {
  const summary = {
    opening_amount: 95.4,
    expected_cash_before_expense: 165.3,
    closing_entry: 0,
    closing_expense: 45,
    expected_cash: 120.3,
  };
  for (const [counted, countedWithoutDrawer] of [[122.8, 27.4], [120.3, 24.9], [118.8, 23.4], [0, -95.4]]) {
    const model = cashDetailAmounts({ status: 'fechado', closing_amount: counted }, summary);
    assert.equal(model.valueWithoutCashDrawer, 24.9);
    assert.equal(model.countedWithoutCashDrawer, countedWithoutDrawer);
  }
  const openModel = cashDetailAmounts({ status: 'aberto' }, summary);
  assert.equal(openModel.valueWithoutCashDrawer, 24.9);
  assert.equal(openModel.countedWithoutCashDrawer, 24.9);
});

test('both amounts without drawer retain closing adjustments and signed balances', () => {
  const model = cashDetailAmounts(
    { status: 'fechado', closing_amount: 80, closing_entry: 5, closing_expense: 30 },
    { opening_amount: 100, expected_cash_before_expense: 110, closing_entry: 5, closing_expense: 30 },
  );
  assert.equal(model.expectedAfterExpense, 85);
  assert.equal(model.valueWithoutCashDrawer, -10);
  assert.equal(model.countedWithoutCashDrawer, -15);
});

test('closing situations distinguish zero, surplus, shortage and uncounted sessions', () => {
  for (const [difference, expected] of [[0, 'conferido'], ['0.00', 'conferido'], [0.01, 'sobra'], [-0.01, 'falta'], [null, ''], [undefined, ''], ['', '']]) {
    assert.equal(cashClosingSituation({ status: 'fechado', difference }), expected);
  }
  assert.equal(cashClosingSituation({ status: 'aberto', difference: 0 }), '');
});

test('a zero cash difference uses the normal text color while surplus and shortage stay distinct', () => {
  assert.equal(cashDetailAmounts({ closing_amount: 145.4 }, { expected_cash: 145.4 }).differenceTone, 'text-foreground');
  assert.match(cashDetailAmounts({ closing_amount: 146.4 }, { expected_cash: 145.4 }).differenceTone, /blue/);
  assert.match(cashDetailAmounts({ closing_amount: 144.4 }, { expected_cash: 145.4 }).differenceTone, /red/);
});

async function history(query = {}) {
  const sessions = Array.from({ length: 27 }, (_, i) => ({
    id: String(i), status: 'fechado', closing_amount: i < 23 ? 101 : i === 23 ? 99 : i === 24 ? 100 : null,
    difference: 999, // A stale stored difference must not replace the current summary.
  }));
  sessions[26].status = 'aberto';
  const snapshot = structuredClone(sessions);
  const calls = [];
  const sql = async (strings, ...values) => {
    const source = strings.join('?');
    calls.push({ source, values });
    if (!source.includes("entity='cash_sessions'")) return [];
    const limit = values.at(-2);
    const offset = values.at(-1);
    return (limit === null ? sessions : sessions.slice(offset, offset + limit))
      .map((session) => ({ ...session, total_count: sessions.length }));
  };
  const res = {
    getHeader() {}, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return body; },
  };
  await handleCashRequest({ req: { method: 'GET', query }, res, sql, user: { role: 'admin', market_id: 'market' }, path: ['cash', 'history'] }, {
    text: (value) => String(value ?? ''),
    parseDateQuery: (value) => value || null,
    recordFromRow: (row) => row,
    getCashSessionsSummaries: async (_sql, _market, candidates) => new Map(candidates.map(({ id }) => [id, { expected_cash: 100 }])),
  });
  assert.deepEqual(sessions, snapshot, 'Reading history must not mutate financial records');
  return { ...res, calls };
}

test('surplus filtering uses all summaries before pagination and keeps existing query filters', async () => {
  const result = await history({ situation: 'sobra', page: '2', page_size: '10', from: '2026-10-01', to: '2026-11-01', operator_id: 'operator', unit_id: 'unit', status: 'fechado' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.total, 23);
  assert.equal(result.body.page_count, 3);
  assert.equal(result.body.items.length, 10);
  assert.equal(result.body.items[0].id, '10');
  assert.ok(result.body.items.every((item) => item.difference === 1 && item.final_amount === 101));
  for (const value of ['2026-10-01', '2026-11-01', 'operator', 'unit', 'fechado']) {
    assert.ok(result.calls[0].values.includes(value));
  }
  const last = await history({ situation: 'sobra', page: '3', page_size: '10' });
  assert.equal(last.body.items.length, 3);
});

test('confirmed and shortage filters exclude open and uncounted sessions; all retains them', async () => {
  const confirmed = await history({ situation: 'conferido' });
  assert.deepEqual(confirmed.body.items.map((item) => item.id), ['24']);
  const shortage = await history({ situation: 'falta' });
  assert.deepEqual(shortage.body.items.map((item) => item.difference), [-1]);
  const all = await history({ page: '2' });
  assert.equal(all.body.total, 27);
  assert.equal(all.body.items.length, 7);
  assert.equal(all.body.items.at(-1).status, 'aberto');
  assert.equal(all.body.items.at(-1).difference, null);
  const empty = await history({ situation: 'sobra', page: '4', page_size: '10' });
  assert.equal(empty.body.items.length, 0);
  assert.equal(empty.body.total, 23);
  const invalid = await history({ situation: 'invalid' });
  assert.equal(invalid.statusCode, 400);
});
