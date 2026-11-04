import { BasicFinance } from '@/components/plans/BasicOperations';
import { canUseFinanceSection, hasPlanFeature } from '@/lib/plan-catalog';
import { useAuth } from '@/lib/AuthContext';
import { useSearchParams } from 'react-router-dom';
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  BarChart3,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileBarChart,
  Landmark,
  PackagePlus,
  Plus,
  Receipt,
  Settings,
  Store,
  Target,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/common/PageState';
import {
  Field,
} from '@/components/finance/FinanceUi';
import FinanceOverview, { MetricCard } from '@/components/finance/FinanceOverview';
import PeriodFilter from '@/components/finance/FinancePeriodFilter';
import { rangePreset } from '@/features/finance/finance-period';
import { PAYMENT_OPTIONS } from '@/features/finance/payment-options';
import {
  StatusBadge,
} from '@/components/finance/TransactionList';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getPaymentLabel,
} from '@/lib/helpers';
import {
  todayIsoDate,
} from '@/lib/date-helpers';
import {
  TransactionModal,
  TransactionsPanel,
} from '@/features/finance/transactions/TransactionsPanel';

/** @type {Array<{label: string, items: Array<[string, string, React.ElementType]>}>} */
const NAV_GROUPS = [
  {
    label: 'Dia a dia',
    items: [
      ['overview', 'Visão geral', BarChart3],
      ['expenses', 'Despesas', ArrowDownCircle],
      ['payables', 'Contas a pagar', Receipt],
      ['receivables', 'Contas a receber', CircleDollarSign],
    ],
  },
  {
    label: 'Movimentação',
    items: [
      ['movements', 'Movimentações', ArrowRightLeft],
      ['revenue', 'Receitas', ArrowUpCircle],
      ['cashflow', 'Fluxo de caixa', TrendingUp],
      ['accounts', 'Contas financeiras', Landmark],
    ],
  },
  {
    label: 'Gestão e análise',
    items: [
      ['results', 'Resultados', FileBarChart],
      ['purchases', 'Compras', PackagePlus],
      ['suppliers', 'Fornecedores', Store],
      ['reconciliation', 'Conciliação', Check],
      ['goals', 'Metas', Target],
      ['reports', 'Relatórios', Download],
      ['settings', 'Configurações', Settings],
    ],
  },
];
const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
const PRIMARY_NAV_KEYS = new Set([
  'overview',
  'movements',
  'payables',
]);
const CashFlow = lazy(() =>
  import('@/features/finance/analysis/FinancialAnalysis').then(module => ({ default: module.CashFlow })),
);
const Results = lazy(() =>
  import('@/features/finance/analysis/FinancialAnalysis').then(module => ({ default: module.Results })),
);
const Reports = lazy(() =>
  import('@/features/finance/analysis/FinancialAnalysis').then(module => ({ default: module.Reports })),
);
const Suppliers = lazy(() => import('@/features/finance/references/SuppliersPanel'));
const Accounts = lazy(() => import('@/features/finance/references/AccountsPanel'));
const Purchases = lazy(() => import('@/features/finance/purchases/PurchasesPanel'));
const Reconciliation = lazy(() => import('@/features/finance/reconciliation/ReconciliationPanel'));
const Goals = lazy(() => import('@/features/finance/goals/GoalsPanel'));
export default function Financeiro() {
  const { user } = useAuth();
  return hasPlanFeature(user, 'advanced_finance') ? <AdvancedFinance /> : <BasicFinance />;
}

