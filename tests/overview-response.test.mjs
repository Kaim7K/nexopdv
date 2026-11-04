import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOverviewResponse } from '../src/components/management/overview-response.js';

test('empty and incomplete overview responses become a recoverable error', () => {
  for (const data of [null, undefined, {}, { modules: null }, { modules: [], fiados: {} }, { modules: [], payables: {} }, { modules: [], products: { low: {} } }, { modules: [], margin_declines: {} }]) {
    assert.throws(() => validateOverviewResponse(data), /resumo da loja veio incompleto/);
  }
});

test('valid overview responses preserve values, record identities and permission omissions', () => {
  const data = Object.freeze({ modules: ['pdv'], sales: { count: 0, total: 0 }, products: { low: { count: 0, products: [] }, margin: null }, fiados: null, payables: null, margin_declines: null });
  assert.equal(validateOverviewResponse(data), data);
  assert.equal(data.fiados, null);
  assert.equal(data.payables, null);
});
