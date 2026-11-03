import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { getReportPeriod, partitionReportSales } from '../src/features/reports/report-model.js';

// The original filters are kept here only as a measurement reference.
function originalFilters(sales, range) {
  return {
    periodSales: sales.filter(sale => sale.status === 'concluida' && new Date(sale.created_date) >= range.startDate && new Date(sale.created_date) <= range.endDate),
    prevPeriodSales: sales.filter(sale => sale.status === 'concluida' && new Date(sale.created_date) >= range.prevStartDate && new Date(sale.created_date) <= range.prevEndDate),
    cancelledCount: sales.filter(sale => sale.status === 'cancelada' && new Date(sale.created_date) >= range.startDate && new Date(sale.created_date) <= range.endDate).length,
  };
}
function medianTime(run, iterations = 25) {
  for (let index = 0; index < 5; index++) run();
  const times = [];
  for (let index = 0; index < iterations; index++) {
    const start = performance.now(); run(); times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}
const range = getReportPeriod('year', '', '', new Date('2026-11-03T12:00:00-03:00'));
const results = [];
for (const count of [5000, 50000]) {
  const data = Array.from({ length: count }, (_, index) => ({ id: index,
    status: index % 7 === 0 ? 'cancelada' : 'concluida',
    created_date: new Date(Date.UTC(2025 + index % 2, index % 12, 1 + index % 28, index % 24)).toISOString(),
  }));
  assert.deepEqual(partitionReportSales(data, range), originalFilters(data, range));
  const originalMs = medianTime(() => originalFilters(data, range));
  const currentMs = medianTime(() => partitionReportSales(data, range));
  results.push({ sales: count, originalMs: +originalMs.toFixed(3), currentMs: +currentMs.toFixed(3), speedup: +(originalMs / currentMs).toFixed(2) });
}
await mkdir('artifacts/refactor', { recursive: true });
await writeFile('artifacts/refactor/filter-benchmark.json', JSON.stringify({ node: process.version, results }, null, 2));
console.table(results);
console.log('Local CPU benchmark of filtering only; not a production response-time guarantee.');
