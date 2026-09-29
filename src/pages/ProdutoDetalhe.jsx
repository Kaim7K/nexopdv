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

  const productReport = useMemo(
    () => buildProductReport(sales, id),
    [sales, id],
  );

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
            <ProductSalesReport product={product} report={productReport} />
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

function ProductSalesReport({ product, report }) {
  const hasSales = report.saleCount > 0;
  const unitLabel = product.unit === 'peso' ? 'kg' : 'un.';
  const [chartView, setChartView] = useState('month');
  const activeChart =
    PRODUCT_CHART_VIEWS.find((view) => view.key === chartView) ||
    PRODUCT_CHART_VIEWS[0];

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
              Análise por mês, dia da semana e hora das últimas vendas carregadas.
            </p>
          </div>
        </div>
        {report.lastSaleAt && (
          <span className="inline-flex rounded-lg border border-border bg-muted/20 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            Última venda: {formatDateTime(report.lastSaleAt)}
          </span>
        )}
      </div>

      {!hasSales ? (
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
            <ReportMetric icon={TrendingUp} label="Quando mais vende" value={report.bestWeekday?.label || '-'} hint={report.bestHour ? `${report.bestHour.label} costuma concentrar vendas` : 'Sem horário dominante'} />
          </div>

          <div className="mb-3 grid gap-2 lg:grid-cols-3">
            <InsightCard
              icon={CalendarDays}
              title="Melhor mês"
              value={report.bestMonth?.label || '-'}
              detail={report.bestMonth ? `${formatNumber(report.bestMonth.quantity)} ${unitLabel} vendidos - ${formatCurrency(report.bestMonth.revenue)}` : 'Sem dados'}
            />
            <InsightCard
              icon={CalendarDays}
              title="Melhor dia da semana"
              value={report.bestWeekday?.label || '-'}
              detail={report.bestWeekday ? `${formatNumber(report.bestWeekday.quantity)} ${unitLabel} em ${report.bestWeekday.saleCount} venda(s)` : 'Sem dados'}
            />
            <InsightCard
              icon={Clock}
              title="Melhor horário"
              value={report.bestHour?.label || '-'}
              detail={report.bestHour ? `${formatCurrency(report.bestHour.revenue)} faturados nesse horário` : 'Sem dados'}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Distribution title="Vendas por mês" rows={report.monthRows} unitLabel={unitLabel} />
            <Distribution title="Vendas por dia da semana" rows={report.weekdayRows} unitLabel={unitLabel} />
            <Distribution title="Vendas por hora" rows={report.hourRows} unitLabel={unitLabel} />
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold">Visão gráfica</h3>
                <p className="text-xs text-muted-foreground">
                  Compare quantidade vendida e faturamento líquido.
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
            <ProductChartPanel
              title={activeChart.title}
              data={report[activeChart.rows]}
              unitLabel={unitLabel}
            />
          </div>

          <div className="mt-3 rounded-lg border border-accent/25 bg-accent/5 p-3 text-sm text-accent">
            Este produto vende mais em <strong>{report.bestWeekday?.label}</strong>, principalmente por volta de <strong>{report.bestHour?.label}</strong>. Use esse padrão para reforçar estoque antes dos horários de pico
            {report.weakestHour ? ` e evitar reposição pesada perto de ${report.weakestHour.label}.` : '.'}
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
      <strong className="block truncate text-lg font-black tabular-nums">{value}</strong>
      <span className="mt-1 block truncate text-xs text-muted-foreground">{hint}</span>
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
    <section className="rounded-lg border border-border bg-muted/10 p-3">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {rows.length ? (
        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
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
              <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{row.saleCount} venda(s)</span>
                <span>{formatCurrency(row.revenue)}</span>
              </div>
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
