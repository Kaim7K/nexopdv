import React, { useEffect, useMemo, useState } from 'react';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { AlertTriangle, BarChart3, DollarSign, Lightbulb, Receipt, ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, PAYMENT_METHODS } from '@/lib/helpers';

const PERIODS = [
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensal' },
  { key: 'year', label: 'Anual' },
  { key: 'custom', label: 'Personalizado' },
];

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(280 65% 60%)',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 12px 30px rgb(0 0 0 / 0.16)',
};

export default function Relatorios() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [fiados, setFiados] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [saleData, fiadoData] = await Promise.all([
        nexoApi.entities.Sale.list('-created_date', 1000),
        nexoApi.entities.FiadoRecord.list('-created_date', 500),
      ]);
      setSales(saleData);
      setFiados(fiadoData);
    } catch {
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
    if (period === 'week') {
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
    return { startDate: start, endDate: end, prevStartDate: prevStart, prevEndDate: prevEnd };
  }, [period, customStart, customEnd]);

  const periodSales = sales.filter(sale => sale.status === 'concluida' && new Date(sale.created_date) >= startDate && new Date(sale.created_date) <= endDate);
  const prevPeriodSales = sales.filter(sale => sale.status === 'concluida' && new Date(sale.created_date) >= prevStartDate && new Date(sale.created_date) <= prevEndDate);

  const stats = useMemo(() => {
    const totalRevenue = periodSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const prevRevenue = prevPeriodSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const totalSales = periodSales.length;
    const avgTicket = totalSales ? totalRevenue / totalSales : 0;
    const cancelled = sales.filter(sale => sale.status === 'cancelada' && new Date(sale.created_date) >= startDate && new Date(sale.created_date) <= endDate).length;

    const productMap = {};
    for (const sale of periodSales) {
      for (const item of sale.items || []) {
        if (!productMap[item.product_name]) productMap[item.product_name] = { qty: 0, revenue: 0 };
        productMap[item.product_name].qty += Number(item.unit === 'peso' ? item.weight : item.quantity) || 0;
        productMap[item.product_name].revenue += Number(item.subtotal || 0);
      }
    }
    const topProducts = Object.entries(productMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

    const paymentMap = {};
    for (const sale of periodSales) {
      for (const payment of sale.payments || []) paymentMap[payment.method] = Number(paymentMap[payment.method] || 0) + Number(payment.amount || 0);
    }
    const paymentData = Object.entries(paymentMap).map(([method, value]) => ({
      name: PAYMENT_METHODS.find(item => item.method === method)?.label || method,
      value,
    }));

    const sellerMap = {};
    for (const sale of periodSales) {
      const seller = sale.seller_name || 'Sem identificação';
      if (!sellerMap[seller]) sellerMap[seller] = { count: 0, revenue: 0 };
      sellerMap[seller].count += 1;
      sellerMap[seller].revenue += Number(sale.total || 0);
    }
    const sellerData = Object.entries(sellerMap).sort((a, b) => b[1].revenue - a[1].revenue);

    const periodFiados = fiados.filter(fiado => new Date(fiado.created_date) >= startDate && new Date(fiado.created_date) <= endDate);
    const pendingFiado = periodFiados.filter(fiado => fiado.status === 'pendente').reduce((sum, fiado) => sum + Number(fiado.total_amount || 0), 0);

    const dailyMap = {};
    for (const sale of periodSales) {
      const date = new Date(sale.created_date);
      const key = period === 'year'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const label = period === 'year'
        ? date.toLocaleDateString('pt-BR', { month: 'short' })
        : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!dailyMap[key]) dailyMap[key] = { date: label, value: 0 };
      dailyMap[key].value += Number(sale.total || 0);
    }
    const dailyData = Object.entries(dailyMap).sort(([first], [second]) => first.localeCompare(second)).map(([, value]) => value);

    return { totalRevenue, revenueChange, totalSales, avgTicket, cancelled, topProducts, paymentData, sellerData, pendingFiado, dailyData };
  }, [periodSales, prevPeriodSales, sales, fiados, startDate, endDate, period]);

  const insights = useMemo(() => {
    const list = [];
    if (stats.revenueChange > 0) list.push({ type: 'up', text: `As vendas subiram ${stats.revenueChange.toFixed(1)}% em relação ao período anterior.` });
    else if (stats.revenueChange < 0) list.push({ type: 'down', text: `As vendas caíram ${Math.abs(stats.revenueChange).toFixed(1)}% em relação ao período anterior.` });
    if (stats.topProducts.length) list.push({ type: 'info', text: `O produto com maior faturamento foi ${stats.topProducts[0][0]}, com ${Number(stats.topProducts[0][1].qty).toFixed(3).replace(/\.000$/, '')} vendidos.` });
    if (stats.paymentData.length) {
      const topPayment = [...stats.paymentData].sort((a, b) => b.value - a.value)[0];
      const percentage = stats.totalRevenue > 0 ? (topPayment.value / stats.totalRevenue) * 100 : 0;
      list.push({ type: 'info', text: `${topPayment.name} representou ${percentage.toFixed(0)}% do faturamento do período.` });
    }
    if (stats.pendingFiado > 0) list.push({ type: 'alert', text: `Há ${formatCurrency(stats.pendingFiado)} em fiados pendentes neste período.` });
    if (stats.cancelled > 0) list.push({ type: 'alert', text: `Foram registradas ${stats.cancelled} venda(s) cancelada(s) no período.` });
    return list;
  }, [stats]);

  if (loading) return <div className="flex h-full items-center justify-center text-muted-foreground">Carregando relatórios...</div>;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Relatórios gerenciais</h1>
        <p className="text-sm text-muted-foreground">Análise de desempenho do período</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PERIODS.map(item => (
          <button key={item.key} onClick={() => setPeriod(item.key)} className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${period === item.key ? 'bg-accent text-accent-foreground' : 'border border-border bg-card text-card-foreground hover:bg-muted'}`}>
            {item.label}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="min-h-10 rounded-xl border border-border bg-card px-3 text-sm" />
            <input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className="min-h-10 rounded-xl border border-border bg-card px-3 text-sm" />
          </>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={DollarSign} label="Faturamento" value={formatCurrency(stats.totalRevenue)} change={stats.revenueChange} />
        <StatCard icon={ShoppingCart} label="Vendas" value={stats.totalSales} />
        <StatCard icon={Receipt} label="Ticket médio" value={formatCurrency(stats.avgTicket)} />
        <StatCard icon={AlertTriangle} label="Cancelamentos" value={stats.cancelled} alert={stats.cancelled > 0} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
          <h3 className="mb-3 text-sm font-bold">Faturamento por {period === 'year' ? 'mês' : 'dia'}</h3>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={stats.dailyData}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={{ stroke: 'hsl(var(--border))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={value => Number(value) >= 1000 ? `R$${(Number(value) / 1000).toFixed(1)}k` : `R$${Number(value).toFixed(0)}`} />
              <Tooltip formatter={value => formatCurrency(value)} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'hsl(var(--popover-foreground))' }} />
              <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
          <h3 className="mb-3 text-sm font-bold">Formas de pagamento</h3>
          <ResponsiveContainer width="100%" height={270}>
            <PieChart>
              <Pie data={stats.paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={86} label={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}>
                {stats.paymentData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={value => formatCurrency(value)} contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Ranking title="Top 5 produtos" rows={stats.topProducts.map(([name, data]) => ({ name, value: formatCurrency(data.revenue), detail: `${Number(data.qty).toFixed(3).replace(/\.000$/, '')} vendidos` }))} />
        <Ranking title="Vendedores" rows={stats.sellerData.map(([name, data]) => ({ name, value: formatCurrency(data.revenue), detail: `${data.count} vendas` }))} />
      </div>

      <section className="rounded-xl border border-accent/25 bg-accent/5 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Lightbulb className="h-5 w-5 text-accent" /> Insights do período</h3>
        <div className="space-y-2">
          {insights.map((insight, index) => (
            <div key={index} className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
              insight.type === 'up' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : insight.type === 'down' ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                  : insight.type === 'alert' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
                    : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
            }`}>
              {insight.type === 'up' && <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0" />}
              {insight.type === 'down' && <TrendingDown className="mt-0.5 h-4 w-4 flex-shrink-0" />}
              {insight.type === 'alert' && <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
              {insight.type === 'info' && <BarChart3 className="mt-0.5 h-4 w-4 flex-shrink-0" />}
              {insight.text}
            </div>
          ))}
          {!insights.length && <p className="text-sm text-muted-foreground">Sem insights para este período.</p>}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, change = 0, alert = false }) {
  return (
    <div className={`rounded-xl border bg-card p-4 text-card-foreground ${alert ? 'border-orange-400/60' : 'border-border'}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={`h-5 w-5 ${alert ? 'text-orange-500' : 'text-accent'}`} />
      </div>
      <div className="text-xl font-black">{value}</div>
      {change !== 0 && (
        <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {change > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function Ranking({ title, rows }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={`${row.name}-${index}`} className="flex items-center justify-between gap-4 rounded-lg px-1 py-1.5 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-black text-accent">{index + 1}</span>
              <span className="truncate">{row.name}</span>
            </span>
            <span className="flex-shrink-0 text-right font-bold">{row.value}<span className="ml-1 text-xs font-normal text-muted-foreground">({row.detail})</span></span>
          </div>
        ))}
        {!rows.length && <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>}
      </div>
    </section>
  );
}
