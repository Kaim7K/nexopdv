import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileBarChart,
  Landmark,
  Loader2,
  PackagePlus,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Store,
  Target,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/common/PageState';
import PaginationControls from '@/components/common/PaginationControls';
import ImageUploadField from '@/components/ImageUploadField';
import { useConfirm } from '@/components/common/ConfirmProvider';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getPaymentLabel,
} from '@/lib/helpers';

/** @type {Array<[string, string, React.ElementType]>} */
const NAV_ITEMS = [
  ['overview', 'Visão geral', BarChart3],
  ['movements', 'Movimentações', ArrowRightLeft],
  ['expenses', 'Despesas', ArrowDownCircle],
  ['revenue', 'Receitas', ArrowUpCircle],
  ['payables', 'Contas a pagar', Receipt],
  ['receivables', 'Contas a receber', CircleDollarSign],
  ['cashflow', 'Fluxo de caixa', TrendingUp],
  ['results', 'Resultados', FileBarChart],
  ['purchases', 'Compras', PackagePlus],
  ['suppliers', 'Fornecedores', Store],
  ['accounts', 'Contas financeiras', Landmark],
  ['reconciliation', 'Conciliação', Check],
  ['goals', 'Metas', Target],
  ['reports', 'Relatórios', Download],
  ['settings', 'Configurações', Settings],
];
const COLORS = [
  '#16a06a',
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#64748b',
];
const STATUS_LABEL = {
  pending: 'Pendente',
  partial: 'Parcial',
  paid: 'Pago',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
  reversed: 'Estornado',
};
const TYPE_LABEL = {
  expense: 'Despesa',
  revenue: 'Receita',
  transfer: 'Transferência',
  loss: 'Perda',
  adjustment: 'Ajuste',
};
const PAYMENT_OPTIONS = [
  'dinheiro',
  'pix',
  'debito',
  'credito',
  'boleto',
  'transferencia',
  'outros',
];
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;
const toInputDate = (value) => (value ? String(value).slice(0, 10) : '');

