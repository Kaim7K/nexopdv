/** Preserve the displayed report values and CSV column order. */
export function buildFinanceReportRows(dashboard) {
  return [
    ['Indicador', 'Valor'],
    ['Faturamento bruto', dashboard.summary.gross_revenue],
    ['Receita líquida', dashboard.summary.net_revenue],
    ['Despesas', dashboard.summary.expenses],
    ['Lucro estimado', dashboard.summary.estimated_profit],
    ['Margem', dashboard.summary.margin],
    [],
    ['Data', 'Receitas', 'Despesas', 'Lucro'],
    ...dashboard.series.map((i) => [i.date, i.revenue, i.expense, i.profit]),
  ];
}

export function serializeFinanceCsv(rows) {
  const content = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(';'),
    )
    .join('\n');
  return `\ufeff${content}`;
}

export function downloadFinanceCsv(rows, name) {
  const url = URL.createObjectURL(
    new Blob([serializeFinanceCsv(rows)], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
