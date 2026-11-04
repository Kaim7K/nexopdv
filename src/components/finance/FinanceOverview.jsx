import React, { lazy, Suspense, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import RankingList from '@/components/common/RankingList';
import { formatCurrency, getPaymentLabel } from '@/lib/helpers';

const FinanceTrendChart = lazy(() =>
  import('@/components/finance/FinanceCharts').then((module) => ({
    default: module.FinanceTrendChart,
  })),
);
const ExpenseCategoryChart = lazy(() =>
  import('@/components/finance/FinanceCharts').then((module) => ({
    default: module.ExpenseCategoryChart,
  })),
);

export default function Overview({ data, onNavigate, onAddTransaction, canCreate }) {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const summary = data?.summary || {};
  const cards = [
    {
      label: 'Receita líquida',
      value: summary.net_revenue,
      help: 'Entradas confirmadas',
      change: data?.comparison?.revenue,
      icon: ArrowUpCircle,
      tone: 'positive',
    },
    {
      label: 'Despesas',
      value: summary.expenses,
      help: 'Saídas confirmadas',
      icon: ArrowDownCircle,
      tone: 'negative',
    },
    {
      label: 'Lucro estimado',
      value: summary.estimated_profit,
      help: 'Receita - despesas',
      icon: TrendingUp,
      tone: 'info',
    },
    {
      label: 'Saldo disponível',
      value: summary.financial_balance,
      help: 'Disponível agora',
      icon: WalletCards,
      tone: 'neutral',
    },
  ];
  return (
    <div className="space-y-5">
      <section aria-labelledby="financial-summary-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 id="financial-summary-title" className="text-base font-bold">Resumo financeiro</h3><p className="mt-1 text-sm text-muted-foreground">Resultado do período e posição atual das contas.</p></div>
          <div className="flex flex-wrap gap-2 no-print">
            <button type="button" onClick={() => onAddTransaction('revenue')} disabled={!canCreate} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"><Plus aria-hidden="true" className="h-4 w-4" />Nova entrada</button>
            <button type="button" onClick={() => onNavigate('cashflow')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted">Ver fluxo<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid gap-3 min-[380px]:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => <OverviewMetricCard key={card.label} {...card} value={formatCurrency(card.value)} />)}
        </div>
      </section>

      {data?.alerts?.length > 0 && (
        <section aria-labelledby="financial-alerts-title" className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-3 px-4 py-3"><AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" /><h3 id="financial-alerts-title" className="text-sm font-bold">Atenção ao financeiro</h3><span className="ml-auto text-xs text-muted-foreground">{data.alerts.length} {data.alerts.length === 1 ? 'aviso' : 'avisos'}</span></div>
          <ul className="divide-y divide-amber-500/20 border-t border-amber-500/20">{data.alerts.map((alert, index) => <li key={`${alert.type}-${index}`} className="flex gap-3 px-4 py-3"><span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.severity === 'critical' ? 'bg-destructive' : 'bg-amber-500'}`} /><div><h4 className="text-sm font-semibold">{alert.title}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.description}</p></div></li>)}</ul>
        </section>
      )}

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div className="surface-card min-w-0 p-4 sm:p-5">
          <div className="mb-5"><h3 className="font-bold">Entradas, saídas e lucro</h3><p className="mt-1 text-xs text-muted-foreground">Acompanhe a evolução dos valores no período.</p></div>
          {data?.series?.length > 0 ? <Suspense fallback={<ChartSkeleton height="h-[260px]" />}><FinanceTrendChart data={data.series} /></Suspense> : <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 text-center"><TrendingUp aria-hidden="true" className="h-6 w-6 text-muted-foreground" /><p className="text-sm font-semibold">Sem movimentação no período</p><p className="text-xs text-muted-foreground">As entradas e saídas aparecerão aqui.</p></div>}
        </div>
        <section className="surface-card min-w-0 p-4 sm:p-5" aria-labelledby="financial-position-title">
          <h3 id="financial-position-title" className="font-bold">Próximos compromissos</h3>
          <p className="mt-1 text-xs text-muted-foreground">Pendências e dinheiro disponível agora.</p>
          <div className="mt-5 space-y-3">
            <FinancialPositionRow label="Contas a pagar" value={summary.payable} help="Ainda precisam ser pagas" tone="negative" onClick={() => onNavigate('payables')} />
            <FinancialPositionRow label="Contas a receber" value={summary.receivable} help="Inclui fiados pendentes" tone="positive" onClick={() => onNavigate('receivables')} />
            <FinancialPositionRow label="Dinheiro em caixa" value={summary.cash_available} help="Caixa físico, carteira e cofre" onClick={() => onNavigate('accounts')} />
          </div>
        </section>
      </section>
      <details
        className="surface-card group overflow-hidden"
        onToggle={(event) => setAnalyticsOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden hover:bg-muted/40">
          <span>
            <strong className="block text-sm">Análises detalhadas</strong>
            <span className="mt-1 block text-xs text-muted-foreground">
              Margem, categorias, pagamentos e produtos.
            </span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        {analyticsOpen && (
          <div className="space-y-3 border-t border-border p-2.5 sm:p-3">
            <section className="grid gap-2 sm:grid-cols-3">
              <MetricCard
                label="Faturamento bruto"
                value={formatCurrency(summary.gross_revenue)}
                help="Total vendido antes dos descontos"
              />
              <MetricCard
                label="Margem de lucro"
                value={`${Number(summary.margin || 0).toLocaleString('pt-BR')}%`}
                help="Quanto do faturamento virou lucro"
              />
              <MetricCard
                label="Disponível em caixa"
                value={formatCurrency(summary.cash_available)}
                help="Dinheiro com disponibilidade imediata"
              />
            </section>
            <section className="grid gap-3 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
              <ChartCard title="Despesas por categoria">
                <Suspense fallback={<ChartSkeleton height="h-[220px] sm:h-[240px]" />}>
                  <ExpenseCategoryChart
                    data={data?.expenses_by_category || []}
                  />
                </Suspense>
              </ChartCard>
              <div className="grid gap-3 lg:grid-cols-2">
                <SimpleRanking
                  title="Formas de pagamento"
                  items={Object.entries(data?.payments || {}).map(
                    ([label, value]) => ({
                      label: getPaymentLabel(label),
                      value,
                    }),
                  )}
                />
                <SimpleRanking
                  title="Produtos que mais geraram receita"
                  items={data?.top_products || []}
                />
              </div>
            </section>
          </div>
        )}
      </details>
    </div>
  );
}

function OverviewMetricCard({ label, value, help, change = null, icon: Icon, tone }) {
  const tones = {
    positive: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    negative: 'bg-red-500/10 text-red-700 dark:text-red-300',
    info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    neutral: 'bg-muted text-muted-foreground',
  };
  return <article className="surface-card min-w-0 p-4 sm:p-5">
    <div className="flex items-start justify-between gap-2"><h4 className="pt-1 text-sm font-medium text-muted-foreground">{label}</h4><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon aria-hidden="true" className="h-4 w-4" /></span></div>
    <p className="mt-4 break-words text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</p>
    <div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-xs leading-5 text-muted-foreground">{help}</p>{change !== null && change !== undefined && <span title="Comparação com o período anterior" className={`rounded-md px-2 py-1 text-xs font-semibold ${change >= 0 ? tones.positive : tones.negative}`}>{change > 0 ? '+' : ''}{change}%</span>}</div>
  </article>;
}

function FinancialPositionRow({
  label,
  value,
  help,
  tone = 'neutral',
  onClick,
}) {
  const toneClass =
    tone === 'negative'
      ? 'text-destructive'
      : tone === 'positive'
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-foreground';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-left transition hover:border-accent/40 hover:bg-accent/5"
    >
      <span className="min-w-0">
        <strong className="block text-sm">{label}</strong>
        <span className="mt-1 block text-xs text-muted-foreground">
          {help}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <strong className={`text-sm tabular-nums ${toneClass}`}>
          {formatCurrency(value)}
        </strong>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </span>
    </button>
  );
}

export function MetricCard({
  label,
  value,
  help,
  change = null,
  icon: Icon = null,
  tone = 'neutral',
}) {
  const iconTone = {
    positive: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    negative: 'bg-destructive/10 text-destructive',
    info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    neutral: 'bg-muted text-muted-foreground',
  }[tone];
  return (
    <article className="metric-tile flex min-w-0 items-center gap-2 sm:block">
      {Icon && (
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:hidden ${iconTone}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && (
              <span
                className={`hidden h-7 w-7 shrink-0 place-items-center rounded-lg border border-border/40 sm:grid ${iconTone}`}
              >
                <Icon className="h-4 w-4" />
              </span>
            )}
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
              {label}
            </p>
          </div>
          {change !== null && change !== undefined && (
            <span
              title="Comparação com o período anterior"
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${change >= 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}
            >
              {change > 0 ? '+' : ''}
              {change}%
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2 sm:block">
          <strong className="block break-words text-sm font-black tabular-nums min-[380px]:text-base sm:mt-1 sm:text-lg">
            {value}
          </strong>
          <p className="hidden line-clamp-1 text-[10px] leading-4 text-muted-foreground sm:mt-1 sm:block sm:text-[11px]">
            {help}
          </p>
        </div>
      </div>
    </article>
  );
}
export function ChartCard({ title, children }) {
  return (
    <section className="surface-card min-w-0 p-2.5 sm:p-3">
      <h3 className="mb-2 text-sm font-black">{title}</h3>
      {children}
    </section>
  );
}
export function ChartSkeleton({ height = 'h-[220px] sm:h-[240px]' }) {
  return (
    <div
      role="status"
      aria-label="Carregando gráfico"
      className={`${height} animate-pulse rounded-xl bg-muted/60 motion-reduce:animate-none`}
    />
  );
}
function SimpleRanking({ title, items }) {
  const rows = items || [];
  const renderItem = (item, index) => (
    <div key={`${item.label}-${index}`} className="flex items-center gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {item.label}
      </span>
      <strong className="shrink-0 text-sm tabular-nums">
        {formatCurrency(item.revenue ?? item.value)}
      </strong>
    </div>
  );

  return (
    <RankingList
      title={title}
      items={rows}
      renderItem={renderItem}
      containerClassName="surface-card p-3 sm:p-4"
      headerClassName=""
      listClassName="mt-3 space-y-3"
      emptyText="Sem dados no período."
      modalMaxWidth="max-w-xl"
    />
  );
}
