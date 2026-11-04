import { ArrowDownCircle, ArrowRightLeft, ArrowUpCircle } from 'lucide-react';
import { useFinancePeriodData } from '@/features/finance/use-finance-period-data';
import { EmptyState, LoadingState } from '@/components/common/PageState';
import { formatCurrency, formatDateTime } from '@/lib/helpers';

export default function LedgerPanel({ range }) {
  const { data, loading } = useFinancePeriodData('ledger', range);
  if (loading) return <LoadingState />;
  return <GenericMovementList items={data?.items || []} />;
}
function GenericMovementList({ items }) {
  if (!items.length)
    return (
      <EmptyState
        icon={ArrowRightLeft}
        title="Nenhuma movimentação no período"
        description="Vendas, recebimentos e lançamentos aparecerão aqui automaticamente."
      />
    );
  return (
    <div className="surface-card divide-y divide-border overflow-hidden">
      {items.map((item) => (
        <article
          key={item.id}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.type === 'revenue' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}
          >
            {item.type === 'revenue' ? (
              <ArrowUpCircle className="h-5 w-5" />
            ) : (
              <ArrowDownCircle className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm">
              {item.description}
            </strong>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(item.date)} · {item.origin} · {item.actor}
            </p>
          </div>
          <strong
            className={`text-base tabular-nums ${item.type === 'revenue' ? 'text-emerald-600' : 'text-destructive'}`}
          >
            {item.type === 'revenue' ? '+' : 'âˆ’'}{' '}
            {formatCurrency(item.realized_amount || item.amount)}
          </strong>
        </article>
      ))}
    </div>
  );
}
