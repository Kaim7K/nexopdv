import { CircleDollarSign } from 'lucide-react';
import { useFinancePeriodData } from '@/features/finance/use-finance-period-data';
import { EmptyState, LoadingState } from '@/components/common/PageState';
import { MetricCard } from '@/components/finance/FinanceOverview';
import { StatusBadge } from '@/components/finance/TransactionList';
import { formatCurrency, formatDate } from '@/lib/helpers';

export default function ReceivablesPanel({ range }) {
  const { data, loading } = useFinancePeriodData('receivables', range);
  if (loading) return <LoadingState />;
  return (
    <div className="space-y-4">
      <MetricCard
        label="Saldo a receber"
        value={formatCurrency(data?.total)}
        help="Receitas externas e vendas fiadas ainda pendentes"
      />
      {!data?.items?.length ? (
        <EmptyState
          icon={CircleDollarSign}
          title="Nenhum valor pendente"
          description="As vendas fiadas e receitas futuras aparecerão aqui."
        />
      ) : (
        <div className="grid gap-3">
          {data.items.map((item) => (
            <article
              key={`${item.kind}:${item.id}`}
              className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <strong className="text-sm">
                  {item.client || item.description}
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.client ? item.description : item.category} · vence{' '}
                  {formatDate(item.due_date) || 'sem data'}
                </p>
              </div>
              <div className="sm:text-right">
                <strong className="text-base tabular-nums">
                  {formatCurrency(item.remaining_amount)}
                </strong>
                <div className="mt-1">
                  <StatusBadge status={item.status} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
