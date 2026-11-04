import { formatNumber } from '@/lib/helpers';
import RankingList from '@/components/common/RankingList';

export default function Ranking({ title, rows, sortKey = 'revenue', onSortKeyChange }) {
  const renderRow = (row, index) => (
    <div
      key={`${row.name}-${index}`}
      className="relative flex items-center justify-between gap-3 overflow-hidden rounded-lg px-1 py-1.5 text-sm"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-black text-accent">
          {index + 1}
        </span>
        <span className="truncate">{row.name}</span>
      </span>
      <span className="flex-shrink-0 text-right font-bold">
        {row.value}
        <span className="ml-1 hidden text-xs font-normal text-muted-foreground sm:inline">
          ({row.detail})
        </span>
      </span>
      <div className="sr-only">
        Participação: {formatNumber(row.percent || 0)}%
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-muted">
        <div
          className="h-full bg-accent"
          style={{ width: `${Math.min(100, Number(row.percent || 0))}%` }}
        />
      </div>
    </div>
  );

  return (
    <RankingList
      title={title}
      items={rows}
      renderItem={renderRow}
      headerActions={
        onSortKeyChange && (
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => onSortKeyChange('revenue')}
              className={`rounded-md px-2.5 py-1.5 transition ${sortKey === 'revenue' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => onSortKeyChange('items')}
              className={`rounded-md px-2.5 py-1.5 transition ${sortKey === 'items' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Itens
            </button>
          </div>
        )
      }
    />
  );
}
