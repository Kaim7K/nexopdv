import React, { lazy, Suspense, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
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
      help: 'O que entrou após descontos e cancelamentos',
      change: data?.comparison?.revenue,
      icon: ArrowUpCircle,
      tone: 'positive',
    },
    {
      label: 'Despesas',
      value: summary.expenses,
      help: 'Tudo o que saiu para manter o mercado',
      icon: ArrowDownCircle,
      tone: 'negative',
    },
    {
      label: 'Lucro estimado',
      value: summary.estimated_profit,
      help: 'O que restou após custos, taxas e despesas',
      icon: TrendingUp,
      tone: 'info',
    },
    {
      label: 'Saldo disponível',
      value: summary.financial_balance,
      help: 'Total atual das contas financeiras',
      icon: WalletCards,
      tone: 'neutral',
    },
  ];
  return (
    <div className="space-y-5">
      <section aria-labelledby="financial-summary-title">
        <div className="mb-3">
          <h3 id="financial-summary-title" className="text-base font-bold">
            Como está o seu financeiro
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Os quatro números mais importantes do período selecionado.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <MetricCard
              key={card.label}
              {...card}
              value={formatCurrency(card.value)}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs no-print">
        <h3 className="sr-only">O que você quer fazer?</h3>
        <span className="font-semibold text-muted-foreground">Acesso rápido:</span>
        <button
          type="button"
          onClick={() => onAddTransaction('revenue')}
          disabled={!canCreate}
          className="font-bold text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Registrar entrada
        </button>
        <button
          type="button"
          onClick={() => onNavigate('cashflow')}
          className="font-bold text-accent hover:underline"
        >
          Consultar fluxo de caixa
        </button>
      </div>

      {data?.alerts?.length > 0 && (
        <section
          aria-labelledby="financial-alerts-title"
          className="surface-card overflow-hidden"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 id="financial-alerts-title" className="text-sm font-bold">
                Pontos que precisam de atenção
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {data.alerts.length}{' '}
                {data.alerts.length === 1
                  ? 'aviso encontrado'
                  : 'avisos encontrados'}
              </p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {data.alerts.slice(0, 3).map((alert) => (
              <div key={alert.type} className="flex gap-3 px-4 py-3">
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${alert.severity === 'critical' ? 'bg-destructive' : 'bg-amber-500'}`}
                  aria-hidden="true"
                />
                <div>
                  <h4 className="text-xs font-bold">{alert.title}</h4>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                    {alert.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
        <ChartCard title="Entradas, saídas e lucro">
          <p className="-mt-2 mb-3 text-[11px] text-muted-foreground">
            Acompanhe a evolução diária sem confundir faturamento com saldo.
          </p>
          <Suspense fallback={<ChartSkeleton height="h-[260px]" />}>
            <FinanceTrendChart data={data?.series || []} />
          </Suspense>
        </ChartCard>
        <section className="surface-card p-4">
          <h3 className="text-sm font-bold">Próximos compromissos</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Valores pendentes que afetam seu saldo.
          </p>
          <div className="mt-4 space-y-3">
            <FinancialPositionRow
              label="Contas a pagar"
              value={summary.payable}
              help="Ainda precisam ser pagas"
              tone="negative"
              onClick={() => onNavigate('payables')}
            />
            <FinancialPositionRow
              label="Contas a receber"
              value={summary.receivable}
              help="Inclui fiados pendentes"
              tone="positive"
              onClick={() => onNavigate('receivables')}
            />
            <FinancialPositionRow
              label="Dinheiro em caixa"
              value={summary.cash_available}
              help="Caixa físico, carteira e cofre"
              onClick={() => onNavigate('accounts')}
            />
          </div>
        </section>
      </section>

      <details
        className="surface-card group overflow-hidden"
        onToggle={(event) => setAnalyticsOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden hover:bg-muted/40">
          <span>
            <strong className="block text-sm">Ver análises detalhadas</strong>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Margem, faturamento bruto, categorias, pagamentos e produtos.
            </span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        {analyticsOpen && (
          <div className="space-y-4 border-t border-border p-4">
            <section className="grid gap-3 sm:grid-cols-3">
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
            <section className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
              <ChartCard title="Despesas por categoria">
                <Suspense fallback={<ChartSkeleton height="h-[260px]" />}>
                  <ExpenseCategoryChart
                    data={data?.expenses_by_category || []}
                  />
                </Suspense>
              </ChartCard>
              <div className="grid gap-4 lg:grid-cols-2">
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
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left transition hover:border-accent/40 hover:bg-accent/5"
    >
      <span className="min-w-0">
        <strong className="block text-xs">{label}</strong>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
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

function MetricCard({
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
    <article className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${iconTone}`}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
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
      <strong className="mt-2 block break-words text-xl tabular-nums sm:text-2xl">
        {value}
      </strong>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{help}</p>
    </article>
  );
}
function ChartCard({ title, children }) {
  return (
    <section className="surface-card min-w-0 p-4">
      <h3 className="mb-4 text-sm font-bold">{title}</h3>
      {children}
    </section>
  );
}
function ChartSkeleton({ height = 'h-[260px]' }) {
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
      containerClassName="surface-card p-4"
      headerClassName=""
      listClassName="mt-3 space-y-3"
      emptyText="Sem dados no período."
      modalMaxWidth="max-w-xl"
    />
  );
}
