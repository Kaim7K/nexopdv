import assert from 'node:assert/strict';
import test from 'node:test';
import { rangePreset } from '../src/features/finance/finance-period.js';
import { buildFinanceReportRows, serializeFinanceCsv } from '../src/features/finance/analysis/finance-export.js';

process.env.TZ = 'America/Bahia';

test('financial presets keep the existing dates and never mutate the supplied clock', () => {
  const clock = new Date('2026-11-03T12:00:00-03:00');
  const time = clock.getTime();
  const cases = {
    today: ['2026-11-03', '2026-11-03'],
    yesterday: ['2026-11-02', '2026-11-02'],
    '7days': ['2026-10-28', '2026-11-03'],
    month: ['2026-11-01', '2026-11-03'],
    previous: ['2026-10-01', '2026-10-31'],
  };
  for (const [key, [from, to]] of Object.entries(cases)) assert.deepEqual(rangePreset(key, clock), { from, to });
  assert.equal(clock.getTime(), time);
  assert.deepEqual(rangePreset('previous', new Date('2024-03-01T12:00:00-03:00')), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(rangePreset('previous', new Date('2026-01-01T12:00:00-03:00')), { from: '2025-12-01', to: '2025-12-31' });
});

test('financial presets preserve the original ISO date behavior near midnight', () => {
  const clock = new Date('2026-01-01T23:30:00-03:00');
  assert.deepEqual(rangePreset('today', clock), { from: '2026-01-02', to: '2026-01-02' });
  assert.deepEqual(rangePreset('previous', clock), { from: '2025-12-02', to: '2026-01-01' });
});

test('financial CSV retains field order, raw financial values and the original series', () => {
  const dashboard = Object.freeze({
    summary: Object.freeze({ gross_revenue: 123.456, net_revenue: 100, expenses: 120, estimated_profit: -20, margin: -20 }),
    series: Object.freeze([Object.freeze({ date: '2026-11-03', revenue: 100, expense: 120, profit: -20 })]),
  });
  const rows = buildFinanceReportRows(dashboard);
  assert.deepEqual(rows, [
    ['Indicador', 'Valor'], ['Faturamento bruto', 123.456], ['Receita líquida', 100],
    ['Despesas', 120], ['Lucro estimado', -20], ['Margem', -20], [],
    ['Data', 'Receitas', 'Despesas', 'Lucro'], ['2026-11-03', 100, 120, -20],
  ]);
  assert.match(serializeFinanceCsv(rows), /"Faturamento bruto";"123.456"/);
  assert.equal(dashboard.summary.estimated_profit, -20);
});

test('CSV keeps BOM, semicolons, quotes, newlines and empty fields byte for byte', () => {
  const rows = Object.freeze([
    Object.freeze(['Ação; "teste"', 'linha\nseguinte', null, undefined, 0, false]),
    Object.freeze([]), Object.freeze(['fim']),
  ]);
  const expected = '\ufeff"Ação; ""teste""";"linha\nseguinte";"";"";"0";"false"\n\n"fim"';
  assert.equal(serializeFinanceCsv(rows), expected);
  assert.deepEqual([...Buffer.from(serializeFinanceCsv(rows)).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(serializeFinanceCsv([]), '\ufeff');
});
