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
import { nexoApi } from '@/api/nexoApi';
import {
  ErrorState,
  LoadingState,
} from '@/components/common/PageState';
import FinanceOverview from '@/components/finance/FinanceOverview';
import PeriodFilter from '@/components/finance/FinancePeriodFilter';
import { rangePreset } from '@/features/finance/finance-period';
import {
  formatDate,
} from '@/lib/helpers';
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
const FinanceSettings = lazy(() => import('@/features/finance/settings/FinanceSettingsPanel'));
const LedgerPanel = lazy(() => import('@/features/finance/movements/LedgerPanel'));
const ReceivablesPanel = lazy(() => import('@/features/finance/movements/ReceivablesPanel'));
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
