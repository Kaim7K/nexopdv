import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber } from '@/lib/helpers';

export function ChartEmpty({ text }) {
  return (
    <div className="grid h-36 place-items-center rounded-xl border border-dashed border-border bg-muted/15 p-4 text-center text-sm text-muted-foreground sm:h-48">
      {text}
    </div>
  );
}

export function ChartLoading({ height = 'h-40 sm:h-[240px]' }) {
  return (
    <div
      role="status"
      aria-label="Carregando gráfico"
      className={`${height} animate-pulse rounded-xl bg-muted/60 motion-reduce:animate-none`}
    />
  );
}

export function StatCard({ icon: Icon, label, value, change = 0, alert = false }) {
  return (
    <div className={`metric-tile text-card-foreground ${alert ? 'border-orange-400/60' : ''}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
          {label}
        </span>
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted ${alert ? 'text-orange-500' : 'text-accent'}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="truncate text-lg font-black tabular-nums sm:text-xl">{value}</div>
      {change !== 0 && (
        <div
          className={`mt-1 flex items-center gap-1 text-xs font-semibold ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {change > 0 ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {formatNumber(Math.abs(change))}%
        </div>
      )}
    </div>
  );
}

export function MiniMetric({ icon: Icon, label, value, hint }) {
  return (
    <article className="metric-tile flex min-w-0 items-center gap-2.5 sm:gap-3">
      <div className="grid h-7 w-7 flex-none place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent sm:h-8 sm:w-8">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
        <strong className="mt-0.5 block truncate text-base font-black">
          {value}
        </strong>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:text-[11px]">
          {hint}
        </p>
      </div>
    </article>
  );
}

