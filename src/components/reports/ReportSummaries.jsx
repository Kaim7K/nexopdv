import { Users } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { CHART_COLORS } from './chart-colors';

export function PaymentLegend({ rows }) {
  return (
    <div className="payment-legend space-y-2">
      {rows.map((row, index) => (
        <article
          key={row.method}
          className="rounded-xl border border-border bg-muted/15 p-3"
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-bold"><span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />{row.name}</span>
            <strong className="tabular-nums">{formatCurrency(row.value)}</strong>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, row.percentage)}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% do faturamento
          </p>
        </article>
      ))}
    </div>
  );
}

export function ExecutiveSummary({ stats }) {
  const rows = [
    ['Melhor dia', stats.bestDay?.date || '-', stats.bestDay ? formatCurrency(stats.bestDay.value) : 'Sem vendas'],
    ['Melhor recorte', stats.bestBreakdown?.label || '-', stats.bestBreakdown ? `${stats.bestBreakdown.sales} venda(s)` : 'Sem vendas'],
    ['Produtos no ranking', Object.keys(stats.productMap || {}).length, 'Itens com faturamento'],
    ['Fiado pendente', formatCurrency(stats.pendingFiado), stats.pendingFiado > 0 ? 'Acompanhar recebimento' : 'Sem pendências'],
  ];
  return (
    <section className="surface-card p-3 text-card-foreground sm:p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Users className="h-4 w-4 text-accent" /> Resumo executivo
      </h3>
      <div className="grid gap-2">
        {rows.map(([label, value, detail]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-sm"
          >
            <span className="min-w-0">
              <span className="block font-semibold">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {detail}
              </span>
            </span>
            <strong className="flex-none text-right tabular-nums">{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

