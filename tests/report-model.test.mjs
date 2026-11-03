import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildReportSummary, getReportPeriod, partitionReportSales } from '../src/features/reports/report-model.js';
import { now, sales, products, fiados, scenarios, breakdowns } from './fixtures/report-scenarios.mjs';

process.env.TZ = 'America/Bahia';
const baseline = JSON.parse(await readFile(new URL('./fixtures/report-model-baseline.json', import.meta.url), 'utf8'));
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
freeze(sales); freeze(products); freeze(fiados);
const jsonValue = value => JSON.parse(JSON.stringify(value));

for (const [index, scenario] of scenarios.entries()) {
  for (const breakdown of breakdowns) {
    test(`report results match checkpoint 9c3d2fd: case ${index}, ${scenario.period}, ${breakdown}`, () => {
      const range = getReportPeriod(scenario.period, scenario.customStart, scenario.customEnd, new Date(now));
      const complete = scenario.period !== 'custom' || Boolean(scenario.customStart && scenario.customEnd);
      const valid = scenario.period !== 'custom' || !complete || new Date(scenario.customStart) <= new Date(scenario.customEnd);
      const groups = partitionReportSales(sales, range, complete && valid);
      const summary = buildReportSummary({ ...range, ...groups, sales, products, fiados, period: scenario.period, breakdown });
      const expected = baseline[`${index}:${breakdown}`];
      assert.deepEqual(jsonValue(range), expected.range);
      assert.deepEqual(groups.periodSales.map(sale => sale.id), expected.periodIds);
      assert.deepEqual(groups.prevPeriodSales.map(sale => sale.id), expected.previousIds);
      assert.deepEqual(jsonValue(summary), expected.summary);
    });
  }
}

test('report filtering reads each relevant date once and preserves sale identity', () => {
  let reads = 0;
  const sale = { id: 'one', status: 'concluida', get created_date() { reads++; return now; } };
  const range = getReportPeriod('today', '', '', new Date(now));
  const grouped = partitionReportSales([sale], range);
  assert.equal(reads, 1);
  assert.equal(grouped.periodSales[0], sale);
});

test('empty data keeps zero values and input dates are never modified', () => {
  const clock = new Date('2024-02-29T12:00:00-03:00');
  const before = clock.getTime();
  const range = getReportPeriod('month', '', '', clock);
  assert.equal(clock.getTime(), before);
  assert.equal(range.endDate.getDate(), 29);
  const groups = partitionReportSales([], range);
  const summary = buildReportSummary({ ...range, ...groups, sales: [], fiados: [], products: [], period: 'month', breakdown: 'hour' });
  assert.equal(summary.totalRevenue, 0);
  assert.equal(summary.totalSales, 0);
  assert.equal(summary.cancelled, 0);
  assert.deepEqual(summary.paymentData, []);
});