function AdvancedFinance() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [active, setActive] = useState(() => params.get('tab') === 'payables' && canUseFinanceSection(user, 'payables') ? 'payables' : 'overview');
  const [bootstrap, setBootstrap] = useState(null),
    [dashboard, setDashboard] = useState(null);
  const [range, setRange] = useState(rangePreset('month')),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [transactionType, setTransactionType] = useState(null),
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
    nexoApi.cache.clear('/finance');
    setRevision((value) => value + 1);
  };
  const availableNav = NAV_ITEMS.filter(
    ([key]) =>
      canUseFinanceSection(user, key) && (key !== 'purchases' ||
      (bootstrap?.enabled_features || []).includes('integrated_purchases')),
  );
  const primaryNav = availableNav.filter(([key]) => PRIMARY_NAV_KEYS.has(key));
  const secondaryGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      ([key]) =>
        !PRIMARY_NAV_KEYS.has(key) &&
        availableNav.some(([availableKey]) => availableKey === key),
    ),
  })).filter((group) => group.items.length);
  const nav =
    availableNav.find((item) => item[0] === active) || availableNav[0];
  const secondaryActive = !PRIMARY_NAV_KEYS.has(active);
  if (loading && !bootstrap)
    return <LoadingState label="Carregando financeiro..." />;
  if (error && !bootstrap)
    return (
      <div className="page-shell">
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  return (
    <div className="page-shell space-y-4">
      <header className="page-header mb-0">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <WalletCards className="h-3.5 w-3.5" /> Dinheiro do mercado
          </div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle">
            Entradas, saídas, contas e saldo.
          </p>
          <p className="sr-only">O que você quer fazer?</p>
          <p className="sr-only">Ver análises detalhadas</p>
        </div>
        <button
          type="button"
          onClick={() => setTransactionType('expense')}
          disabled={!bootstrap?.permissions?.create}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm sm:min-h-11 sm:px-4 font-bold text-accent-foreground shadow-sm hover:bg-accent/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Adicionar despesa
        </button>
      </header>
      <section className="surface-card p-2 no-print">
        <label className="sr-only" htmlFor="finance-section">
          Área financeira
        </label>
        <select
          id="finance-section"
          className="field mt-0 lg:hidden"
          value={active}
          onChange={(event) => setActive(event.target.value)}
        >
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(([key]) =>
              availableNav.some(([availableKey]) => availableKey === key),
            );
            return items.length ? (
              <optgroup key={group.label} label={group.label}>
                {items.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
        <div className="hidden items-center justify-between gap-3 lg:flex">
          <nav aria-label="Áreas financeiras principais" className="flex gap-1">
            {primaryNav.map(([key, label, Icon]) => (
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
          <details className="group relative">
            <summary
              className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-xs font-bold transition marker:hidden ${secondaryActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              {secondaryActive ? nav[1] : 'Mais opções'}
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 grid w-[min(620px,calc(100vw-3rem))] grid-cols-3 gap-4 rounded-2xl border border-border bg-card p-4 shadow-xl">
              {secondaryGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map(([key, label, Icon]) => (
                      <button
                        type="button"
                        key={key}
                        aria-label={`Abrir ${label}`}
                        onClick={(event) => {
                          setActive(key);
                          event.currentTarget
                            .closest('details')
                            ?.removeAttribute('open');
                        }}
                        aria-current={active === key ? 'page' : undefined}
                        className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 text-left text-xs font-semibold transition ${active === key ? 'bg-accent/10 text-accent' : 'hover:bg-muted'}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
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
      <Suspense fallback={<LoadingState label="Carregando seção financeira..." />}>
        <FinanceSection
          active={nav[0]}
          dashboard={dashboard}
          bootstrap={bootstrap}
          range={range}
          refresh={refresh}
          onNavigate={setActive}
          onAddTransaction={setTransactionType}
        />
      </Suspense>
      <TransactionModal
        open={Boolean(transactionType)}
        onClose={() => setTransactionType(null)}
        bootstrap={bootstrap}
        initialType={transactionType || 'expense'}
        onSaved={() => {
          setTransactionType(null);
          refresh();
        }}
      />
    </div>
  );
}

function FinanceSection({
  active,
  dashboard,
  bootstrap,
  range,
  refresh,
  onNavigate,
  onAddTransaction,
}) {
  if (active === 'overview')
    return (
      <FinanceOverview
        data={dashboard}
        onNavigate={onNavigate}
        onAddTransaction={onAddTransaction}
        canCreate={bootstrap.permissions.create}
      />
    );
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
            {item.type === 'revenue' ? '+' : 'âˆ’'}{' '}
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
    start_date: todayIsoDate(),
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
  const { user } = useAuth();
  if (!bootstrap.permissions.manage_permissions || !hasPlanFeature(user, 'advanced_permissions')) return null;
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
