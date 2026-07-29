import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
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
  Users,
  X,
} from 'lucide-react';
import { formatCurrency, getPaymentLabel } from '@/lib/helpers';
import { ErrorState, LoadingState } from '@/components/common/PageState';

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
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [fiados, setFiados] = useState([]);
  const [breakdown, setBreakdown] = useState('hour');
  const [productRankingSort, setProductRankingSort] = useState('revenue');
  const [sellerRankingSort, setSellerRankingSort] = useState('revenue');
  const [categoryRankingSort, setCategoryRankingSort] = useState('revenue');

  const customRangeValid =
    period !== 'custom' ||
    (customStart && customEnd && new Date(customStart) <= new Date(customEnd));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [saleData, fiadoData, productData] = await Promise.all([
        nexoApi.entities.Sale.list('-created_date', 5000),
        nexoApi.entities.FiadoRecord.list('-created_date', 500),
        nexoApi.products.catalog(2000),
      ]);
      setSales(saleData);
      setFiados(fiadoData);
      setProducts(productData);
    } catch (error) {
      setLoadError(error.message || 'Não foi possível carregar os relatórios.');
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();
    let start;
    let end;
    let prevStart;
    let prevEnd;
    if (period === 'today') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      prevStart = new Date(now);
      prevStart.setDate(prevStart.getDate() - 1);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd = new Date(now);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
    } else {
      start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(0);
      end = customEnd ? new Date(`${customEnd}T23:59:59`) : new Date();
      const difference = Math.max(1, end.getTime() - start.getTime());
      prevStart = new Date(start.getTime() - difference);
      prevEnd = new Date(start.getTime() - 1);
    }
    return {
      startDate: start,
      endDate: end,
      prevStartDate: prevStart,
      prevEndDate: prevEnd,
    };
  }, [period, customStart, customEnd]);

  const { periodSales, prevPeriodSales } = useMemo(
    () => ({
      periodSales: customRangeValid
        ? sales.filter(
            (sale) =>
              sale.status === 'concluida' &&
              new Date(sale.created_date) >= startDate &&
              new Date(sale.created_date) <= endDate,
          )
        : [],
      prevPeriodSales: customRangeValid
        ? sales.filter(
            (sale) =>
              sale.status === 'concluida' &&
              new Date(sale.created_date) >= prevStartDate &&
              new Date(sale.created_date) <= prevEndDate,
          )
        : [],
    }),
    [sales, customRangeValid, startDate, endDate, prevStartDate, prevEndDate],
  );

  const stats = useMemo(() => {
    const totalRevenue = periodSales.reduce(
      (sum, sale) => sum + Number(sale.total || 0),
      0,
    );
    const grossRevenue = periodSales.reduce(
      (sum, sale) => sum + Number(sale.subtotal || sale.total || 0),
      0,
    );
    const totalDiscount = periodSales.reduce(
      (sum, sale) => sum + Number(sale.discount_value || 0),
      0,
    );
    const prevRevenue = prevPeriodSales.reduce(
      (sum, sale) => sum + Number(sale.total || 0),
      0,
    );
    const revenueChange =
      prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const totalSales = periodSales.length;
    const avgTicket = totalSales ? totalRevenue / totalSales : 0;
    const totalItems = periodSales.reduce(
      (sum, sale) =>
        sum +
        (sale.items || []).reduce(
          (itemSum, item) =>
            itemSum +
            (Number(item.unit === 'peso' ? item.weight : item.quantity) || 0),
          0,
        ),
      0,
    );
    const itemsPerSale = totalSales ? totalItems / totalSales : 0;
    const cancelled = sales.filter(
      (sale) =>
        sale.status === 'cancelada' &&
        new Date(sale.created_date) >= startDate &&
        new Date(sale.created_date) <= endDate,
    ).length;

    const productMap = {};
    const categoryMap = {};
    const productLookup = new Map(
      products.map((product) => [String(product.id), product]),
    );
    const normalizeCategory = (value) => {
      const text = String(value ?? '').trim();
      if (!text) return 'Sem categoria';
      if (text.toLowerCase() === 'sem categoria') return 'Sem categoria';
      return text;
    };
    const resolveCategory = (item) => {
      const product = productLookup.get(String(item.product_id));
      return normalizeCategory(
        item.category ||
          item.product_category ||
          item.category_name ||
          item.product?.category ||
          item.product?.category_name ||
          item.product?.product_category ||
          product?.category ||
          product?.category_name ||
          product?.product_category,
      );
    };
    for (const sale of periodSales) {
      for (const item of sale.items || []) {
        const productName = item.product_name || 'Produto sem nome';
        if (!productMap[productName])
          productMap[productName] = { qty: 0, revenue: 0, sales: 0 };
        const quantity =
          Number(item.unit === 'peso' ? item.weight : item.quantity) || 0;
        productMap[productName].qty += quantity;
        productMap[productName].revenue += Number(item.subtotal || 0);
        productMap[productName].sales += 1;
        const category = resolveCategory(item);
        if (!categoryMap[category]) categoryMap[category] = { qty: 0, revenue: 0 };
        categoryMap[category].qty += quantity;
        categoryMap[category].revenue += Number(item.subtotal || 0);
      }
    }

    const paymentMap = {};
    for (const sale of periodSales) {
      for (const payment of sale.payments || [])
        paymentMap[payment.method] =
          Number(paymentMap[payment.method] || 0) + Number(payment.amount || 0);
    }
    const paymentData = Object.entries(paymentMap)
      .map(([method, value]) => ({
        method,
        name: getPaymentLabel(method),
        value,
        percentage: totalRevenue > 0 ? (value / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const sellerMap = {};
    for (const sale of periodSales) {
      const seller = sale.seller_name || 'Sem identificação';
      if (!sellerMap[seller])
        sellerMap[seller] = { count: 0, revenue: 0, items: 0 };
      sellerMap[seller].count += 1;
      sellerMap[seller].revenue += Number(sale.total || 0);
      sellerMap[seller].items += (sale.items || []).reduce(
        (sum, item) =>
          sum +
          (Number(item.unit === 'peso' ? item.weight : item.quantity) || 0),
        0,
      );
    }
    const sellerData = Object.entries(sellerMap)
      .map(([name, data]) => [
        name,
        {
          ...data,
          average: data.count ? data.revenue / data.count : 0,
          share: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        },
      ])
      .sort((a, b) => b[1].revenue - a[1].revenue);

    const periodFiados = fiados.filter(
      (fiado) =>
        new Date(fiado.created_date) >= startDate &&
        new Date(fiado.created_date) <= endDate,
    );
    const pendingFiado = periodFiados
      .filter((fiado) => fiado.status === 'pendente')
      .reduce((sum, fiado) => sum + Number(fiado.total_amount || 0), 0);

    const dailyMap = {};
    for (const sale of periodSales) {
      const date = new Date(sale.created_date);
      const key =
        period === 'year'
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const label =
        period === 'year'
          ? date.toLocaleDateString('pt-BR', { month: 'short' })
          : date.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            });
      if (!dailyMap[key]) dailyMap[key] = { date: label, value: 0 };
      dailyMap[key].value += Number(sale.total || 0);
    }
    const dailyData = Object.entries(dailyMap)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([, value]) => value);

    const breakdownMap = {};
    const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (const sale of periodSales) {
      const date = new Date(sale.created_date);
      let key;
      let label;
      if (breakdown === 'hour') {
        key = date.getHours();
        label = `${key}h`;
      } else if (breakdown === 'weekday') {
        key = date.getDay();
        label = weekdayNames[key];
      } else if (breakdown === 'month') {
        key = date.getMonth();
        label = date
          .toLocaleDateString('pt-BR', { month: 'short' })
          .replace('.', '');
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        label = date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        });
      }
      if (!breakdownMap[key])
        breakdownMap[key] = { key, label, revenue: 0, sales: 0 };
      breakdownMap[key].revenue += Number(sale.total || 0);
      breakdownMap[key].sales += 1;
    }
    const breakdownData = Object.values(breakdownMap)
      .sort((first, second) =>
        String(first.key).localeCompare(String(second.key), 'pt-BR', {
          numeric: true,
        }),
      )
      .map((item) => ({
        ...item,
        average: item.sales ? item.revenue / item.sales : 0,
      }));
    const bestBreakdown = [...breakdownData].sort(
      (first, second) => second.revenue - first.revenue,
    )[0];
    const bestDay = [...dailyData].sort(
      (first, second) => second.value - first.value,
    )[0];

    return {
      totalRevenue,
      grossRevenue,
      totalDiscount,
      revenueChange,
      totalSales,
      avgTicket,
      totalItems,
      itemsPerSale,
      cancelled,
      productMap,
      categoryMap,
      paymentData,
      sellerData,
      pendingFiado,
      dailyData,
      breakdownData,
      bestBreakdown,
      bestDay,
    };
  }, [
    periodSales,
    prevPeriodSales,
    sales,
    fiados,
    startDate,
    endDate,
    period,
    breakdown,
    products,
  ]);

  const productRankingRows = useMemo(() => {
    const rows = Object.entries(stats.productMap || {}).map(([name, data]) => ({
      name,
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
        text: `As vendas subiram ${stats.revenueChange.toFixed(1)}% em relação ao período anterior.`,
      });
    else if (stats.revenueChange < 0)
      list.push({
        type: 'down',
        text: `As vendas caíram ${Math.abs(stats.revenueChange).toFixed(1)}% em relação ao período anterior.`,
      });
    if (productRankingRows.length)
      list.push({
        type: 'info',
        text: `O produto com maior faturamento foi ${productRankingRows[0].name}, com ${Number(
          productRankingRows[0].items,
        )
          .toFixed(3)
          .replace(/\.000$/, '')} vendidos.`,
      });
    if (stats.paymentData.length) {
      const topPayment = stats.paymentData[0];
      list.push({
        type: 'info',
        text: `${topPayment.name} representou ${topPayment.percentage.toFixed(0)}% do faturamento do período.`,
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
        text: `Cada venda teve em média ${stats.itemsPerSale.toFixed(1).replace('.', ',')} item(ns).`,
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
      <div className="mb-4">
        <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
          <BarChart3 className="h-3.5 w-3.5" /> Desempenho do negócio
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Relatórios gerenciais
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe vendas, pagamentos, produtos, equipe e fiados.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PERIODS.map((item) => (
          <button
            type="button"
            key={item.key}
            aria-pressed={period === item.key}
            onClick={() => setPeriod(item.key)}
            className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${period === item.key ? 'bg-accent text-accent-foreground' : 'border border-border bg-card text-card-foreground hover:bg-muted'}`}
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
                onChange={(event) => setCustomStart(event.target.value)}
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
      {!customRangeValid && (
        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
          Informe um período válido: a data inicial deve ser anterior ou igual à
          data final.
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
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

      <section className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground sm:p-4 lg:grid-cols-4">
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
              ? `${((stats.totalDiscount / stats.grossRevenue) * 100).toFixed(1)}% do bruto`
              : 'Sem descontos'
          }
        />
        <MiniMetric
          icon={PackageCheck}
          label="Itens vendidos"
          value={Number(stats.totalItems).toLocaleString('pt-BR', {
            maximumFractionDigits: 3,
          })}
          hint={`${stats.itemsPerSale.toFixed(1).replace('.', ',')} por venda`}
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

      <section className="mb-4 overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
        <div className="border-b border-border p-3 sm:p-4">
          <h3 className="text-sm font-bold">Estatísticas de faturamento</h3>
          <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
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
            <div className="p-3 sm:p-4">
              <Suspense fallback={<ChartLoading height="h-[280px]" />}>
                <BreakdownChart data={stats.breakdownData} />
              </Suspense>
            </div>
            <div className="grid gap-2 border-t border-border p-3 lg:hidden">
              {stats.breakdownData.map((row) => (
                <article
                  key={row.key}
                  className="rounded-xl border border-border bg-muted/15 p-3"
                >
                  <strong className="block text-sm">{row.label}</strong>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
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
            <div className="hidden overflow-x-auto border-t border-border lg:block">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
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
                    <tr key={row.key} className="border-t border-border/70">
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

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-3 text-card-foreground sm:p-4">
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

        <section className="rounded-xl border border-border bg-card p-3 text-card-foreground sm:p-4">
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
                    maximumFractionDigits: 3,
                  })
                : formatCurrency(row.revenue),
            detail:
              productRankingSort === 'items'
                ? `${formatCurrency(row.revenue)} de faturamento`
                : `${Number(row.items).toLocaleString('pt-BR', {
                    maximumFractionDigits: 3,
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
                    maximumFractionDigits: 3,
                  })
                : formatCurrency(row.revenue),
            detail:
              sellerRankingSort === 'items'
                ? `${formatCurrency(row.revenue)} de faturamento · ${row.sales} vendas`
                : `${Number(row.items).toLocaleString('pt-BR', {
                    maximumFractionDigits: 3,
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
                    maximumFractionDigits: 3,
                  })
                : formatCurrency(row.revenue),
            detail:
              categoryRankingSort === 'items'
                ? `${formatCurrency(row.revenue)} de faturamento`
                : `${Number(row.items).toLocaleString('pt-BR', {
                    maximumFractionDigits: 3,
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

function ChartEmpty({ text }) {
  return (
    <div className="grid h-[270px] place-items-center rounded-xl border border-dashed border-border bg-muted/15 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ChartLoading({ height = 'h-[270px]' }) {
  return (
    <div
      role="status"
      aria-label="Carregando gráfico"
      className={`${height} animate-pulse rounded-xl bg-muted/60 motion-reduce:animate-none`}
    />
  );
}

function StatCard({ icon: Icon, label, value, change = 0, alert = false }) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 text-card-foreground ${alert ? 'border-orange-400/60' : 'border-border'}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Icon
          className={`h-5 w-5 ${alert ? 'text-orange-500' : 'text-accent'}`}
        />
      </div>
      <div className="text-xl font-black">{value}</div>
      {change !== 0 && (
        <div
          className={`mt-1 flex items-center gap-1 text-xs font-semibold ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {change > 0 ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value, hint }) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <strong className="mt-0.5 block truncate text-base font-black">
          {value}
        </strong>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {hint}
        </p>
      </div>
    </article>
  );
}

function PaymentLegend({ rows }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <article
          key={row.method}
          className="rounded-xl border border-border bg-muted/15 p-3"
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold">{row.name}</span>
            <strong className="tabular-nums">{formatCurrency(row.value)}</strong>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, row.percentage)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.percentage.toFixed(1).replace('.', ',')}% do faturamento
          </p>
        </article>
      ))}
    </div>
  );
}

function ExecutiveSummary({ stats }) {
  const rows = [
    ['Melhor dia', stats.bestDay?.date || '-', stats.bestDay ? formatCurrency(stats.bestDay.value) : 'Sem vendas'],
    ['Melhor recorte', stats.bestBreakdown?.label || '-', stats.bestBreakdown ? `${stats.bestBreakdown.sales} venda(s)` : 'Sem vendas'],
    ['Produtos no ranking', Object.keys(stats.productMap || {}).length, 'Itens com faturamento'],
    ['Fiado pendente', formatCurrency(stats.pendingFiado), stats.pendingFiado > 0 ? 'Acompanhar recebimento' : 'Sem pendências'],
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Users className="h-4 w-4 text-accent" /> Resumo executivo
      </h3>
      <div className="grid gap-2">
        {rows.map(([label, value, detail]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-sm"
          >
            <span className="min-w-0">
              <span className="block font-semibold">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {detail}
              </span>
            </span>
            <strong className="flex-none text-right tabular-nums">{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ranking({ title, rows, sortKey = 'revenue', onSortKeyChange }) {
  const [open, setOpen] = useState(false);
  const visibleRows = rows.slice(0, 5);
  const hasMore = rows.length > visibleRows.length;
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
        Participação: {Number(row.percent || 0).toFixed(1)}%
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
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {onSortKeyChange && (
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
        )}
      </div>
      <div className="space-y-2">
        {visibleRows.map(renderRow)}
        {!rows.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sem dados no período.
          </p>
        )}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-border bg-muted/30 px-3 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          Ver ranking completo ({rows.length})
        </button>
      )}
      {open && (
        <RankingModal
          title={title}
          rows={rows}
          onClose={() => setOpen(false)}
          renderRow={renderRow}
        />
      )}
    </section>
  );
}

function RankingModal({ title, rows, onClose, renderRow }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} completo`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3"
      onClick={onClose}
    >
      <section
        className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">{title}</h3>
            <p className="text-xs text-muted-foreground">{rows.length} item(ns)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ranking completo"
            className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[calc(88vh-4.5rem)] overflow-y-auto p-4">
          <div className="space-y-2">{rows.map(renderRow)}</div>
        </div>
      </section>
    </div>
  );
}
