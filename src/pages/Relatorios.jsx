import { BasicReports } from '@/components/plans/BasicOperations';
import { hasPlanFeature } from '@/lib/plan-catalog';
import { useAuth } from '@/lib/AuthContext';
import React, { lazy, Suspense, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  ChartNoAxesColumnIncreasing,
  DollarSign,
  Lightbulb,
  PackageCheck,
  Percent,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/helpers';
import {
  buildReportSummary,
  getReportPeriod,
  partitionReportSales,
} from '@/features/reports/report-model';
import { ErrorState, LoadingState } from '@/components/common/PageState';
import Ranking from '@/components/reports/ReportRanking';
import { ChartEmpty, ChartLoading, StatCard, MiniMetric } from '@/components/reports/ReportMetrics';
import { PaymentLegend, ExecutiveSummary } from '@/components/reports/ReportSummaries';
import { useReportData } from '@/features/reports/use-report-data';
import { buildBreakdownHighlights } from '@/features/reports/breakdown-highlights';
import { PageHeader } from '@/components/common/AppShell';

const PERIODS = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensal' },
  { key: 'year', label: 'Anual' },
  { key: 'custom', label: 'Personalizado' },
];

const BREAKDOWNS = [
  { key: 'hour', label: 'Hora' },
  { key: 'day', label: 'Dia' },
  { key: 'weekday', label: 'Dia da semana' },
  { key: 'month', label: 'Mês' },
];

const BreakdownChart = lazy(() =>
  import('@/components/reports/ReportCharts').then((module) => ({
    default: module.BreakdownChart,
  })),
);
const DailyRevenueChart = lazy(() =>
  import('@/components/reports/ReportCharts').then((module) => ({
    default: module.DailyRevenueChart,
  })),
);
const PaymentChart = lazy(() =>
  import('@/components/reports/ReportCharts').then((module) => ({
    default: module.PaymentChart,
  })),
);

export default function Relatorios() {
  const { user } = useAuth();
  return hasPlanFeature(user, 'advanced_reports') ? <AdvancedReports /> : <BasicReports />;
}

