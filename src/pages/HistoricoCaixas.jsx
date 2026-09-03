import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Banknote,
  CalendarRange,
  Eye,
  FilterX,
  MinusCircle,
  PlusCircle,
  ReceiptText,
  SlidersHorizontal,
} from "lucide-react";
import { nexoApi } from "@/api/nexoApi";
import { useOutletContext } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/PageState";
import PaginationControls from "@/components/common/PaginationControls";
import { StatusBadge } from "@/components/common/visualTokens";
import { formatCurrency } from "@/lib/helpers";
import {
  FilterPanel,
  MetricCard,
  PageHeader,
} from "@/components/common/AppShell";
import {
  monthStartIsoDate,
  todayIsoDate,
  toDateTimeStart,
  toExclusiveDateTimeEnd,
} from "@/lib/date-helpers";
import CashDetail from "@/features/cash-history/components/CashDetail";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";
export default function HistoricoCaixas() {
  const requestSequence = useRef(0);
  const { user } = /** @type {any} */ (useOutletContext());
  const canSeeCashBalances = user.role !== "vendedor";
  const [filters, setFilters] = useState({
    from: monthStartIsoDate(),
    to: todayIsoDate(),
    operatorId: "",
    status: "",
    unitId: "",
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    items: [],
    operators: [],
    units: [],
    total: 0,
    page_count: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await nexoApi.cash.history({
        page,
        pageSize: 20,
        from: toDateTimeStart(filters.from),
        to: toExclusiveDateTimeEnd(filters.to),
        operatorId: filters.operatorId,
        status: filters.status,
        unitId: filters.unitId,
      });
      if (sequence === requestSequence.current) setData(result);
    } catch (cause) {
      if (
        sequence === requestSequence.current &&
        cause.code !== "REQUEST_REPLACED"
      )
        setError(
          cause.message || "Não foi possível consultar o histórico de caixas.",
        );
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);
  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "from" ? { to: value } : {}),
    }));
    setPage(1);
  };
  const openDetail = async (item) => {
    setSelected({ session: item, summary: item.summary || {} });
    setDetailLoading(true);
    try {
      setSelected(await nexoApi.cash.detail(item.id));
    } catch (cause) {
      toast.error(
        cause.message || "Não foi possível carregar os detalhes do caixa.",
      );
    } finally {
      setDetailLoading(false);
    }
  };
  const totals = useMemo(
    () =>
      data.items.reduce(
        (sum, item) => ({
          sales: sum.sales + Number(item.total_sales || 0),
          entries: sum.entries + Number(item.entries || 0),
          withdrawals: sum.withdrawals + Number(item.withdrawals || 0),
          differences: sum.differences + Number(item.difference || 0),
        }),
        { sales: 0, entries: 0, withdrawals: 0, differences: 0 },
      ),
    [data.items],
  );

  return (
    <div className="page-shell space-y-2.5 sm:space-y-4">
      <PageHeader
        icon={Banknote}
        eyebrow="Abertura e fechamento"
        title="Histórico de caixas"
        description={canSeeCashBalances ? "Aberturas, fechamentos e diferenças de caixa." : "Aberturas, fechamentos e quantidade de vendas."}
      />

      <FilterPanel aria-label="Filtros do histórico">
        <div className="grid gap-1.5 sm:hidden">
          <div className="grid grid-cols-2 gap-2">
            <Filter label="De">
              <input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} className="field" />
            </Filter>
            <Filter label="Até">
              <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter("to", e.target.value)} className="field" />
            </Filter>
          </div>
          <details className="group mobile-secondary-panel">
            <summary className="mobile-secondary-summary">
              <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Mais filtros</span>
              <span className="text-xs text-muted-foreground group-open:hidden">abrir</span>
              <span className="hidden text-xs text-muted-foreground group-open:inline">fechar</span>
            </summary>
            <div className="grid gap-1.5 border-t border-border p-1.5">
              <Filter label="Operador">
                <select value={filters.operatorId} onChange={(e) => updateFilter("operatorId", e.target.value)} disabled={user.role === "vendedor"} className="field">
                  <option value="">Todos</option>
                  {data.operators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Filter>
              <Filter label="Status">
                <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="field">
                  <option value="">Todos</option>
                  <option value="aberto">Em andamento</option>
                  <option value="fechado">Fechado</option>
                </select>
              </Filter>
              <Filter label="Unidade">
                <select value={filters.unitId} onChange={(e) => updateFilter("unitId", e.target.value)} className="field">
                  <option value="">Todas</option>
                  {data.units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Filter>
              <button type="button" onClick={() => { setFilters({ from: monthStartIsoDate(), to: todayIsoDate(), operatorId: "", status: "", unitId: "" }); setPage(1); }} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border text-sm font-bold hover:bg-muted">
                <FilterX className="h-4 w-4" /> Limpar
              </button>
            </div>
          </details>
        </div>

        <div className="hidden gap-2 sm:grid sm:grid-cols-2 xl:grid-cols-6">
          <Filter label="De"><input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} className="field" /></Filter>
          <Filter label="Até"><input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter("to", e.target.value)} className="field" /></Filter>
          <Filter label="Operador">
            <select value={filters.operatorId} onChange={(e) => updateFilter("operatorId", e.target.value)} disabled={user.role === "vendedor"} className="field">
              <option value="">Todos</option>
              {data.operators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Filter>
          <Filter label="Status">
            <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="field">
              <option value="">Todos</option>
              <option value="aberto">Em andamento</option>
              <option value="fechado">Fechado</option>
            </select>
          </Filter>
          <Filter label="Unidade">
            <select value={filters.unitId} onChange={(e) => updateFilter("unitId", e.target.value)} className="field">
              <option value="">Todas</option>
              {data.units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Filter>
          <button type="button" onClick={() => { setFilters({ from: monthStartIsoDate(), to: todayIsoDate(), operatorId: "", status: "", unitId: "" }); setPage(1); }} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold hover:bg-muted">
            <FilterX className="h-4 w-4" /> Limpar
          </button>
        </div>
      </FilterPanel>

      {data.items.length > 0 && (
        <section
          className={`grid gap-1.5 sm:gap-2 ${canSeeCashBalances ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-1'}`}
          aria-label="Resumo do período exibido"
        >
          {canSeeCashBalances ? <>
          <MetricCard label="Vendas na página" value={formatCurrency(totals.sales)} icon={ReceiptText} />
          <MetricCard
            label="Entradas"
            value={formatCurrency(totals.entries)}
            icon={PlusCircle}
            tone="green"
          />
          <MetricCard
            label="Retiradas"
            value={formatCurrency(totals.withdrawals)}
            icon={MinusCircle}
            tone="orange"
          />
          <MetricCard
            label="Diferenças"
            value={formatCurrency(totals.differences)}
            icon={Banknote}
            tone={Math.abs(totals.differences) > 0.009 ? "red" : "green"}
          />
          </> : (
            <MetricCard
              label="Quantidade de vendas"
              value={data.items.reduce((sum, item) => sum + Number(item.sales_count || item.summary?.sales_count || 0), 0)}
              icon={ReceiptText}
            />
          )}
        </section>
      )}

      {loading && data.items.length > 0 && (
        <div
          role="status"
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"
        >
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-accent" />{" "}
          Atualizando histórico...
        </div>
      )}
      {error && data.items.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {loading && !data.items.length ? (
        <LoadingState label="Consultando caixas..." />
      ) : error && !data.items.length ? (
        <ErrorState description={error} onRetry={load} />
      ) : !data.items.length ? (
        <EmptyState
          icon={CalendarRange}
          title="Nenhum caixa neste período"
          description="Ajuste os filtros ou aguarde a primeira abertura de caixa."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-none xl:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-normal text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5">Operador</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Abertura</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Fechamento</th>
                  {canSeeCashBalances && <th className="whitespace-nowrap px-3 py-2.5 text-right">Inicial</th>}
                  <th className="whitespace-nowrap px-3 py-2.5 text-right">{canSeeCashBalances ? "Vendas" : "Qtd. vendas"}</th>
                  {canSeeCashBalances && <th className="whitespace-nowrap px-3 py-2.5 text-right">Final</th>}
                  <th className="whitespace-nowrap px-3 py-2.5">Status</th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/25">
                    <td className="px-3 py-2.5">
                      <strong className="block">{item.seller_name}</strong>
                      <span className="text-xs text-muted-foreground">
                        {item.unit_name || "Unidade principal"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {formatDate(item.opened_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {formatDate(item.closed_at)}
                    </td>
                    {canSeeCashBalances && <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">
                      {formatCurrency(item.opening_amount)}
                    </td>}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums">
                      {canSeeCashBalances
                        ? formatCurrency(item.total_sales)
                        : item.sales_count || item.summary?.sales_count || 0}
                    </td>
                    {canSeeCashBalances && <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums">
                      {formatCurrency(item.final_amount)}
                    </td>}
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Status value={item.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold hover:bg-muted"
                      >
                        <Eye className="h-4 w-4" /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-1.5 xl:hidden">
            {data.items.map((item) => (
                <article
                  key={item.id}
            className="rounded-xl border border-border bg-card p-2 shadow-sm shadow-black/[0.015] sm:p-3"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <h2 className="text-sm font-black">{item.seller_name}</h2>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {item.unit_name || "Unidade principal"} ·{" "}
                        {formatDate(item.opened_at)}
                      </p>
                    </div>
                    <Status value={item.status} />
                  </div>
                  <dl className={`mt-2 grid gap-1.5 text-xs ${canSeeCashBalances ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-1'}`}>
                    <Value
                      label={canSeeCashBalances ? "Vendas" : "Quantidade de vendas"}
                      value={canSeeCashBalances
                        ? formatCurrency(item.total_sales)
                        : item.sales_count || item.summary?.sales_count || 0}
                    />
                    {canSeeCashBalances && <>
                      <Value label="Final" value={formatCurrency(item.final_amount)} />
                      <Value label="Inicial" value={formatCurrency(item.opening_amount)} />
                    </>}
                  </dl>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {canSeeCashBalances && <span className="truncate text-[11px] text-muted-foreground">
                      Entradas {formatCurrency(item.entries)} · Retiradas {formatCurrency(item.withdrawals)}
                    </span>}
                    <button
                      type="button"
                      onClick={() => openDetail(item)}
                      className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold hover:bg-muted"
                    >
                      <Eye className="h-3.5 w-3.5" /> Resumo
                    </button>
                  </div>
                </article>
            ))}
          </div>
          <PaginationControls
            page={page}
            pageCount={data.page_count}
            total={data.total}
            pageSize={20}
            onPageChange={setPage}
          />
        </>
      )}
      {selected && (
        <CashDetail
          data={selected}
          loading={detailLoading}
          currentUser={user}
          onClose={() => setSelected(null)}
          onChanged={async ({ refetchDetail = true } = {}) => {
            if (refetchDetail) await openDetail(selected.session);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Filter({ label, children }) {
  return (
    <label className="block text-xs font-bold text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
function Status({ value }) {
  return <StatusBadge status={value} />;
}
function Value({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-bold tabular-nums">{value}</dd>
    </div>
  );
}
