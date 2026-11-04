import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPurchasePayload, createPurchaseForm, getPurchaseTotals } from '../src/features/finance/purchases/purchase-model.js';

test('purchase defaults preserve account selection and use fresh item state', () => {
  const bootstrap = Object.freeze({ accounts: Object.freeze([
    Object.freeze({ id: 'first', is_default: false }), Object.freeze({ id: 'default', is_default: true }),
  ]) });
  const form = createPurchaseForm(bootstrap, '2026-11-03');
  assert.deepEqual(form, {
    supplier_id: '', account_id: 'default', issue_date: '2026-11-03', payment_method: 'boleto',
    discount: '0', freight: '0', invoice_number: '', attachment_url: '',
    items: [{ product_id: '', quantity: 1, unit_cost: '' }],
  });
  const next = createPurchaseForm(bootstrap, '2026-11-03');
  form.items[0].quantity = 9;
  assert.equal(next.items[0].quantity, 1);
  assert.equal(createPurchaseForm({ accounts: [{ id: 'first' }] }, '2026-11-03').account_id, 'first');
  assert.equal(createPurchaseForm({}, '2026-11-03').account_id, '');
});

test('purchase totals keep fractional quantities, cost precision and rounding order', () => {
  const form = Object.freeze({ discount: '1.25', freight: '2.50', items: Object.freeze([
    Object.freeze({ quantity: '2', unit_cost: '10.25' }), Object.freeze({ quantity: '0.5', unit_cost: '8.1234' }),
  ]) });
  assert.deepEqual(getPurchaseTotals(form), { subtotal: 24.56, total: 25.81 });
  assert.deepEqual(getPurchaseTotals({ items: [{ quantity: 3, unit_cost: 0.1 }] }), { subtotal: 0.3, total: 0.3 });
  assert.deepEqual(getPurchaseTotals({ items: [{ quantity: 1, unit_cost: 1.005 }] }), { subtotal: 1.01, total: 1.01 });
  assert.deepEqual(getPurchaseTotals({ discount: '0.01', items: [{ quantity: '0.333', unit_cost: '12.3456' }] }), { subtotal: 4.11, total: 4.1 });
  assert.deepEqual(getPurchaseTotals(createPurchaseForm({}, '2026-11-03')), { subtotal: 0, total: 0 });
});

test('purchase discount and freight retain the existing nonnegative total rule', () => {
  const items = [{ quantity: 1, unit_cost: 10 }];
  assert.deepEqual(getPurchaseTotals({ items, discount: 12, freight: 5 }), { subtotal: 10, total: 3 });
  assert.deepEqual(getPurchaseTotals({ items, discount: 100, freight: 1 }), { subtotal: 10, total: 0 });
});

test('purchase payload keeps metadata and raw discount/freight, converts only item numbers', () => {
  const form = Object.freeze({
    ...createPurchaseForm({ accounts: [{ id: 'account' }] }, '2026-11-03'),
    supplier_id: 'supplier', discount: '1.25', freight: '2.50', invoice_number: 'NF-123', attachment_url: 'nota.png',
    items: Object.freeze([Object.freeze({ product_id: 'p1', quantity: '2', unit_cost: '10.25' }), Object.freeze({ product_id: 'p2', quantity: '0.5', unit_cost: '8.1234' })]),
  });
  const payload = buildPurchasePayload(form, getPurchaseTotals(form).total);
  assert.deepEqual(payload, {
    ...form,
    items: [{ product_id: 'p1', quantity: 2, unit_cost: 10.25 }, { product_id: 'p2', quantity: 0.5, unit_cost: 8.1234 }],
    installments: [{ amount: 25.81, due_date: '2026-11-03', status: 'pending' }],
  });
  assert.notEqual(payload.items, form.items);
  assert.notEqual(payload.items[0], form.items[0]);
  assert.equal(form.items[0].quantity, '2');
});

test('purchase installment status remains paid only for cash and Pix', () => {
  for (const method of ['dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'outros']) {
    const form = { ...createPurchaseForm({}, '2026-11-03'), payment_method: method };
    assert.deepEqual(buildPurchasePayload(form, 0).installments, [{ amount: 0, due_date: '2026-11-03', status: ['dinheiro', 'pix'].includes(method) ? 'paid' : 'pending' }]);
  }
});
