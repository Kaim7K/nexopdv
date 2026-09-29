import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Clock,
  DollarSign,
  Edit,
  History,
  Package,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/helpers';
import { buildProductReport } from '@/lib/report-metrics';
import ProductForm from '@/components/stock/ProductForm';
import { DEFAULT_PRODUCT_CATEGORIES } from '@/lib/product-categories';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/PageState';

const ProductSalesChart = lazy(() =>
  import('@/components/reports/ReportCharts').then((module) => ({
    default: module.ProductSalesChart,
  })),
);
const PRODUCT_CHART_VIEWS = [
  { key: 'month', label: 'Mês', title: 'Vendas por mês', rows: 'monthRows' },
  { key: 'day', label: 'Dia', title: 'Vendas por dia', rows: 'dayRows' },
  {
    key: 'weekday',
    label: 'Dia da semana',
    title: 'Vendas por dia da semana',
    rows: 'weekdayRows',
  },
  { key: 'hour', label: 'Hora', title: 'Vendas por horário', rows: 'hourRows' },
];
const PRODUCT_REPORT_PERIODS = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'year', label: 'Ano' },
  { key: 'all', label: 'Tudo' },
  { key: 'custom', label: 'Personalizado' },
];

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getReportPeriodRange = (period, customStart, customEnd) => {
  if (period === 'all') return { startDate: null, endDate: null };
  if (period === 'custom') {
    return { startDate: customStart || null, endDate: customEnd || null };
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  if (period === 'week') startDate.setDate(startDate.getDate() - startDate.getDay());
  if (period === 'month') startDate.setDate(1);
  if (period === 'year') startDate.setMonth(0, 1);
  return { startDate, endDate: now };
};

export default function ProdutoDetalhe() {
  const { id } = useParams();
  const { user } = /** @type {any} */ (useOutletContext());
  const canViewProductReport = ['gerente', 'admin'].includes(user.role);
  const [product, setProduct] = useState(null);
  const [audits, setAudits] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [productData, auditData, saleData] = await Promise.all([
        nexoApi.entities.Product.get(id),
        nexoApi.entities.ProductAudit.filter({ product_id: id }, '-created_date', 50),
        canViewProductReport
          ? nexoApi.sales.productHistory(id)
          : Promise.resolve([]),
      ]);
      setProduct(productData);
      setAudits(auditData);
      setSales(saleData);
    } catch (loadError) {
      setError(loadError.message || 'Não foi possível carregar os dados deste produto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, canViewProductReport]);

  if (loading) return <LoadingState className="min-h-[60vh]" label="Carregando produto..." />;

  return (
    <div className="page-shell max-w-4xl">
      <Link to="/estoque" className="mb-3 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao estoque
      </Link>

      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : !product ? (
        <EmptyState icon={Package} title="Produto não encontrado" description="O item pode ter sido removido ou o endereço está incorreto." />
      ) : (
        <>
          <section className="surface-card mb-3 p-3 sm:p-4" aria-labelledby="product-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="grid aspect-square w-24 flex-none place-items-center overflow-hidden rounded-xl border border-border bg-white sm:w-28">
                {product.image_url ? (
                  <img src={product.image_url} alt={`Imagem de ${product.name}`} className="h-full w-full object-contain p-2" decoding="async" referrerPolicy="no-referrer" />
                ) : (
                  <Package className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${product.status === 'ativo' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                      {product.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                    <h1 id="product-title" className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{product.category || 'Sem categoria'}</p>
                  </div>
                  <button type="button" onClick={() => setShowEdit(true)} className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 sm:min-h-10 sm:px-4 text-sm font-bold text-accent-foreground hover:bg-accent/90 sm:w-auto">
                    <Edit className="h-4 w-4" aria-hidden="true" /> Editar produto
                  </button>
                </div>

                <dl className="mt-3 grid gap-x-5 gap-y-2.5 border-t border-border pt-3 text-sm sm:grid-cols-2">
                  <Detail label="Unidade" value={product.unit || 'Não informada'} />
                  <Detail label="Estoque" value={`${Number(product.quantity || 0).toLocaleString('pt-BR')} ${product.unit === 'peso' ? 'kg' : 'un.'}`} alert={Number(product.quantity || 0) <= 0} />
                  <Detail label="Preço de venda" value={formatCurrency(product.sale_price)} emphasis />
                  <Detail label="Preço de custo" value={product.cost_price !== null && product.cost_price !== '' ? formatCurrency(product.cost_price) : 'Não informado'} />
                  <Detail label="Código de barras" value={product.barcode || 'Não informado'} mono />
                  <Detail label="Código interno" value={product.internal_code || 'Não informado'} mono />
                </dl>
              </div>
            </div>
          </section>

          {canViewProductReport && (
            <ProductSalesReport product={product} sales={sales} />
          )}

          <section className="surface-card p-3 sm:p-4" aria-labelledby="audit-title">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent"><History className="h-5 w-5" aria-hidden="true" /></div>
              <div><h2 id="audit-title" className="font-bold">Histórico de alterações</h2><p className="text-xs text-muted-foreground">Até 50 registros mais recentes</p></div>
            </div>
            {!audits.length ? (
              <EmptyState className="min-h-40 border-0 bg-muted/20" icon={History} title="Nenhuma alteração registrada" description="As próximas mudanças neste produto aparecerão aqui." />
            ) : (
              <ol className="space-y-2">
                {audits.map(audit => (
                  <li key={audit.id} className="relative rounded-lg border border-border bg-muted/15 p-3 pl-4 before:absolute before:bottom-4 before:left-0 before:top-4 before:w-1 before:rounded-r before:bg-accent/60">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <strong className="text-sm">{audit.field_changed}</strong>
                      <time className="text-xs text-muted-foreground" dateTime={audit.created_date}>{formatDateTime(audit.created_date)}</time>
                    </div>
                    <p className="mt-2 break-words text-sm text-muted-foreground">De <span className="font-semibold">“{audit.previous_value || 'vazio'}”</span> para <span className="font-semibold text-foreground">“{audit.new_value || 'vazio'}”</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">Por {audit.user_name || 'Usuário não identificado'} · {audit.change_origin || 'Alteração manual'}{audit.sale_number ? ` · Venda #${audit.sale_number}` : ''}</p>
                    {audit.observation && <p className="mt-2 text-xs italic text-muted-foreground">{audit.observation}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      {showEdit && product && (
        <ProductForm
          product={product}
          categories={DEFAULT_PRODUCT_CATEGORIES}
          user={user}
          onSave={() => { setShowEdit(false); load(); }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}

function ProductSalesReport({ product, sales }) {
  const unitLabel = product.unit === 'peso' ? 'kg' : 'un.';
  const [chartView, setChartView] = useState('month');
  const [period, setPeriod] = useState('month');
  const today = toDateInputValue(new Date());
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const periodRange = useMemo(
    () => getReportPeriodRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  );
  const customPeriodError = period === 'custom' && (
    !customStart || !customEnd || customStart > customEnd
  );
  const report = useMemo(
    () => buildProductReport(
      customPeriodError ? [] : sales,
      product.id,
      periodRange,
    ),
    [customPeriodError, periodRange, product.id, sales],
  );
  const hasSales = report.saleCount > 0;
  const activeChart =
    PRODUCT_CHART_VIEWS.find((view) => view.key === chartView) ||
    PRODUCT_CHART_VIEWS[0];
  const activeRows = report[activeChart.rows];
  const rangeLabel = report.rangeStart && report.rangeEnd
    ? `${report.rangeStart.toLocaleDateString('pt-BR')} a ${report.rangeEnd.toLocaleDateString('pt-BR')}`
    : 'Todo o histórico disponível';

  return (
    <section className="surface-card mb-3 p-3 sm:p-4" aria-labelledby="product-report-title">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-accent/10 text-accent">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="product-report-title" className="font-bold">Relatório de vendas do produto</h2>
            <p className="text-xs text-muted-foreground">
              Totais e padrões calculados a partir das vendas concluídas.
            </p>
          </div>
        </div>
        {report.lastSaleAt && (
          <span className="inline-flex rounded-lg border border-border bg-muted/20 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            Última venda: {formatDateTime(report.lastSaleAt)}
          </span>
        )}
      </div>

      <div className="mb-3 border-y border-border py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-bold">Período do relatório</h3>
            <p className="text-xs text-muted-foreground">
              {rangeLabel}{report.periodDayCount ? ` · ${report.periodDayCount} dia(s)` : ''}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:flex" role="group" aria-label="Período do relatório">
            {PRODUCT_REPORT_PERIODS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={period === option.key}
                onClick={() => setPeriod(option.key)}
                className={`min-h-8 whitespace-nowrap rounded-md px-2.5 text-xs font-bold transition ${
                  period === option.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {period === 'custom' && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Data inicial
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(event) => setCustomStart(event.target.value)}
                className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Data final
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={today}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
          </div>
        )}
        {customPeriodError && (
          <p className="mt-2 text-xs font-semibold text-destructive">
            Informe uma data inicial anterior ou igual à data final.
          </p>
        )}
      </div>

      {customPeriodError ? null : !hasSales ? (
        <EmptyState
          className="min-h-40 border-0 bg-muted/20"
          icon={Receipt}
          title="Ainda não há vendas para este produto"
          description="Quando ele for vendido, os melhores meses, dias e horários aparecerão aqui."
        />
      ) : (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <ReportMetric icon={Receipt} label="Vendas" value={report.saleCount} hint="Vendas concluídas" />
            <ReportMetric icon={Package} label="Quantidade" value={`${formatNumber(report.totalQuantity)} ${unitLabel}`} hint={`${formatNumber(report.averageQuantityPerSale)} por venda`} />
            <ReportMetric icon={DollarSign} label="Faturamento" value={formatCurrency(report.totalRevenue)} hint={`${formatCurrency(report.averageRevenuePerSale)} por venda`} />
            <ReportMetric
              icon={TrendingUp}
              label="Média diária"
              value={`${formatNumber(report.averageDailyQuantity)} ${unitLabel}/dia`}
              hint={`${formatCurrency(report.averageDailyRevenue)} por dia em ${report.periodDayCount} dia(s)`}
            />
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold">Análise temporal</h3>
                <p className="text-xs text-muted-foreground">
                  Escolha como agrupar o período e compare totais e médias diárias.
                </p>
              </div>
              <div
                className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:flex"
                role="group"
                aria-label="Formato do gráfico"
              >
                {PRODUCT_CHART_VIEWS.map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    aria-pressed={chartView === view.key}
                    onClick={() => setChartView(view.key)}
                    className={`min-h-8 whitespace-nowrap rounded-md px-2.5 text-xs font-bold transition ${
                      chartView === view.key
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
              <ProductChartPanel
                title={activeChart.title}
                data={activeRows}
                unitLabel={unitLabel}
              />
              <Distribution
                title={`Detalhamento por ${activeChart.label.toLowerCase()}`}
                rows={activeRows}
                unitLabel={unitLabel}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-2 border-t border-border pt-3 lg:grid-cols-3">
            <InsightCard
              icon={CalendarDays}
              title="Melhor mês"
              value={report.bestMonth?.label || '-'}
              detail={report.bestMonth ? `${formatNumber(report.bestMonth.quantity)} ${unitLabel} · média de ${formatNumber(report.bestMonth.averageDailyQuantity)} por dia` : 'Sem dados'}
            />
            <InsightCard
              icon={CalendarDays}
              title="Melhor dia da semana"
              value={report.bestWeekday?.label || '-'}
              detail={report.bestWeekday ? `${formatNumber(report.bestWeekday.quantity)} ${unitLabel} · média de ${formatNumber(report.bestWeekday.averageDailyQuantity)} a cada ${report.bestWeekday.label.toLowerCase()}` : 'Sem dados'}
            />
            <InsightCard
              icon={Clock}
              title="Melhor horário"
              value={report.bestHour?.label || '-'}
              detail={report.bestHour ? `${formatCurrency(report.bestHour.revenue)} no total · ${formatCurrency(report.bestHour.averageDailyRevenue)} por dia` : 'Sem dados'}
            />
          </div>
        </>
      )}
    </section>
  );
}

function ProductChartPanel({ title, data, unitLabel, className = '' }) {
  return (
    <section className={`min-w-0 rounded-lg border border-border bg-muted/10 p-3 ${className}`}>
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      <Suspense
        fallback={
          <div className="grid h-[210px] place-items-center text-sm text-muted-foreground sm:h-[250px]">
            Carregando gráfico...
          </div>
        }
      >
        <ProductSalesChart data={data} unitLabel={unitLabel} />
      </Suspense>
    </section>
  );
}

function ReportMetric({ icon: Icon, label, value, hint }) {
  return (
    <article className="metric-tile min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase text-muted-foreground sm:text-[11px]">{label}</span>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-accent">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <strong className="block break-words text-lg font-black tabular-nums">{value}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
    </article>
  );
}

function InsightCard({ icon: Icon, title, value, detail }) {
  return (
    <article className="rounded-lg border border-border bg-muted/15 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
        <Icon className="h-4 w-4 text-accent" aria-hidden="true" /> {title}
      </div>
      <strong className="block truncate text-lg font-black">{value}</strong>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function Distribution({ title, rows, unitLabel }) {
  const maxQuantity = Math.max(...rows.map((row) => Number(row.quantity || 0)), 1);
  return (
    <section className="min-w-0 rounded-lg border border-border bg-muted/10 p-3">
      <div className="mb-2">
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="text-[11px] text-muted-foreground">A média inclui dias sem venda.</p>
      </div>
      {rows.length ? (
        <div className="max-h-[300px] space-y-3 overflow-y-auto overscroll-contain pr-1">
          {rows.map((row) => (
            <div key={row.key} className="text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{row.label}</span>
                <span className="flex-none tabular-nums text-muted-foreground">
                  {formatNumber(row.quantity)} {unitLabel}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(100, (Number(row.quantity || 0) / maxQuantity) * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>{row.saleCount} venda(s)</span>
                <span>{formatCurrency(row.revenue)}</span>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-foreground">
                Média diária: {formatNumber(row.averageDailyQuantity)} {unitLabel} · {formatCurrency(row.averageDailyRevenue)}
                <span className="font-normal text-muted-foreground"> ({row.periodDays} dia(s))</span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">Sem dados.</p>
      )}
    </section>
  );
}

function Detail({ label, value, emphasis = false, alert = false, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-words font-semibold ${emphasis ? 'text-base text-accent' : ''} ${alert ? 'text-destructive' : ''} ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