function AdvancedReports() {
  const { sales, fiados, products, loading, loadError, loadData } = useReportData();
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [breakdown, setBreakdown] = useState('hour');
  const [breakdownMetric, setBreakdownMetric] = useState('revenue');
  const [productRankingSort, setProductRankingSort] = useState('revenue');
  const [sellerRankingSort, setSellerRankingSort] = useState('revenue');
  const [categoryRankingSort, setCategoryRankingSort] = useState('revenue');

  const customRangeComplete = period !== 'custom' || (customStart && customEnd);
  const customRangeValid =
    period !== 'custom' ||
    !customRangeComplete ||
    new Date(customStart) <= new Date(customEnd);

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(
    () => getReportPeriod(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  const { periodSales, prevPeriodSales, cancelledCount } = useMemo(
    () => partitionReportSales(
      sales,
      { startDate, endDate, prevStartDate, prevEndDate },
      Boolean(customRangeValid && customRangeComplete),
    ),
    [sales, customRangeValid, customRangeComplete, startDate, endDate, prevStartDate, prevEndDate],
  );

  const stats = useMemo(
    () => buildReportSummary({
      periodSales,
      prevPeriodSales,
      sales,
      fiados,
      products,
      startDate,
      endDate,
      period,
      breakdown,
      cancelledCount,
    }),
    [
      periodSales,
      prevPeriodSales,
      sales,
      fiados,
      products,
      startDate,
      endDate,
      period,
      breakdown,
      cancelledCount,
    ],
  );

  const breakdownHighlights = useMemo(
    () => buildBreakdownHighlights(stats.breakdownData, breakdownMetric),
    [stats.breakdownData, breakdownMetric],
  );

  const productRankingRows = useMemo(() => {
    const rows = Object.values(stats.productMap || {}).map((data) => ({
      name: data.name,
      revenue: Number(data.revenue || 0),
      items: Number(data.qty || 0),
      sales: Number(data.sales || 0),
    }));
    return rows.sort((first, second) =>
      (productRankingSort === 'items'
        ? second.items - first.items
        : second.revenue - first.revenue) ||
      second.revenue - first.revenue ||
      String(first.name).localeCompare(String(second.name), 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  }, [stats.productMap, productRankingSort]);

  const sellerRankingRows = useMemo(() => {
    const rows = (stats.sellerData || []).map(([name, data]) => ({
      name,
      revenue: Number(data.revenue || 0),
      items: Number(data.items || 0),
      sales: Number(data.count || 0),
      average: Number(data.average || 0),
    }));
    return rows.sort((first, second) =>
      (sellerRankingSort === 'items'
        ? second.items - first.items
        : second.revenue - first.revenue) ||
      second.revenue - first.revenue ||
      String(first.name).localeCompare(String(second.name), 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  }, [stats.sellerData, sellerRankingSort]);

  const categoryRankingRows = useMemo(() => {
    const rows = Object.entries(stats.categoryMap || {}).map(([name, data]) => ({
      name,
      revenue: Number(data.revenue || 0),
      items: Number(data.qty || 0),
    }));
    return rows.sort((first, second) =>
      (categoryRankingSort === 'items'
        ? second.items - first.items
        : second.revenue - first.revenue) ||
      second.revenue - first.revenue ||
      String(first.name).localeCompare(String(second.name), 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  }, [stats.categoryMap, categoryRankingSort]);

  const insights = useMemo(() => {
    const list = [];
    if (stats.revenueChange > 0)
      list.push({
        type: 'up',
        text: `As vendas subiram ${formatNumber(stats.revenueChange)}% em relação ao período anterior.`,
      });
    else if (stats.revenueChange < 0)
      list.push({
        type: 'down',
        text: `As vendas caíram ${formatNumber(Math.abs(stats.revenueChange))}% em relação ao período anterior.`,
      });
    if (productRankingRows.length)
      list.push({
        type: 'info',
        text: `O produto com maior faturamento foi ${productRankingRows[0].name}, com ${formatNumber(productRankingRows[0].items)} vendidos.`,
      });
    if (stats.paymentData.length) {
      const topPayment = stats.paymentData[0];
      list.push({
        type: 'info',
        text: `${topPayment.name} representou ${formatNumber(topPayment.percentage)}% do faturamento do período.`,
      });
    }
    if (stats.bestBreakdown)
      list.push({
        type: 'info',
        text: `O melhor recorte foi ${stats.bestBreakdown.label}, com ${formatCurrency(stats.bestBreakdown.revenue)} em ${stats.bestBreakdown.sales} venda(s).`,
      });
    if (stats.itemsPerSale > 0)
      list.push({
        type: 'info',
        text: `Cada venda teve em média ${stats.itemsPerSale.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} item(ns).`,
      });
    if (stats.pendingFiado > 0)
      list.push({
        type: 'alert',
        text: `Há ${formatCurrency(stats.pendingFiado)} em fiados pendentes neste período.`,
      });
    if (stats.cancelled > 0)
      list.push({
        type: 'alert',
        text: `Foram registradas ${stats.cancelled} venda(s) cancelada(s) no período.`,
      });
    return list;
  }, [stats, productRankingRows]);

  if (loading)
    return (
      <LoadingState className="min-h-[60vh]" label="Carregando relatórios..." />
    );
  if (loadError && !sales.length)
    return (
      <div className="page-shell">
        <ErrorState description={loadError} onRetry={loadData} />
      </div>
    );

  return (
    <div className="page-shell">
      <PageHeader
        icon={BarChart3}
        eyebrow="Resultados do mercado"
        title="Relatórios"
        description="Vendas, pagamentos e rankings do período."
      />
      <div className="hidden">
        <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
          <BarChart3 className="h-3.5 w-3.5" /> Resultados do mercado
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Relatórios
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vendas, pagamentos e rankings do período.
        </p>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-3 sm:gap-2">
        {PERIODS.map((item) => (
          <button
            type="button"
            key={item.key}
            aria-pressed={period === item.key}
            onClick={() => setPeriod(item.key)}
            className={`min-h-8 rounded-lg px-3 text-xs font-bold transition sm:min-h-9 sm:text-sm ${period === item.key ? 'bg-accent text-accent-foreground' : 'border border-border bg-card text-card-foreground hover:bg-muted'}`}
          >
            {item.label}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-1.5">
            <CalendarRange className="ml-1 h-4 w-4 text-muted-foreground" />
            <label className="text-xs font-semibold text-muted-foreground">
              De{' '}
              <input
                aria-label="Data inicial"
                type="date"
                value={customStart}
                onChange={(event) => {
                  setCustomStart(event.target.value);
                  setCustomEnd(event.target.value);
                }}
                className="ml-1 min-h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Até{' '}
              <input
                aria-label="Data final"
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="ml-1 min-h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              />
            </label>
          </div>
        )}
      </div>
      {period === 'custom' && !customRangeComplete && (
        <div className="mb-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-semibold text-muted-foreground">
              Escolha a data inicial e final para ver o período personalizado.
        </div>
      )}
      {!customRangeValid && (
        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
          Informe um período válido: a data inicial deve ser anterior ou igual à
          data final.
        </div>
      )}

      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:mb-3 sm:gap-2 md:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Faturamento"
          value={formatCurrency(stats.totalRevenue)}
          change={stats.revenueChange}
        />
        <StatCard icon={ShoppingCart} label="Vendas" value={stats.totalSales} />
        <StatCard
          icon={Receipt}
          label="Ticket médio"
          value={formatCurrency(stats.avgTicket)}
        />
        <StatCard
          icon={AlertTriangle}
          label="Cancelamentos"
          value={stats.cancelled}
          alert={stats.cancelled > 0}
        />
      </div>

      <section className="filter-surface mb-3 grid grid-cols-2 gap-1.5 text-card-foreground sm:gap-2 lg:grid-cols-4">
        <MiniMetric
          icon={ChartNoAxesColumnIncreasing}
          label="Bruto vendido"
          value={formatCurrency(stats.grossRevenue)}
          hint="Antes dos descontos"
        />
        <MiniMetric
          icon={Percent}
          label="Descontos"
          value={formatCurrency(stats.totalDiscount)}
          hint={
            stats.grossRevenue > 0
              ? `${formatNumber((stats.totalDiscount / stats.grossRevenue) * 100)}% do bruto`
              : 'Sem descontos'
          }
        />
        <MiniMetric
          icon={PackageCheck}
          label="Itens vendidos"
          value={Number(stats.totalItems).toLocaleString('pt-BR', {
            maximumFractionDigits: 2,
          })}
          hint={`${stats.itemsPerSale.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} por venda`}
        />
        <MiniMetric
          icon={Trophy}
          label="Melhor recorte"
          value={stats.bestBreakdown?.label || '-'}
          hint={
            stats.bestBreakdown
              ? formatCurrency(stats.bestBreakdown.revenue)
              : 'Sem vendas'
          }
        />
      </section>

      <section className="surface-card mb-3 overflow-hidden text-card-foreground">
        <div className="border-b border-border p-2.5 sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Estatísticas de faturamento</h3>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
            {BREAKDOWNS.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => setBreakdown(item.key)}
                className={`border-b-2 px-2 py-2 text-xs font-bold uppercase transition ${breakdown === item.key ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {stats.breakdownData.length ? (
          <>
            <div className="p-2 sm:p-3">
              <Suspense fallback={<ChartLoading height="h-[280px]" />}>
                <BreakdownChart data={stats.breakdownData} />
              </Suspense>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/25 px-3 py-2 sm:px-4">
              <span className="text-xs font-semibold text-muted-foreground">
                Destacar melhor/pior por
              </span>
              <div className="inline-flex overflow-hidden rounded-lg border border-border bg-background text-xs font-bold shadow-sm">
                <button
                  type="button"
                  onClick={() => setBreakdownMetric('revenue')}
                  className={`px-3 py-1.5 transition ${breakdownMetric === 'revenue' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Faturamento
                </button>
                <button
                  type="button"
                  onClick={() => setBreakdownMetric('sales')}
                  className={`border-l border-border px-3 py-1.5 transition ${breakdownMetric === 'sales' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Vendas
                </button>
              </div>
            </div>
            <div className="grid max-h-56 gap-1.5 overflow-y-auto overscroll-contain border-t border-border p-2 lg:hidden">
              {stats.breakdownData.map((row) => (
                <article
                  key={row.key}
                  className={`rounded-lg border p-2.5 ${breakdownHighlights.get(row)}`}
                >
                  <strong className="block text-sm">{row.label}</strong>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Faturamento</dt>
                      <dd className="mt-1 font-bold tabular-nums">
                        {formatCurrency(row.revenue)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Vendas</dt>
                      <dd className="mt-1 font-bold tabular-nums">
                        {row.sales}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Ticket médio</dt>
                      <dd className="mt-1 font-bold tabular-nums">
                        {formatCurrency(row.average)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden max-h-[28rem] overflow-auto overscroll-contain border-t border-border lg:block">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                  <tr>
                    <th className="px-4 py-3">
                      {BREAKDOWNS.find((item) => item.key === breakdown)?.label}
                    </th>
                    <th className="px-4 py-3">Faturamento</th>
                    <th className="px-4 py-3">Vendas</th>
                    <th className="px-4 py-3">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.breakdownData.map((row) => (
                    <tr
                      key={row.key}
                      className={`border-t border-border/70 ${breakdownHighlights.get(row)}`}
                    >
                      <td className="px-4 py-3 font-bold">{row.label}</td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="px-4 py-3">{row.sales}</td>
                      <td className="px-4 py-3">
                        {formatCurrency(row.average)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <ChartEmpty text="Sem vendas no período selecionado." />
        )}
      </section>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="surface-card p-2.5 text-card-foreground sm:p-3">
          <h3 className="mb-3 text-sm font-bold">
            Faturamento por {period === 'year' ? 'mês' : 'dia'}
          </h3>
          {stats.dailyData.length ? (
            <Suspense fallback={<ChartLoading />}>
              <DailyRevenueChart data={stats.dailyData} />
            </Suspense>
          ) : (
            <ChartEmpty text="Sem vendas no período selecionado." />
          )}
        </section>

        <section className="surface-card p-2.5 text-card-foreground sm:p-3">
          <h3 className="mb-3 text-sm font-bold">Formas de pagamento</h3>
          {stats.paymentData.length ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(240px,0.75fr)]">
              <Suspense fallback={<ChartLoading />}>
                <PaymentChart data={stats.paymentData} />
              </Suspense>
              <PaymentLegend rows={stats.paymentData} />
            </div>
          ) : (
            <ChartEmpty text="Sem pagamentos no período selecionado." />
          )}
        </section>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Ranking
          title="Ranking de produtos"
          sortKey={productRankingSort}
          onSortKeyChange={setProductRankingSort}
          rows={productRankingRows.map((row) => ({
            name: row.name,
            value:
              productRankingSort === 'items'
                ? Number(row.items).toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })
                : formatCurrency(row.revenue),
            detail:
              productRankingSort === 'items'
                ? `${formatCurrency(row.revenue)} de faturamento`
                : `${Number(row.items).toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })} vendidos`,
            percent:
              productRankingSort === 'items'
                ? (row.items / Math.max(1, productRankingRows[0]?.items || 1)) * 100
                : (row.revenue / Math.max(1, stats.totalRevenue || 1)) * 100,
          }))}
        />
        <Ranking
          title="Desempenho por vendedor"
          sortKey={sellerRankingSort}
          onSortKeyChange={setSellerRankingSort}
          rows={sellerRankingRows.map((row) => ({
            name: row.name,
            value:
              sellerRankingSort === 'items'
                ? Number(row.items).toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })
                : formatCurrency(row.revenue),
            detail:
              sellerRankingSort === 'items'
                ? `${formatCurrency(row.revenue)} de faturamento · ${row.sales} vendas`
                : `${Number(row.items).toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })} itens · ${formatCurrency(row.average)} ticket`,
            percent:
              sellerRankingSort === 'items'
                ? (row.items / Math.max(1, sellerRankingRows[0]?.items || 1)) * 100
                : (row.revenue / Math.max(1, stats.totalRevenue || 1)) * 100,
          }))}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Ranking
          title="Categorias com maior receita"
          sortKey={categoryRankingSort}
          onSortKeyChange={setCategoryRankingSort}
          rows={categoryRankingRows.map((row) => ({
            name: row.name,
            value:
              categoryRankingSort === 'items'
                ? Number(row.items).toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })
                : formatCurrency(row.revenue),
            detail:
              categoryRankingSort === 'items'
                ? `${formatCurrency(row.revenue)} de faturamento`
                : `${Number(row.items).toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })} itens`,
            percent:
              categoryRankingSort === 'items'
                ? (row.items / Math.max(1, categoryRankingRows[0]?.items || 1)) * 100
                : (row.revenue / Math.max(1, stats.totalRevenue || 1)) * 100,
          }))}
        />
        <ExecutiveSummary stats={stats} />
      </div>

      <section className="rounded-xl border border-accent/25 bg-accent/5 p-3 sm:p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Lightbulb className="h-5 w-5 text-accent" /> Insights do período
        </h3>
        <div className="space-y-2">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                insight.type === 'up'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : insight.type === 'down'
                    ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                    : insight.type === 'alert'
                      ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
              }`}
            >
              {insight.type === 'up' && (
                <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0" />
              )}
              {insight.type === 'down' && (
                <TrendingDown className="mt-0.5 h-4 w-4 flex-shrink-0" />
              )}
              {insight.type === 'alert' && (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              )}
              {insight.type === 'info' && (
                <BarChart3 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              )}
              {insight.text}
            </div>
          ))}
          {!insights.length && (
            <p className="text-sm text-muted-foreground">
              Sem insights para este período.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
