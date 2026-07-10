import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, DollarSign, ShoppingCart, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { formatCurrency, PAYMENT_METHODS, formatDate } from '@/lib/helpers';

const PERIODS = [
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensal' },
  { key: 'year', label: 'Anual' },
  { key: 'custom', label: 'Personalizado' },
];

const CHART_COLORS = ['hsl(87 51% 48%)', 'hsl(125 30% 35%)', 'hsl(45 90% 55%)', 'hsl(0 70% 55%)', 'hsl(200 60% 50%)', 'hsl(280 65% 60%)'];

export default function Relatorios() {
  const { user } = useOutletContext();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [fiados, setFiados] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const s = await base44.entities.Sale.list('-created_date', 500);
      setSales(s.filter(x => x.status === 'concluida'));
      const f = await base44.entities.FiadoRecord.list('-created_date', 200);
      setFiados(f);
    } catch { toast.error('Erro ao carregar dados'); }
    setLoading(false);
  };

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();
    let start, end, prevStart, prevEnd;
    if (period === 'week') {
      start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
      end = new Date(now); end.setHours(23, 59, 59, 999);
      prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
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
      start = customStart ? new Date(customStart + 'T00:00:00') : new Date(0);
      end = customEnd ? new Date(customEnd + 'T23:59:59') : new Date();
      const diffMs = end - start;
      prevStart = new Date(start.getTime() - diffMs);
      prevEnd = new Date(start.getTime() - 1);
    }
    return { startDate: start, endDate: end, prevStartDate: prevStart, prevEndDate: prevEnd };
  }, [period, customStart, customEnd]);

  const periodSales = sales.filter(s => {
    const d = new Date(s.created_date);
    return d >= startDate && d <= endDate;
  });

  const prevPeriodSales = sales.filter(s => {
    const d = new Date(s.created_date);
    return d >= prevStartDate && d <= prevEndDate;
  });

  const stats = useMemo(() => {
    const totalRevenue = periodSales.reduce((s, x) => s + (x.total || 0), 0);
    const prevRevenue = prevPeriodSales.reduce((s, x) => s + (x.total || 0), 0);
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
    const totalSales = periodSales.length;
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const cancelled = sales.filter(s => s.status === 'cancelada' && new Date(s.created_date) >= startDate && new Date(s.created_date) <= endDate).length;
    const discounts = periodSales.reduce((s, x) => s + (x.discount_value || 0), 0);

    // Top products
    const productMap = {};
    periodSales.forEach(s => {
      (s.items || []).forEach(item => {
        if (!productMap[item.product_name]) productMap[item.product_name] = { qty: 0, revenue: 0 };
        const qty = item.unit === 'peso' ? item.weight : item.quantity;
        productMap[item.product_name].qty += qty || 0;
        productMap[item.product_name].revenue += item.subtotal || 0;
      });
    });
    const topProducts = Object.entries(productMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

    // Payment methods
    const payMap = {};
    periodSales.forEach(s => {
      (s.payments || []).forEach(p => {
        if (!payMap[p.method]) payMap[p.method] = 0;
        payMap[p.method] += p.amount || 0;
      });
    });
    const paymentData = Object.entries(payMap).map(([k, v]) => ({ name: PAYMENT_METHODS.find(m => m.method === k)?.label || k, value: v }));

    // Seller performance
    const sellerMap = {};
    periodSales.forEach(s => {
      if (!sellerMap[s.seller_name]) sellerMap[s.seller_name] = { count: 0, revenue: 0 };
      sellerMap[s.seller_name].count++;
      sellerMap[s.seller_name].revenue += s.total || 0;
    });
    const sellerData = Object.entries(sellerMap).sort((a, b) => b[1].revenue - a[1].revenue);

    // Fiado stats
    const periodFiados = fiados.filter(f => new Date(f.created_date) >= startDate && new Date(f.created_date) <= endDate);
    const pendingFiado = periodFiados.filter(f => f.status === 'pendente').reduce((s, f) => s + (f.total_amount || 0), 0);

    // Daily revenue
    const dailyMap = {};
    periodSales.forEach(s => {
      const d = new Date(s.created_date).toLocaleDateString('pt-BR', { day: '2-digit', month: period === 'year' ? 'short' : '2-digit' });
      if (!dailyMap[d]) dailyMap[d] = 0;
      dailyMap[d] += s.total || 0;
    });
    const dailyData = Object.entries(dailyMap).map(([date, value]) => ({ date, value }));

    return { totalRevenue, prevRevenue, revenueChange, totalSales, avgTicket, cancelled, discounts, topProducts, paymentData, sellerData, pendingFiado, dailyData, periodFiados };
  }, [periodSales, prevPeriodSales, sales, fiados, startDate, endDate]);

  const insights = useMemo(() => {
    const list = [];
    if (stats.revenueChange > 0) list.push({ type: 'up', text: `As vendas ${period === 'week' ? 'desta semana' : period === 'month' ? 'deste mês' : 'deste período'} subiram ${stats.revenueChange.toFixed(1)}% em relação ao período anterior.` });
    else if (stats.revenueChange < 0) list.push({ type: 'down', text: `As vendas caíram ${Math.abs(stats.revenueChange).toFixed(1)}% em relação ao período anterior.` });
    if (stats.topProducts.length > 0) list.push({ type: 'info', text: `O produto mais vendido foi ${stats.topProducts[0][0]}, com ${stats.topProducts[0][1].qty} unidades.` });
    if (stats.paymentData.length > 0) {
      const topPayment = stats.paymentData.sort((a, b) => b.value - a.value)[0];
      const pct = stats.totalRevenue > 0 ? (topPayment.value / stats.totalRevenue * 100).toFixed(0) : 0;
      list.push({ type: 'info', text: `O ${topPayment.name} foi responsável por ${pct}% das vendas do período.` });
    }
    if (stats.pendingFiado > 0) list.push({ type: 'alert', text: `Há ${formatCurrency(stats.pendingFiado)} em fiados pendentes neste período.` });
    if (stats.cancelled > 0) list.push({ type: 'alert', text: `Foram registradas ${stats.cancelled} venda(s) cancelada(s) no período.` });
    if (stats.sellerData.length > 1) {
      const topSeller = stats.sellerData[0];
      const pct = stats.totalSales > 0 ? (topSeller[1].count / stats.totalSales * 100).toFixed(0) : 0;
      list.push({ type: 'info', text: `${topSeller[0]} realizou ${pct}% das vendas do período.` });
    }
    return list;
  }, [stats, period]);

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">Carregando relatórios...</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Relatórios Gerenciais</h1>
        <p className="text-sm text-muted-foreground">Análise de desempenho do período</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${period === p.key ? 'bg-accent text-accent-foreground' : 'bg-white border border-border hover:bg-secondary'}`}>
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm" />
          </>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={DollarSign} label="Faturamento" value={formatCurrency(stats.totalRevenue)} change={stats.revenueChange} />
        <StatCard icon={ShoppingCart} label="Vendas" value={stats.totalSales} />
        <StatCard icon={Receipt} label="Ticket Médio" value={formatCurrency(stats.avgTicket)} />
        <StatCard icon={AlertTriangle} label="Cancelamentos" value={stats.cancelled} alert={stats.cancelled > 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Faturamento por {period === 'year' ? 'Mês' : 'Dia'}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="value" fill="hsl(87 51% 48%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Formas de Pagamento</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={stats.paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                {stats.paymentData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Top 5 Produtos</h3>
          <div className="space-y-2">
            {stats.topProducts.map(([name, data], i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">{i + 1}</span> {name}</span>
                <span className="font-medium">{formatCurrency(data.revenue)} <span className="text-muted-foreground text-xs">({data.qty} un)</span></span>
              </div>
            ))}
            {stats.topProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Vendedores</h3>
          <div className="space-y-2">
            {stats.sellerData.map(([name, data], i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">{i + 1}</span> {name}</span>
                <span className="font-medium">{formatCurrency(data.revenue)} <span className="text-muted-foreground text-xs">({data.count} vendas)</span></span>
              </div>
            ))}
            {stats.sellerData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-br from-accent/5 to-transparent border border-accent/20 rounded-lg p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-accent" /> Insights do Período</h3>
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded ${ins.type === 'up' ? 'bg-green-50 text-green-700' : ins.type === 'down' ? 'bg-red-50 text-red-700' : ins.type === 'alert' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
              {ins.type === 'up' && <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {ins.type === 'down' && <TrendingDown className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {ins.type === 'alert' && <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {ins.type === 'info' && <BarChart3 className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {ins.text}
            </div>
          ))}
          {insights.length === 0 && <p className="text-sm text-muted-foreground">Sem insights para este período.</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, change, alert }) {
  return (
    <div className={`bg-white border rounded-lg p-4 ${alert ? 'border-orange-300' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${alert ? 'text-orange-500' : 'text-accent'}`} />
      </div>
      <div className="text-xl font-bold">{typeof value === 'number' && value < 100 ? value : value}</div>
      {change !== undefined && change !== 0 && (
        <div className={`text-xs flex items-center gap-0.5 ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
}