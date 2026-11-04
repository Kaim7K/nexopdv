import assert from 'node:assert/strict';
import test from 'node:test';
import { loadReportData } from '../src/features/reports/report-data.js';
import { buildBreakdownHighlights } from '../src/features/reports/breakdown-highlights.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((resolveValue, rejectValue) => { resolve = resolveValue; reject = rejectValue; });
  return { promise, resolve, reject };
}

test('report data requests start in parallel with the existing limits and publish one complete result', async () => {
  const sale = deferred(), fiado = deferred(), product = deferred();
  const calls = [];
  const api = {
    entities: {
      Sale: { list: (...args) => { calls.push(['sales', ...args]); return sale.promise; } },
      FiadoRecord: { list: (...args) => { calls.push(['fiados', ...args]); return fiado.promise; } },
    },
    products: { catalog: (...args) => { calls.push(['products', ...args]); return product.promise; } },
  };
  const pending = loadReportData(api);
  assert.deepEqual(calls, [['sales', '-created_date', 5000], ['fiados', '-created_date', 500], ['products', 2000]]);
  let finished = false;
  pending.then(() => { finished = true; });
  const sales = Object.freeze([Object.freeze({ id: 'sale-1', total: 10 })]);
  const fiados = Object.freeze([Object.freeze({ id: 'fiado-1', status: 'pendente' })]);
  const products = Object.freeze([Object.freeze({ id: 'product-1', quantity: 20 })]);
  sale.resolve(sales); fiado.resolve(fiados);
  await Promise.resolve();
  assert.equal(finished, false);
  product.resolve(products);
  const result = await pending;
  assert.equal(result.sales, sales);
  assert.equal(result.fiados, fiados);
  assert.equal(result.products, products);
});

test('failed report data does not become a partial snapshot and the next load can succeed', async () => {
  let failed = true;
  const rows = [{ id: 'sale-1' }];
  const api = {
    entities: {
      Sale: { list: async () => { if (failed) throw new Error('Connection interrupted'); return rows; } },
      FiadoRecord: { list: async () => [] },
    },
    products: { catalog: async () => [] },
  };
  await assert.rejects(loadReportData(api), /Connection interrupted/);
  failed = false;
  assert.deepEqual(await loadReportData(api), { sales: rows, fiados: [], products: [] });
});

test('breakdown highlights preserve best, worst, regular, ties and metric switching', () => {
  const rows = Object.freeze([
    Object.freeze({ revenue: 100, sales: 1 }),
    Object.freeze({ revenue: 40, sales: 5 }),
    Object.freeze({ revenue: 10, sales: 2 }),
    Object.freeze({ revenue: 100, sales: 1 }),
  ]);
  const revenue = buildBreakdownHighlights(rows, 'revenue');
  assert.match(revenue.get(rows[0]), /emerald/);
  assert.equal(revenue.get(rows[0]), revenue.get(rows[3]));
  assert.equal(revenue.get(rows[1]), 'border-border bg-card');
  assert.match(revenue.get(rows[2]), /red/);
  const count = buildBreakdownHighlights(rows, 'sales');
  assert.match(count.get(rows[0]), /red/);
  assert.match(count.get(rows[1]), /emerald/);
  assert.equal(count.get(rows[2]), 'border-border bg-card');
  assert.equal(buildBreakdownHighlights([], 'revenue').size, 0);
  const same = [{ revenue: 0 }, { revenue: 0 }];
  for (const tone of buildBreakdownHighlights(same, 'revenue').values()) assert.equal(tone, 'border-border bg-muted/15');
  const single = [{ revenue: 20 }];
  assert.equal(buildBreakdownHighlights(single, 'revenue').get(single[0]), 'border-border bg-muted/15');
});

test('breakdown highlights read a metric once per row instead of once per row comparison', () => {
  let reads = 0;
  const rows = Array.from({ length: 1000 }, (_, index) => ({ get revenue() { reads++; return index; } }));
  const tones = buildBreakdownHighlights(rows, 'revenue');
  assert.equal(reads, rows.length);
  assert.equal(tones.size, rows.length);
  assert.match(tones.get(rows[0]), /red/);
  assert.match(tones.get(rows.at(-1)), /emerald/);
});
