import { Check } from 'lucide-react';
import { useFinancePeriodData } from '@/features/finance/use-finance-period-data';
import { EmptyState, LoadingState } from '@/components/common/PageState';
import { MetricCard } from '@/components/finance/FinanceOverview';
import { formatCurrency, formatDateTime } from '@/lib/helpers';

export default function Reconciliation({ range }) {
  const { data, loading } = useFinancePeriodData('reconciliation', range);
  if (loading) return <LoadingState />;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Vendas conciliadas"
          value={formatCurrency(data?.totals?.sales)}
          help="Total vendido nos caixas do período"
        />
        <MetricCard
          label="Diferença acumulada"
          value={formatCurrency(data?.totals?.differences)}
          help="Declarado menos esperado"
        />
        <MetricCard
          label="Caixas com divergência"
          value={String(data?.totals?.sessions_with_difference || 0)}
          help="Exigem investigação"
        />
      </section>
      {!data?.sessions?.length ? (
        <EmptyState
          icon={Check}
          title="Nenhum caixa no período"
          description="Abra e feche caixas pelo PDV para acompanhar a conciliação."
        />
      ) : (
        <div className="grid gap-3">
          {data.sessions.map((item) => (
            <article
              key={item.id}
              className={`surface-card p-4 ${item.has_difference ? 'border-amber-500/40' : ''}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <strong className="text-sm">{item.operator}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aberto em {formatDateTime(item.opened_at)} ·{' '}
                    {item.sales_count} venda(s)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-right sm:grid-cols-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground">
                      Esperado
                    </span>
                    <strong className="block text-sm">
                      {formatCurrency(item.expected_cash)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">
                      Declarado
                    </span>
                    <strong className="block text-sm">
                      {item.declared_cash === null
                        ? 'Em aberto'
                        : formatCurrency(item.declared_cash)}
                    </strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-muted-foreground">
                      Diferença
                    </span>
                    <strong
                      className={`block text-sm ${item.has_difference ? 'text-destructive' : ''}`}
                    >
                      {item.difference === null
                        ? '-'
                        : formatCurrency(item.difference)}
                    </strong>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