function rangePreset(key) {
  const end = new Date(),
    start = new Date(end);
  if (key === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }
  if (key === '7days') start.setDate(start.getDate() - 6);
  if (key === 'month') start.setDate(1);
  if (key === 'previous') {
    start.setMonth(start.getMonth() - 1, 1);
    end.setDate(0);
  }
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export default function Financeiro() {
  const [active, setActive] = useState('overview');
  const [bootstrap, setBootstrap] = useState(null),
    [dashboard, setDashboard] = useState(null);
  const [range, setRange] = useState(rangePreset('month')),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [expenseOpen, setExpenseOpen] = useState(false),
    [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [base, data] = await Promise.all([
        nexoApi.finance.bootstrap(),
        nexoApi.finance.dashboard(range),
      ]);
      setBootstrap(base);
      setDashboard(data);
    } catch (cause) {
      setError(cause.message || 'Não foi possível carregar a área financeira.');
    } finally {
      setLoading(false);
    }
  }, [range, revision]);
  useEffect(() => {
    load();
  }, [load]);
  const refresh = () => {
    nexoApi.cache.clear();
    setRevision((value) => value + 1);
  };
  const availableNav = NAV_ITEMS.filter(
    ([key]) =>
      key !== 'purchases' ||
      (bootstrap?.enabled_features || []).includes('integrated_purchases'),
  );
  const nav =
    availableNav.find((item) => item[0] === active) || availableNav[0];
  if (loading && !bootstrap)
    return <LoadingState label="Organizando as informações financeiras..." />;
  if (error && !bootstrap)
    return (
      <div className="page-shell">
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  return (
    <div className="page-shell space-y-5">
      <header className="page-header mb-0">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <WalletCards className="h-3.5 w-3.5" /> Gestão financeira
          </div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle">
            Receitas, despesas, contas e lucro com origem rastreável no PDV.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpenseOpen(true)}
          disabled={!bootstrap?.permissions?.create}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground shadow-sm hover:bg-accent/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Adicionar despesa
        </button>
      </header>
      <section className="surface-card p-3 no-print">
        <label className="sr-only" htmlFor="finance-section">
          Área financeira
        </label>
        <select
          id="finance-section"
          className="field mt-0 lg:hidden"
          value={active}
          onChange={(event) => setActive(event.target.value)}
        >
          {availableNav.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <nav
          aria-label="Seções financeiras"
          className="hidden gap-1 lg:flex lg:flex-wrap"
        >
          {availableNav.map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              onClick={() => setActive(key)}
              aria-current={active === key ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold transition ${active === key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </section>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold">{nav[1]}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valores de {formatDate(range.from)} até {formatDate(range.to)}.
          </p>
        </div>
        <PeriodFilter
          range={range}
          setRange={setRange}
          loading={loading}
          onRefresh={load}
        />
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      <FinanceSection
        active={active}
        dashboard={dashboard}
        bootstrap={bootstrap}
        range={range}
        refresh={refresh}
      />
      <TransactionModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        bootstrap={bootstrap}
        initialType="expense"
        onSaved={() => {
          setExpenseOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function PeriodFilter({ range, setRange, loading, onRefresh }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <select
        className="field col-span-2 mt-0 min-w-40 sm:w-auto"
        aria-label="Período rápido"
        onChange={(event) =>
          event.target.value && setRange(rangePreset(event.target.value))
        }
        defaultValue="month"
      >
        <option value="today">Hoje</option>
        <option value="yesterday">Ontem</option>
        <option value="7days">Últimos 7 dias</option>
        <option value="month">Este mês</option>
        <option value="previous">Mês anterior</option>
      </select>
      <input
        type="date"
        aria-label="Data inicial"
        className="field mt-0 sm:w-auto"
        value={range.from}
        max={range.to}
        onChange={(event) =>
          setRange((value) => ({ ...value, from: event.target.value }))
        }
      />
      <input
        type="date"
        aria-label="Data final"
        className="field mt-0 sm:w-auto"
        value={range.to}
        min={range.from}
        onChange={(event) =>
          setRange((value) => ({ ...value, to: event.target.value }))
        }
      />
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Atualizar"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-3 hover:bg-muted"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

function FinanceSection({ active, dashboard, bootstrap, range, refresh }) {
  if (active === 'overview') return <Overview data={dashboard} />;
  if (active === 'movements') return <LedgerPanel range={range} />;
  if (['expenses', 'revenue', 'payables'].includes(active))
    return (
      <TransactionsPanel
        mode={active}
        bootstrap={bootstrap}
        range={range}
        refreshAll={refresh}
      />
    );
  if (active === 'receivables') return <ReceivablesPanel range={range} />;
  if (active === 'cashflow') return <CashFlow data={dashboard} />;
  if (active === 'results') return <Results data={dashboard} />;
  if (active === 'purchases')
    return <Purchases bootstrap={bootstrap} refreshAll={refresh} />;
  if (active === 'suppliers')
    return <Suppliers bootstrap={bootstrap} refreshAll={refresh} />;
  if (active === 'accounts')
    return (
      <Accounts
        bootstrap={bootstrap}
        dashboard={dashboard}
        refreshAll={refresh}
      />
    );
  if (active === 'reconciliation') return <Reconciliation range={range} />;
  if (active === 'goals')
    return (
      <Goals bootstrap={bootstrap} data={dashboard} refreshAll={refresh} />
    );
  if (active === 'reports')
    return (
      <Reports
        dashboard={dashboard}
        range={range}
        canExport={
          bootstrap.permissions.export &&
          (bootstrap.enabled_features || []).includes('report_export')
        }
      />
    );
  return <FinanceSettings bootstrap={bootstrap} refreshAll={refresh} />;
}

function Overview({ data }) {
  const summary = data?.summary || {};
  const cards = [
    [
      'Faturamento bruto',
      summary.gross_revenue,
      'Valor total vendido antes de descontos',
    ],
    [
      'Receita líquida',
      summary.net_revenue,
      'Vendas líquidas e outras receitas',
    ],
    ['Total de despesas', summary.expenses, 'Despesas e perdas do período'],
    [
      'Lucro estimado',
      summary.estimated_profit,
      'Receitas menos custos, taxas e despesas',
    ],
    [
      'Margem de lucro',
      `${Number(summary.margin || 0).toLocaleString('pt-BR')}%`,
      'Percentual estimado sobre a receita',
    ],
    ['Contas a pagar', summary.payable, 'Saldo ainda pendente'],
    ['Contas a receber', summary.receivable, 'Inclui vendas fiadas pendentes'],
    [
      'Saldo financeiro',
      summary.financial_balance,
      'Soma das contas financeiras',
    ],
    [
      'Disponível em caixa',
      summary.cash_available,
      'Caixa físico, carteira e cofre',
    ],
  ];
  return (
    <div className="space-y-5">
      {data?.alerts?.length > 0 && (
        <section
          aria-label="Alertas financeiros"
          className="grid gap-3 md:grid-cols-2"
        >
          {data.alerts.map((alert) => (
            <article
              key={alert.type}
              className={`rounded-2xl border p-4 ${alert.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' : 'border-amber-500/30 bg-amber-500/5'}`}
            >
              <div className="flex gap-3">
                <AlertTriangle
                  className={`mt-0.5 h-5 w-5 shrink-0 ${alert.severity === 'critical' ? 'text-destructive' : 'text-amber-600'}`}
                />
                <div>
                  <h3 className="text-sm font-bold">{alert.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {alert.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, help], index) => (
          <MetricCard
            key={label}
            label={label}
            value={typeof value === 'string' ? value : formatCurrency(value)}
            help={help}
            change={
              index < 3
                ? data?.comparison?.[
                    index === 0
                      ? 'revenue'
                      : index === 1
                        ? 'revenue'
                        : 'expenses'
                  ]
                : null
            }
          />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <ChartCard title="Receitas, despesas e lucro">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data?.series || []}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a06a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16a06a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => value.slice(5)}
                fontSize={11}
              />
              <YAxis tickFormatter={compactMoney} fontSize={11} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelFormatter={formatDate}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Receitas"
                stroke="#16a06a"
                fill="url(#rev)"
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Despesas"
                stroke="#ef4444"
                fill="transparent"
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Lucro"
                stroke="#0ea5e9"
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Despesas por categoria">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data?.expenses_by_category || []}
                dataKey="value"
                nameKey="label"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
              >
                {(data?.expenses_by_category || []).map((item, index) => (
                  <Cell key={item.label} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={formatCurrency} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <SimpleRanking
          title="Formas de pagamento"
          items={Object.entries(data?.payments || {}).map(([label, value]) => ({
            label: getPaymentLabel(label),
            value,
          }))}
        />
        <SimpleRanking
          title="Produtos que mais geraram receita"
          items={data?.top_products || []}
        />
      </section>
    </div>
  );
}

function MetricCard({ label, value, help, change = null }) {
  return (
    <article className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {change !== null && change !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${change >= 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}
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
function SimpleRanking({ title, items }) {
  return (
    <section className="surface-card p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.slice(0, 6).map((item, index) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {item.label}
              </span>
              <strong className="text-sm tabular-nums">
                {formatCurrency(item.revenue ?? item.value)}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sem dados no período.
        </p>
      )}
    </section>
  );
}
const compactMoney = (value) =>
  `R$ ${Number(value || 0) >= 1000 ? `${(Number(value) / 1000).toFixed(0)} mil` : Number(value || 0).toFixed(0)}`;

function TransactionsPanel({ mode, bootstrap, range, refreshAll }) {
  const confirm = useConfirm();
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState(null),
    [paying, setPaying] = useState(null),
    [selected, setSelected] = useState([]);
  const filters = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      page,
      page_size: 25,
      search,
      type: mode === 'revenue' ? 'revenue' : 'expense',
      status: mode === 'payables' ? 'open' : '',
    }),
    [range, page, search, mode],
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await nexoApi.finance.transactions.list(filters));
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    load();
  }, [load]);
  const cancel = async (item) => {
    const accepted = await confirm({
      title: 'Cancelar lançamento?',
      description:
        'O original será preservado no histórico. Informe o motivo na próxima etapa.',
      confirmLabel: 'Continuar',
      tone: 'destructive',
    });
    if (!accepted) return;
    const reason = window.prompt(
      'Motivo do cancelamento (mínimo 5 caracteres):',
    );
    if (!reason) return;
    try {
      await nexoApi.finance.transactions.cancel(item.id, reason);
      toast.success('Lançamento cancelado.');
      load();
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    }
  };
  const batchPay = async () => {
    if (!selected.length) return;
    const accepted = await confirm({
      title: 'Marcar contas selecionadas como pagas?',
      description: `Serão processados ${selected.length} lançamentos pendentes, preservando o histórico de pagamentos.`,
      confirmLabel: 'Registrar pagamentos',
    });
    if (!accepted) return;
    try {
      await nexoApi.finance.transactions.batch({
        ids: selected,
        action: 'pay',
      });
      toast.success('Pagamentos registrados.');
      setSelected([]);
      load();
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    }
  };
  return (
    <div className="space-y-4">
      <div className="surface-card grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input
            className="field mt-0 pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar descrição ou fornecedor"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModal(true);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground"
        >
          <Plus className="h-4 w-4" /> Novo lançamento
        </button>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <span className="text-sm font-bold">
            {selected.length} selecionado(s)
          </span>
          <button
            type="button"
            onClick={batchPay}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
          >
            Marcar como pagos
          </button>
        </div>
      )}
      {loading ? (
        <LoadingState label="Carregando lançamentos..." />
      ) : (
        <TransactionList
          items={data?.items || []}
          selectable={mode === 'payables'}
          selected={selected}
          setSelected={setSelected}
          onPay={bootstrap.permissions.pay ? setPaying : null}
          onEdit={
            bootstrap.permissions.edit
              ? (item) => {
                  setEditing(item);
                  setModal(true);
                }
              : null
          }
          onCancel={bootstrap.permissions.cancel ? cancel : null}
          onDuplicate={
            bootstrap.permissions.create
              ? async (item) => {
                  try {
                    await nexoApi.finance.transactions.duplicate(item.id);
                    toast.success('Lançamento duplicado.');
                    load();
                  } catch (cause) {
                    toast.error(cause.message);
                  }
                }
              : null
          }
        />
      )}
      <PaginationControls
        page={data?.page || 1}
        pageCount={data?.page_count || 1}
        total={data?.total || 0}
        pageSize={data?.page_size || 25}
        onPageChange={setPage}
      />
      <TransactionModal
        open={modal}
        onClose={() => {
          setModal(false);
          setEditing(null);
        }}
        bootstrap={bootstrap}
        item={editing}
        initialType={mode === 'revenue' ? 'revenue' : 'expense'}
        onSaved={() => {
          setModal(false);
          setEditing(null);
          load();
          refreshAll();
        }}
      />
      <PaymentModal
        item={paying}
        accounts={bootstrap.accounts}
        onClose={() => setPaying(null)}
        onSaved={() => {
          setPaying(null);
          load();
          refreshAll();
        }}
      />
    </div>
  );
}

function TransactionList({
  items,
  selectable = false,
  selected = [],
  setSelected,
  onPay,
  onEdit,
  onCancel,
  onDuplicate,
}) {
  if (!items.length)
    return (
      <EmptyState
        icon={Receipt}
        title="Nenhum lançamento encontrado"
        description="Ajuste o período ou registre o primeiro lançamento."
      />
    );
  return (
    <>
      <div className="grid gap-3 lg:hidden">
        {items.map((item) => (
          <article key={item.id} className="surface-card p-4">
            <div className="flex items-start gap-3">
              {selectable && (
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5"
                  checked={selected.includes(item.id)}
                  onChange={() =>
                    setSelected((value) =>
                      value.includes(item.id)
                        ? value.filter((id) => id !== item.id)
                        : [...value, item.id],
                    )
                  }
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <strong className="break-words text-sm">
                    {item.description}
                  </strong>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.category_name || TYPE_LABEL[item.type]} ·{' '}
                  {formatDate(item.due_date || item.issue_date)}
                </p>
                <strong
                  className={`mt-3 block text-lg tabular-nums ${item.type === 'revenue' ? 'text-emerald-600' : 'text-foreground'}`}
                >
                  {formatCurrency(item.amount)}
                </strong>
                <div className="mt-3 flex flex-wrap gap-2">
                  <RowActions
                    item={item}
                    onPay={onPay}
                    onEdit={onEdit}
                    onCancel={onCancel}
                    onDuplicate={onDuplicate}
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="surface-card hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              {selectable && <th className="w-12 px-4 py-3">Sel.</th>}
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/20">
                {selectable && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.includes(item.id)}
                      onChange={() =>
                        setSelected((value) =>
                          value.includes(item.id)
                            ? value.filter((id) => id !== item.id)
                            : [...value, item.id],
                        )
                      }
                    />
                  </td>
                )}
                <td className="max-w-64 px-4 py-3 font-semibold">
                  {item.description}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.category_name || '—'}
                </td>
                <td className="px-4 py-3">
                  {formatDate(item.due_date || item.issue_date)}
                </td>
                <td className="px-4 py-3 font-bold tabular-nums">
                  {formatCurrency(item.amount)}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatCurrency(item.paid_amount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <RowActions
                      item={item}
                      onPay={onPay}
                      onEdit={onEdit}
                      onCancel={onCancel}
                      onDuplicate={onDuplicate}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function RowActions({ item, onPay, onEdit, onCancel, onDuplicate }) {
  return (
    <>
      {onPay && ['pending', 'partial', 'overdue'].includes(item.status) && (
        <button
          type="button"
          onClick={() => onPay(item)}
          className="rounded-lg border border-border px-2.5 py-2 text-xs font-bold hover:bg-muted"
        >
          Pagar
        </button>
      )}
      {onDuplicate && (
        <button
          type="button"
          onClick={() => onDuplicate(item)}
          className="rounded-lg border border-border px-2.5 py-2 text-xs font-bold hover:bg-muted"
        >
          Duplicar
        </button>
      )}
      {onEdit && ['pending', 'partial', 'overdue'].includes(item.status) && (
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="rounded-lg border border-border px-2.5 py-2 text-xs font-bold hover:bg-muted"
        >
          Editar
        </button>
      )}
      {onCancel && !['cancelled', 'reversed'].includes(item.status) && (
        <button
          type="button"
          onClick={() => onCancel(item)}
          className="rounded-lg border border-destructive/30 px-2.5 py-2 text-xs font-bold text-destructive hover:bg-destructive/5"
        >
          Cancelar
        </button>
      )}
    </>
  );
}
function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${status === 'paid' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : status === 'overdue' ? 'bg-destructive/10 text-destructive' : status === 'cancelled' || status === 'reversed' ? 'bg-muted text-muted-foreground' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function TransactionModal({
  open,
  onClose,
  bootstrap,
  initialType,
  onSaved,
  item = null,
}) {
  const initial = {
    type: initialType,
    description: '',
    amount: '',
    category_id: '',
    supplier_id: '',
    account_id:
      bootstrap?.accounts?.find((item) => item.is_default)?.id ||
      bootstrap?.accounts?.[0]?.id ||
      '',
    issue_date: today(),
    due_date: today(),
    payment_method: '',
    status: 'pending',
    notes: '',
    attachment_url: '',
  };
  const [form, setForm] = useState(initial),
    [saving, setSaving] = useState(false),
    [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    if (open)
      setForm(
        item
          ? {
              ...initial,
              ...item,
              amount: String(item.amount),
              issue_date: toInputDate(item.issue_date),
              due_date: toInputDate(item.due_date || item.issue_date),
              category_id: item.category_id || '',
              supplier_id: item.supplier_id || '',
              account_id: item.account_id || initial.account_id,
              payment_method: item.payment_method || '',
              notes: item.notes || '',
              attachment_url: item.attachment_url || '',
            }
          : { ...initial, type: initialType },
      );
  }, [open, initialType, bootstrap, item]);
  if (!open) return null;
  const categories = (bootstrap?.categories || []).filter(
    (item) =>
      item.active &&
      (item.type === form.type ||
        item.type === 'both' ||
        (form.type === 'loss' && item.type === 'expense')),
  );
  const submit = async (event) => {
    event.preventDefault();
    if (!form.description.trim()) return toast.error('Informe a descrição.');
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
      };
      if (item) await nexoApi.finance.transactions.update(item.id, payload);
      else await nexoApi.finance.transactions.create(payload);
      toast.success(
        form.type === 'expense'
          ? item
            ? 'Despesa atualizada.'
            : 'Despesa registrada.'
          : item
            ? 'Lançamento atualizado.'
            : 'Lançamento registrado.',
      );
      onSaved();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <FinanceModal
      title={
        item
          ? 'Editar lançamento'
          : initialType === 'expense'
            ? 'Adicionar despesa'
            : 'Novo lançamento'
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              className="field"
              value={form.type}
              onChange={(e) =>
                setForm((v) => ({
                  ...v,
                  type: e.target.value,
                  category_id: '',
                }))
              }
            >
              <option value="expense">Despesa</option>
              <option value="revenue">Receita externa</option>
              <option value="loss">Perda ou avaria</option>
              <option value="transfer">Transferência entre contas</option>
            </select>
          </Field>
          <Field label="Valor">
            <input
              required
              min="0.01"
              step="0.01"
              inputMode="decimal"
              className="field"
              value={form.amount}
              onChange={(e) =>
                setForm((v) => ({ ...v, amount: e.target.value }))
              }
            />
          </Field>
        </div>
        <Field label="Descrição">
          <input
            required
            autoFocus
            maxLength={180}
            className="field"
            value={form.description}
            onChange={(e) =>
              setForm((v) => ({ ...v, description: e.target.value }))
            }
            placeholder="Ex.: Conta de energia de julho"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <select
              required={form.type !== 'transfer'}
              className="field"
              value={form.category_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, category_id: e.target.value }))
              }
            >
              <option value="">Selecione</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vencimento">
            <input
              required
              type="date"
              className="field"
              min={form.issue_date}
              value={form.due_date}
              onChange={(e) =>
                setForm((v) => ({ ...v, due_date: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Conta financeira">
            <select
              required
              className="field"
              value={form.account_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, account_id: e.target.value }))
              }
            >
              {(bootstrap?.accounts || [])
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </Field>
          {form.type === 'transfer' ? (
            <Field label="Conta de destino">
              <select
                required
                className="field"
                value={form.transfer_account_id || ''}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    transfer_account_id: e.target.value,
                  }))
                }
              >
                <option value="">Selecione</option>
                {(bootstrap?.accounts || [])
                  .filter((item) => item.active && item.id !== form.account_id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
          ) : (
            <Field label="Status do pagamento">
              <select
                className="field"
                value={form.status}
                onChange={(e) =>
                  setForm((v) => ({ ...v, status: e.target.value }))
                }
              >
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
              </select>
            </Field>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="text-xs font-bold text-accent"
        >
          {advanced
            ? 'Ocultar dados complementares'
            : 'Adicionar fornecedor, forma, observações e comprovante'}
        </button>
        {advanced && (
          <div className="space-y-4 rounded-xl border border-border bg-muted/15 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fornecedor">
                <select
                  className="field"
                  value={form.supplier_id}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, supplier_id: e.target.value }))
                  }
                >
                  <option value="">Não informado</option>
                  {(bootstrap?.suppliers || [])
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Forma de pagamento">
                <select
                  className="field"
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, payment_method: e.target.value }))
                  }
                >
                  <option value="">Não informada</option>
                  {PAYMENT_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {getPaymentLabel(item)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Observações">
              <textarea
                className="field h-24 py-3"
                value={form.notes}
                onChange={(e) =>
                  setForm((v) => ({ ...v, notes: e.target.value }))
                }
              />
            </Field>
            <ImageUploadField
              capture="environment"
              kind="receipt"
              value={form.attachment_url}
              onChange={(value) =>
                setForm((v) => ({ ...v, attachment_url: value }))
              }
              label="Comprovante"
              name="Comprovante"
            />
          </div>
        )}
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </FinanceModal>
  );
}

function PaymentModal({ item, accounts, onClose, onSaved }) {
  const [form, setForm] = useState({
      amount: '',
      account_id: '',
      payment_method: 'pix',
      paid_at: new Date().toISOString().slice(0, 16),
      attachment_url: '',
    }),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (item)
      setForm((v) => ({
        ...v,
        amount: (Number(item.amount) - Number(item.paid_amount)).toFixed(2),
        account_id:
          item.account_id ||
          accounts?.find((a) => a.is_default)?.id ||
          accounts?.[0]?.id ||
          '',
      }));
  }, [item, accounts]);
  if (!item) return null;
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.transactions.pay(item.id, {
        ...form,
        amount: Number(form.amount),
      });
      toast.success('Pagamento registrado.');
      onSaved();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <FinanceModal title="Registrar pagamento" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-muted/30 p-4">
          <p className="text-sm font-bold">{item.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saldo:{' '}
            {formatCurrency(Number(item.amount) - Number(item.paid_amount))}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              className="field"
              value={form.amount}
              onChange={(e) =>
                setForm((v) => ({ ...v, amount: e.target.value }))
              }
            />
          </Field>
          <Field label="Data e horário">
            <input
              required
              type="datetime-local"
              className="field"
              value={form.paid_at}
              onChange={(e) =>
                setForm((v) => ({ ...v, paid_at: e.target.value }))
              }
            />
          </Field>
          <Field label="Conta">
            <select
              required
              className="field"
              value={form.account_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, account_id: e.target.value }))
              }
            >
              {(accounts || [])
                .filter((a) => a.active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Forma">
            <select
              className="field"
              value={form.payment_method}
              onChange={(e) =>
                setForm((v) => ({ ...v, payment_method: e.target.value }))
              }
            >
              {PAYMENT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {getPaymentLabel(value)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ImageUploadField
          capture="environment"
          kind="receipt"
          value={form.attachment_url}
          onChange={(value) =>
            setForm((v) => ({ ...v, attachment_url: value }))
          }
          label="Comprovante"
        />
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </FinanceModal>
  );
}

function LedgerPanel({ range }) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    nexoApi.finance
      .ledger(range)
      .then(setData)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [range]);
  if (loading) return <LoadingState />;
  return <GenericMovementList items={data?.items || []} />;
}
function GenericMovementList({ items }) {
  if (!items.length)
    return (
      <EmptyState
        icon={ArrowRightLeft}
        title="Nenhuma movimentação no período"
        description="Vendas, recebimentos e lançamentos aparecerão aqui automaticamente."
      />
    );
  return (
    <div className="surface-card divide-y divide-border overflow-hidden">
      {items.map((item) => (
        <article
          key={item.id}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.type === 'revenue' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}
          >
            {item.type === 'revenue' ? (
              <ArrowUpCircle className="h-5 w-5" />
            ) : (
              <ArrowDownCircle className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm">
              {item.description}
            </strong>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(item.date)} · {item.origin} · {item.actor}
            </p>
          </div>
          <strong
            className={`text-base tabular-nums ${item.type === 'revenue' ? 'text-emerald-600' : 'text-destructive'}`}
          >
            {item.type === 'revenue' ? '+' : '−'}{' '}
            {formatCurrency(item.realized_amount || item.amount)}
          </strong>
        </article>
      ))}
    </div>
  );
}

function ReceivablesPanel({ range }) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    nexoApi.finance
      .receivables(range)
      .then(setData)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [range]);
  if (loading) return <LoadingState />;
  return (
    <div className="space-y-4">
      <MetricCard
        label="Saldo a receber"
        value={formatCurrency(data?.total)}
        help="Receitas externas e vendas fiadas ainda pendentes"
      />
      {!data?.items?.length ? (
        <EmptyState
          icon={CircleDollarSign}
          title="Nenhum valor pendente"
          description="As vendas fiadas e receitas futuras aparecerão aqui."
        />
      ) : (
        <div className="grid gap-3">
          {data.items.map((item) => (
            <article
              key={`${item.kind}:${item.id}`}
              className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <strong className="text-sm">
                  {item.client || item.description}
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.client ? item.description : item.category} · vence{' '}
                  {formatDate(item.due_date) || 'sem data'}
                </p>
              </div>
              <div className="sm:text-right">
                <strong className="text-base tabular-nums">
                  {formatCurrency(item.remaining_amount)}
                </strong>
                <div className="mt-1">
                  <StatusBadge status={item.status} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CashFlow({ data }) {
  const series = data?.series || [];
  const incoming = series.reduce((s, i) => s + i.revenue, 0),
    outgoing = series.reduce((s, i) => s + i.expense, 0);
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Saldo inicial estimado"
          value={formatCurrency(
            (data?.summary?.financial_balance || 0) - incoming + outgoing,
          )}
          help="Saldo atual descontando o fluxo realizado"
        />
        <MetricCard
          label="Entradas realizadas"
          value={formatCurrency(incoming)}
          help="Recebimentos do período"
        />
        <MetricCard
          label="Saídas realizadas"
          value={formatCurrency(outgoing)}
          help="Pagamentos do período"
        />
        <MetricCard
          label="Saldo final"
          value={formatCurrency(data?.summary?.financial_balance)}
          help="Saldo atual das contas"
        />
      </section>
      <ChartCard title="Evolução diária">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => v.slice(5)}
              fontSize={11}
            />
            <YAxis tickFormatter={compactMoney} fontSize={11} />
            <Tooltip formatter={formatCurrency} />
            <Legend />
            <Bar
              dataKey="revenue"
              name="Entradas"
              fill="#16a06a"
              radius={[5, 5, 0, 0]}
            />
            <Bar
              dataKey="expense"
              name="Saídas"
              fill="#ef4444"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
function Results({ data }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="surface-card overflow-hidden">
        <div className="border-b border-border p-4">
          <h3 className="font-bold">DRE simplificada</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique nas áreas de lançamentos para investigar a origem dos
            valores.
          </p>
        </div>
        <div className="divide-y divide-border">
          {(data?.dre || []).map((row, index) => (
            <div
              key={row.key}
              className={`flex items-start justify-between gap-4 p-4 ${['gross_profit', 'result'].includes(row.key) ? 'bg-accent/5' : ''}`}
            >
              <div>
                <strong className="text-sm">
                  {index + 1}. {row.label}
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">{row.help}</p>
              </div>
              <strong
                className={`shrink-0 tabular-nums ${row.value < 0 ? 'text-destructive' : row.key === 'result' ? 'text-accent' : ''}`}
              >
                {formatCurrency(row.value)}
              </strong>
            </div>
          ))}
        </div>
      </section>
      <div className="space-y-3">
        <MetricCard
          label="Lucro líquido estimado"
          value={formatCurrency(data?.summary?.estimated_profit)}
          help="Não é o mesmo que faturamento ou saldo disponível"
        />
        <MetricCard
          label="Margem líquida"
          value={`${Number(data?.summary?.margin || 0).toLocaleString('pt-BR')}%`}
          help="Parcela da receita que permaneceu como resultado"
        />
        <MetricCard
          label="Custo das mercadorias"
          value={formatCurrency(data?.summary?.cogs)}
          help="Calculado pelo custo registrado de cada item vendido"
        />
        {data?.summary?.missing_cost_items > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <strong>
              {data.summary.missing_cost_items} item(ns) sem custo confiável
            </strong>
            <p className="mt-1 text-xs text-muted-foreground">
              O lucro pode estar incompleto até que os custos sejam cadastrados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Suppliers({ bootstrap, refreshAll }) {
  const [form, setForm] = useState({
      name: '',
      document: '',
      email: '',
      phone: '',
    }),
    [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.suppliers.create(form);
      toast.success('Fornecedor cadastrado.');
      setForm({ name: '', document: '', email: '', phone: '' });
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={save} className="surface-card h-fit space-y-4 p-4">
        <h3 className="font-bold">Novo fornecedor</h3>
        <Field label="Nome">
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          />
        </Field>
        <Field label="CPF ou CNPJ">
          <input
            className="field"
            value={form.document}
            onChange={(e) =>
              setForm((v) => ({ ...v, document: e.target.value }))
            }
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            className="field"
            value={form.email}
            onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
          />
        </Field>
        <Field label="Telefone">
          <input
            className="field"
            value={form.phone}
            onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
          />
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-accent-foreground"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar
        </button>
      </form>
      <ReferenceCards
        items={bootstrap.suppliers}
        empty="Nenhum fornecedor cadastrado"
        render={(item) => (
          <>
            <strong className="text-sm">{item.name}</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.document || 'Documento não informado'}
              {item.phone ? ` · ${item.phone}` : ''}
            </p>
          </>
        )}
      />
    </div>
  );
}

function Accounts({ bootstrap, dashboard, refreshAll }) {
  const [form, setForm] = useState({
      name: '',
      type: 'bank',
      opening_balance: '0',
      is_default: false,
    }),
    [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.accounts.create({
        ...form,
        opening_balance: Number(form.opening_balance),
      });
      toast.success('Conta financeira criada.');
      setForm({
        name: '',
        type: 'bank',
        opening_balance: '0',
        is_default: false,
      });
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={save} className="surface-card h-fit space-y-4 p-4">
        <h3 className="font-bold">Nova conta financeira</h3>
        <Field label="Nome">
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          />
        </Field>
        <Field label="Tipo">
          <select
            className="field"
            value={form.type}
            onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))}
          >
            <option value="cash">Caixa físico</option>
            <option value="bank">Conta bancária</option>
            <option value="digital">Conta digital</option>
            <option value="wallet">Carteira</option>
            <option value="safe">Cofre</option>
            <option value="pix">Conta Pix</option>
            <option value="card_receivable">Cartão a receber</option>
          </select>
        </Field>
        <Field label="Saldo inicial">
          <input
            type="number"
            min="0"
            step="0.01"
            className="field"
            value={form.opening_balance}
            onChange={(e) =>
              setForm((v) => ({ ...v, opening_balance: e.target.value }))
            }
          />
        </Field>
        {(bootstrap.enabled_features || []).includes(
          'financial_email_alerts',
        ) &&
          (bootstrap.enabled_features || []).includes('email_sending') && (
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm((v) => ({ ...v, is_default: e.target.checked }))
                }
              />{' '}
              Usar como conta padrão
            </label>
          )}
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 w-full rounded-xl bg-accent font-bold text-accent-foreground"
        >
          Criar conta
        </button>
      </form>
      <div className="grid content-start gap-3 sm:grid-cols-2">
        {(dashboard?.accounts || bootstrap.accounts || []).map((item) => (
          <article key={item.id} className="surface-card p-4">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                <Landmark className="h-5 w-5" />
              </div>
              {item.is_default && (
                <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">
                  Padrão
                </span>
              )}
            </div>
            <strong className="mt-4 block text-sm">{item.name}</strong>
            <p className="mt-1 text-xs text-muted-foreground">{item.type}</p>
            <strong className="mt-3 block text-xl tabular-nums">
              {formatCurrency(item.balance ?? item.opening_balance)}
            </strong>
          </article>
        ))}
      </div>
    </div>
  );
}

function Purchases({ bootstrap, refreshAll }) {
  const confirm = useConfirm();
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false);
  const load = () => {
    setLoading(true);
    nexoApi.finance.purchases
      .list()
      .then(setItems)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const confirmPurchase = async (item) => {
    if (
      !(await confirm({
        title: `Confirmar compra #${item.purchase_number}?`,
        description:
          'O estoque, o custo médio e as contas a pagar serão atualizados de forma atômica.',
        confirmLabel: 'Confirmar compra',
      }))
    )
      return;
    try {
      await nexoApi.finance.purchases.confirm(item.id);
      toast.success('Compra confirmada e integrada ao estoque.');
      load();
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground"
        >
          <Plus className="h-4 w-4" /> Registrar compra
        </button>
      </div>
      {loading ? (
        <LoadingState />
      ) : !items.length ? (
        <EmptyState
          icon={PackagePlus}
          title="Nenhuma compra registrada"
          description="Registre uma compra para atualizar estoque, custos e contas a pagar em conjunto."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <strong className="text-sm">
                  Compra #{item.purchase_number} · {item.supplier_name}
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(item.issue_date)} · {item.item_count} produto(s) ·{' '}
                  {item.status === 'draft'
                    ? 'Rascunho'
                    : item.status === 'confirmed'
                      ? 'Confirmada'
                      : 'Cancelada'}
                </p>
              </div>
              <strong className="tabular-nums">
                {formatCurrency(item.total)}
              </strong>
              {item.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => confirmPurchase(item)}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
                >
                  Confirmar
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <PurchaseModal
        open={open}
        onClose={() => setOpen(false)}
        bootstrap={bootstrap}
        onSaved={() => {
          setOpen(false);
          load();
          refreshAll();
        }}
      />
    </div>
  );
}

function PurchaseModal({ open, onClose, bootstrap, onSaved }) {
  const defaultForm = () => ({
    supplier_id: '',
    account_id:
      bootstrap.accounts?.find((a) => a.is_default)?.id ||
      bootstrap.accounts?.[0]?.id ||
      '',
    issue_date: today(),
    payment_method: 'boleto',
    discount: '0',
    freight: '0',
    invoice_number: '',
    attachment_url: '',
    items: [{ product_id: '', quantity: 1, unit_cost: '' }],
  });
  const [form, setForm] = useState(defaultForm),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(defaultForm());
  }, [open]);
  if (!open) return null;
  const total =
    form.items.reduce(
      (s, i) => s + Number(i.quantity || 0) * Number(i.unit_cost || 0),
      0,
    ) -
    Number(form.discount || 0) +
    Number(form.freight || 0);
  const updateItem = (index, key, value) =>
    setForm((v) => ({
      ...v,
      items: v.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.purchases.create({
        ...form,
        items: form.items.map((i) => ({
          ...i,
          quantity: Number(i.quantity),
          unit_cost: Number(i.unit_cost),
        })),
        installments: [
          {
            amount: total,
            due_date: form.issue_date,
            status:
              form.payment_method === 'dinheiro' ||
              form.payment_method === 'pix'
                ? 'paid'
                : 'pending',
          },
        ],
      });
      toast.success(
        'Compra salva como rascunho. Confirme para atualizar o estoque.',
      );
      onSaved();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <FinanceModal title="Registrar compra" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fornecedor">
            <select
              required
              className="field"
              value={form.supplier_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, supplier_id: e.target.value }))
              }
            >
              <option value="">Selecione</option>
              {bootstrap.suppliers
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Data da compra">
            <input
              type="date"
              className="field"
              value={form.issue_date}
              onChange={(e) =>
                setForm((v) => ({ ...v, issue_date: e.target.value }))
              }
            />
          </Field>
          <Field label="Forma de pagamento">
            <select
              className="field"
              value={form.payment_method}
              onChange={(e) =>
                setForm((v) => ({ ...v, payment_method: e.target.value }))
              }
            >
              {PAYMENT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {getPaymentLabel(v)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold">Produtos</h4>
            <button
              type="button"
              onClick={() =>
                setForm((v) => ({
                  ...v,
                  items: [
                    ...v.items,
                    { product_id: '', quantity: 1, unit_cost: '' },
                  ],
                }))
              }
              className="text-xs font-bold text-accent"
            >
              + Adicionar produto
            </button>
          </div>
          {form.items.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_100px_130px_40px]"
            >
              <select
                required
                className="field mt-0"
                value={item.product_id}
                onChange={(e) =>
                  updateItem(index, 'product_id', e.target.value)
                }
              >
                <option value="">Produto</option>
                {bootstrap.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.internal_code || p.barcode || 'sem código'})
                  </option>
                ))}
              </select>
              <input
                required
                aria-label="Quantidade"
                type="number"
                min="0.001"
                step="0.001"
                className="field mt-0"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
              />
              <input
                required
                aria-label="Custo unitário"
                type="number"
                min="0"
                step="0.0001"
                className="field mt-0"
                value={item.unit_cost}
                onChange={(e) => updateItem(index, 'unit_cost', e.target.value)}
                placeholder="Custo unit."
              />
              <button
                type="button"
                aria-label="Remover produto"
                disabled={form.items.length === 1}
                onClick={() =>
                  setForm((v) => ({
                    ...v,
                    items: v.items.filter((_, i) => i !== index),
                  }))
                }
                className="grid h-11 place-items-center rounded-xl text-destructive disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Desconto">
            <input
              type="number"
              min="0"
              step="0.01"
              className="field"
              value={form.discount}
              onChange={(e) =>
                setForm((v) => ({ ...v, discount: e.target.value }))
              }
            />
          </Field>
          <Field label="Frete">
            <input
              type="number"
              min="0"
              step="0.01"
              className="field"
              value={form.freight}
              onChange={(e) =>
                setForm((v) => ({ ...v, freight: e.target.value }))
              }
            />
          </Field>
          <div className="rounded-xl bg-muted/30 p-3">
            <span className="text-xs text-muted-foreground">Total</span>
            <strong className="mt-1 block text-xl">
              {formatCurrency(total)}
            </strong>
          </div>
        </div>
        <ImageUploadField
          capture="environment"
          kind="receipt"
          value={form.attachment_url}
          onChange={(value) =>
            setForm((v) => ({ ...v, attachment_url: value }))
          }
          label="Nota fiscal ou comprovante"
        />
        <ModalActions
          saving={saving}
          onClose={onClose}
          label="Salvar rascunho"
        />
      </form>
    </FinanceModal>
  );
}

function Reconciliation({ range }) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    nexoApi.finance
      .reconciliation(range)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [range]);
  if (loading) return <LoadingState />;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Vendas conciliadas"
          value={formatCurrency(data?.totals?.sales)}
          help="Total vendido nos caixas do período"
        />
        <MetricCard
          label="Diferença acumulada"
          value={formatCurrency(data?.totals?.differences)}
          help="Declarado menos esperado"
        />
        <MetricCard
          label="Caixas com divergência"
          value={String(data?.totals?.sessions_with_difference || 0)}
          help="Exigem investigação"
        />
      </section>
      {!data?.sessions?.length ? (
        <EmptyState
          icon={Check}
          title="Nenhum caixa no período"
          description="Abra e feche caixas pelo PDV para acompanhar a conciliação."
        />
      ) : (
        <div className="grid gap-3">
          {data.sessions.map((item) => (
            <article
              key={item.id}
              className={`surface-card p-4 ${item.has_difference ? 'border-amber-500/40' : ''}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <strong className="text-sm">{item.operator}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aberto em {formatDateTime(item.opened_at)} ·{' '}
                    {item.sales_count} venda(s)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-right sm:grid-cols-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground">
                      Esperado
                    </span>
                    <strong className="block text-sm">
                      {formatCurrency(item.expected_cash)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">
                      Declarado
                    </span>
                    <strong className="block text-sm">
                      {item.declared_cash === null
                        ? 'Em aberto'
                        : formatCurrency(item.declared_cash)}
                    </strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-muted-foreground">
                      Diferença
                    </span>
                    <strong
                      className={`block text-sm ${item.has_difference ? 'text-destructive' : ''}`}
                    >
                      {item.difference === null
                        ? '—'
                        : formatCurrency(item.difference)}
                    </strong>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Goals({ bootstrap, data, refreshAll }) {
  const [form, setForm] = useState({
      period: today().slice(0, 7),
      type: 'revenue',
      target_value: '',
      category_id: '',
    }),
    [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.goals.create({
        ...form,
        target_value: Number(form.target_value),
      });
      toast.success('Meta criada.');
      setForm((v) => ({ ...v, target_value: '' }));
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={submit} className="surface-card h-fit space-y-4 p-4">
        <h3 className="font-bold">Nova meta mensal</h3>
        <Field label="Mês">
          <input
            type="month"
            required
            className="field"
            value={form.period}
            onChange={(e) => setForm((v) => ({ ...v, period: e.target.value }))}
          />
        </Field>
        <Field label="Meta">
          <select
            className="field"
            value={form.type}
            onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))}
          >
            <option value="revenue">Faturamento</option>
            <option value="profit">Lucro</option>
            <option value="expense_limit">Limite de despesas</option>
            <option value="category_limit">Limite por categoria</option>
            <option value="loss_reduction">Redução de perdas</option>
            <option value="margin">Margem (%)</option>
          </select>
        </Field>
        {form.type === 'category_limit' && (
          <Field label="Categoria">
            <select
              required
              className="field"
              value={form.category_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, category_id: e.target.value }))
              }
            >
              <option value="">Selecione</option>
              {bootstrap.categories
                .filter((c) => c.type === 'expense' || c.type === 'both')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label={form.type === 'margin' ? 'Percentual' : 'Valor'}>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            className="field"
            value={form.target_value}
            onChange={(e) =>
              setForm((v) => ({ ...v, target_value: e.target.value }))
            }
          />
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 w-full rounded-xl bg-accent font-bold text-accent-foreground"
        >
          Criar meta
        </button>
      </form>
      <div className="grid content-start gap-3 sm:grid-cols-2">
        {(data?.goals || []).length ? (
          data.goals.map((goal) => (
            <article key={goal.id} className="surface-card p-4">
              <div className="flex justify-between gap-3">
                <strong className="text-sm">
                  {goal.type.replaceAll('_', ' ')}
                </strong>
                <span className="text-xs font-bold">{goal.progress}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.min(100, Math.max(0, goal.progress))}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {formatCurrency(goal.current_value)} de{' '}
                {formatCurrency(goal.target_value)}
              </p>
            </article>
          ))
        ) : (
          <EmptyState
            icon={Target}
            title="Nenhuma meta para o período"
            description="Defina uma meta para acompanhar o progresso mensal."
            className="sm:col-span-2"
          />
        )}
      </div>
    </div>
  );
}

function Reports({ dashboard, range, canExport }) {
  const exportCsv = () => {
    const rows = [
      ['Indicador', 'Valor'],
      ['Faturamento bruto', dashboard.summary.gross_revenue],
      ['Receita líquida', dashboard.summary.net_revenue],
      ['Despesas', dashboard.summary.expenses],
      ['Lucro estimado', dashboard.summary.estimated_profit],
      ['Margem', dashboard.summary.margin],
      [],
      ['Data', 'Receitas', 'Despesas', 'Lucro'],
      ...dashboard.series.map((i) => [i.date, i.revenue, i.expense, i.profit]),
    ];
    downloadCsv(rows, `financeiro-${range.from}-${range.to}.csv`);
  };
  return (
    <div className="space-y-4">
      <section className="surface-card p-5">
        <h3 className="font-bold">Central de relatórios</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Os arquivos usam os mesmos cálculos rastreáveis exibidos no painel.
        </p>
        {canExport ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground"
            >
              <Download className="h-4 w-4" /> Exportar planilha (CSV)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"
            >
              <ClipboardList className="h-4 w-4" /> Imprimir / salvar PDF
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            A exportação de relatórios não está incluída neste plano.
          </p>
        )}
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          'Receitas',
          'Despesas',
          'Contas a pagar',
          'Contas a receber',
          'Fluxo de caixa',
          'Lucro e margem',
          'DRE',
          'Vendas por pagamento',
          'Compras por fornecedor',
          'Produtos mais lucrativos',
          'Perdas de estoque',
          'Resultado por unidade',
        ].map((label) => (
          <article
            key={label}
            className="surface-card flex items-center gap-3 p-4"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
              <FileBarChart className="h-5 w-5" />
            </div>
            <strong className="min-w-0 flex-1 text-sm">{label}</strong>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </article>
        ))}
      </section>
    </div>
  );
}

function FinanceSettings({ bootstrap, refreshAll }) {
  const [settings, setSettings] = useState({ ...bootstrap.settings }),
    [category, setCategory] = useState({ name: '', type: 'expense' }),
    [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.settings.update(settings);
      toast.success('Configurações financeiras salvas.');
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  const addCategory = async (e) => {
    e.preventDefault();
    try {
      await nexoApi.finance.categories.create(category);
      toast.success('Categoria criada.');
      setCategory({ name: '', type: 'expense' });
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    }
  };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form onSubmit={save} className="surface-card space-y-4 p-4">
        <h3 className="font-bold">Regras de cálculo e alertas</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Imposto estimado (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="field"
              value={settings.tax_rate ?? 0}
              onChange={(e) =>
                setSettings((v) => ({ ...v, tax_rate: e.target.value }))
              }
            />
          </Field>
          <Field label="Avisar antes do vencimento (dias)">
            <input
              type="number"
              min="0"
              max="90"
              className="field"
              value={settings.alert_days ?? 3}
              onChange={(e) =>
                setSettings((v) => ({ ...v, alert_days: e.target.value }))
              }
            />
          </Field>
          <Field label="Taxa cartão débito (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="field"
              value={settings.debit_card_fee ?? 0}
              onChange={(e) =>
                setSettings((v) => ({ ...v, debit_card_fee: e.target.value }))
              }
            />
          </Field>
          <Field label="Taxa cartão crédito (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="field"
              value={settings.credit_card_fee ?? 0}
              onChange={(e) =>
                setSettings((v) => ({ ...v, credit_card_fee: e.target.value }))
              }
            />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(settings.email_alerts)}
            onChange={(e) =>
              setSettings((v) => ({ ...v, email_alerts: e.target.checked }))
            }
          />{' '}
          Enviar alertas financeiros por e-mail
        </label>
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground"
        >
          Salvar configurações
        </button>
      </form>
      <section className="surface-card p-4">
        <h3 className="font-bold">Categorias financeiras</h3>
        <form
          onSubmit={addCategory}
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px_auto]"
        >
          <input
            required
            className="field mt-0"
            value={category.name}
            onChange={(e) =>
              setCategory((v) => ({ ...v, name: e.target.value }))
            }
            placeholder="Nome da categoria"
          />
          <select
            className="field mt-0"
            value={category.type}
            onChange={(e) =>
              setCategory((v) => ({ ...v, type: e.target.value }))
            }
          >
            <option value="expense">Despesa</option>
            <option value="revenue">Receita</option>
            <option value="both">Ambas</option>
          </select>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-accent px-3 text-sm font-bold text-accent-foreground"
          >
            Adicionar
          </button>
        </form>
        <div className="mt-4 flex max-h-80 flex-wrap content-start gap-2 overflow-y-auto">
          {bootstrap.categories
            .filter((c) => c.active)
            .map((c) => (
              <span
                key={c.id}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
              >
                {c.name}{' '}
                <span className="text-muted-foreground">
                  ·{' '}
                  {c.type === 'expense'
                    ? 'despesa'
                    : c.type === 'revenue'
                      ? 'receita'
                      : 'ambas'}
                </span>
              </span>
            ))}
        </div>
      </section>
      {(bootstrap.enabled_features || []).includes('recurring_finance') && (
        <RecurringPanel bootstrap={bootstrap} refreshAll={refreshAll} />
      )}
      <PermissionsPanel bootstrap={bootstrap} refreshAll={refreshAll} />
    </div>
  );
}

function RecurringPanel({ bootstrap, refreshAll }) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category_id: '',
    account_id:
      bootstrap.accounts?.find((item) => item.is_default)?.id ||
      bootstrap.accounts?.[0]?.id ||
      '',
    frequency: 'monthly',
    start_date: today(),
    due_day: String(new Date().getDate()),
    transaction_type: 'expense',
    payment_method: 'boleto',
  });
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.recurring.create({
        ...form,
        amount: Number(form.amount),
      });
      toast.success('Despesa recorrente criada e próximas contas geradas.');
      setForm((value) => ({ ...value, description: '', amount: '' }));
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="surface-card p-4 xl:col-span-2">
      <h3 className="font-bold">Despesas recorrentes</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Aluguel, serviços e outras contas são gerados automaticamente com
        antecedência.
      </p>
      <form
        onSubmit={submit}
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field label="Descrição">
          <input
            required
            className="field"
            value={form.description}
            onChange={(e) =>
              setForm((v) => ({ ...v, description: e.target.value }))
            }
          />
        </Field>
        <Field label="Valor">
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            className="field"
            value={form.amount}
            onChange={(e) => setForm((v) => ({ ...v, amount: e.target.value }))}
          />
        </Field>
        <Field label="Categoria">
          <select
            required
            className="field"
            value={form.category_id}
            onChange={(e) =>
              setForm((v) => ({ ...v, category_id: e.target.value }))
            }
          >
            <option value="">Selecione</option>
            {bootstrap.categories
              .filter(
                (item) =>
                  item.active &&
                  (item.type === 'expense' || item.type === 'both'),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Frequência">
          <select
            className="field"
            value={form.frequency}
            onChange={(e) =>
              setForm((v) => ({ ...v, frequency: e.target.value }))
            }
          >
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
            <option value="yearly">Anual</option>
          </select>
        </Field>
        <Field label="Data inicial">
          <input
            type="date"
            className="field"
            value={form.start_date}
            onChange={(e) =>
              setForm((v) => ({ ...v, start_date: e.target.value }))
            }
          />
        </Field>
        <Field label="Dia do vencimento">
          <input
            type="number"
            min="1"
            max="31"
            className="field"
            value={form.due_day}
            onChange={(e) =>
              setForm((v) => ({ ...v, due_day: e.target.value }))
            }
          />
        </Field>
        <Field label="Forma padrão">
          <select
            className="field"
            value={form.payment_method}
            onChange={(e) =>
              setForm((v) => ({ ...v, payment_method: e.target.value }))
            }
          >
            {PAYMENT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {getPaymentLabel(value)}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="mt-auto min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50"
        >
          Criar recorrência
        </button>
      </form>
      {bootstrap.recurring?.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {bootstrap.recurring.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-border p-3"
            >
              <div className="flex justify-between gap-2">
                <strong className="text-sm">{item.description}</strong>
                <StatusBadge status={item.active ? 'paid' : 'cancelled'} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency(item.amount)} · próximo vencimento{' '}
                {formatDate(item.next_due_date)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PermissionsPanel({ bootstrap, refreshAll }) {
  if (!bootstrap.permissions.manage_permissions) return null;
  const labels = {
    view: 'Visualizar financeiro',
    create: 'Registrar lançamentos',
    edit: 'Editar lançamentos',
    pay: 'Marcar contas como pagas',
    view_profit: 'Visualizar lucro',
    view_costs: 'Visualizar custos',
    export: 'Exportar relatórios',
    manage_suppliers: 'Gerenciar fornecedores',
    manage_accounts: 'Gerenciar contas',
    manage_purchases: 'Gerenciar compras',
    approve_payments: 'Aprovar pagamentos',
    cancel: 'Cancelar ou estornar',
    manage_settings: 'Alterar configurações',
    manage_permissions: 'Gerenciar permissões',
  };
  return (
    <section className="surface-card p-4 xl:col-span-2">
      <h3 className="font-bold">Permissões financeiras por usuário</h3>
      <div className="mt-4 grid gap-3">
        {bootstrap.users
          .filter((u) => u.role !== 'admin')
          .map((user) => (
            <details
              key={user.id}
              className="rounded-xl border border-border p-3"
            >
              <summary className="cursor-pointer text-sm font-bold">
                {user.name}{' '}
                <span className="font-normal text-muted-foreground">
                  · {user.role}
                </span>
              </summary>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {bootstrap.permission_keys.map((key) => (
                  <label
                    key={key}
                    className="flex min-h-10 items-center gap-2 rounded-lg bg-muted/20 px-3 text-xs"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={Boolean(user.permissions[key])}
                      onChange={async (e) => {
                        const next = {
                          ...user.permissions,
                          [key]: e.target.checked,
                        };
                        try {
                          await nexoApi.finance.permissions.update(
                            user.id,
                            next,
                          );
                          user.permissions = next;
                          toast.success('Permissão atualizada.');
                          refreshAll();
                        } catch (cause) {
                          e.target.checked = !e.target.checked;
                          toast.error(cause.message);
                        }
                      }}
                    />
                    {labels[key] || key}
                  </label>
                ))}
              </div>
            </details>
          ))}
      </div>
    </section>
  );
}

function ReferenceCards({ items = [], empty, render }) {
  if (!items.length) return <EmptyState icon={Users} title={empty} />;
  return (
    <div className="grid content-start gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.id}
          className={`surface-card p-4 ${!item.active ? 'opacity-60' : ''}`}
        >
          {render(item)}
        </article>
      ))}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="block text-xs font-bold text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
function ModalActions({ saving, onClose, label = 'Salvar' }) {
  return (
    <div className="sticky -bottom-5 flex flex-col-reverse gap-2 border-t border-border bg-card pt-4 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </button>
    </div>
  );
}
function FinanceModal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const close = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = old;
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[80] grid items-end bg-black/55 p-0 sm:place-items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-modal-title"
        className={`max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-2xl sm:rounded-2xl sm:p-5 ${wide ? 'sm:max-w-5xl' : 'sm:max-w-2xl'}`}
      >
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 id="finance-modal-title" className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function downloadCsv(rows, name) {
  const content = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(';'),
    )
    .join('\n');
  const url = URL.createObjectURL(
    new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
