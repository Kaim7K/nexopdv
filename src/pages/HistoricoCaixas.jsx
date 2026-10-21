import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Banknote,
  Clock3,
  CircleCheck,
  CircleDot,
  Store,
  Users,
  CalendarRange,
  Eye,
  MinusCircle,
  PlusCircle,
  ReceiptText,
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
import { cashClosingSituation } from "@/lib/cash-history";
import {
  MetricCard,
  PageHeader,
} from "@/components/common/AppShell";
import {
  monthStartIsoDate,
  todayIsoDate,
  toDateTimeStart,
  toExclusiveDateTimeEnd,
} from "@/lib/date-helpers";
import HistoryFilters, { FilterField } from "@/components/common/HistoryFilters";
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
    situation: "",
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
        situation: filters.situation,
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

      <HistoryFilters
        label="Filtros do histórico"
        dates={<>
          <FilterField label="De"><input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} /></FilterField>
          <FilterField label="Até"><input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter("to", e.target.value)} /></FilterField>
        </>}
        quickRanges={[
          { label: 'Hoje', active: filters.from === todayIsoDate() && filters.to === todayIsoDate(), onClick: () => { setFilters((current) => ({ ...current, from: todayIsoDate(), to: todayIsoDate() })); setPage(1); } },
          { label: 'Este mês', active: filters.from === monthStartIsoDate() && filters.to === todayIsoDate() && filters.from !== todayIsoDate(), onClick: () => { setFilters((current) => ({ ...current, from: monthStartIsoDate(), to: todayIsoDate() })); setPage(1); } },
        ]}
        activeFilters={[
          ...(filters.operatorId ? [{ key: 'operator', label: data.operators.find((item) => item.id === filters.operatorId)?.name || 'Operador selecionado', onRemove: () => updateFilter('operatorId', '') }] : []),
          ...(filters.status ? [{ key: 'status', label: filters.status === 'aberto' ? 'Em andamento' : 'Fechado', onRemove: () => updateFilter('status', '') }] : []),
          ...(filters.unitId ? [{ key: 'unit', label: data.units.find((item) => item.id === filters.unitId)?.name || 'Unidade selecionada', onRemove: () => updateFilter('unitId', '') }] : []),
          ...(canSeeCashBalances && filters.situation ? [{ key: 'situation', label: { conferido: 'Conferidos', sobra: 'Com sobra', falta: 'Com falta' }[filters.situation], onRemove: () => updateFilter('situation', '') }] : []),
        ]}
        onClear={() => { setFilters((current) => ({ ...current, operatorId: '', status: '', unitId: '', situation: '' })); setPage(1); }}
      >
        <FilterField label="Operador" icon={Users}>
          <select value={filters.operatorId} onChange={(e) => updateFilter("operatorId", e.target.value)} disabled={user.role === "vendedor"}>
            <option value="">Todos os operadores</option>
            {data.operators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Status" icon={CircleDot}>
          <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
            <option value="">Todos os status</option>
            <option value="aberto">Em andamento</option>
            <option value="fechado">Fechado</option>
          </select>
        </FilterField>
        <FilterField label="Unidade" icon={Store}>
          <select value={filters.unitId} onChange={(e) => updateFilter("unitId", e.target.value)}>
            <option value="">Todas as unidades</option>
            {data.units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </FilterField>
        {canSeeCashBalances && <ClosingSituationFilter value={filters.situation} onChange={(value) => updateFilter("situation", value)} />}
      </HistoryFilters>

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
          <div className="history-results" aria-label="Registros de caixas">
            <div className="history-table overflow-hidden rounded-lg border border-border bg-card shadow-none">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-normal text-muted-foreground">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2.5">Operador</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Abertura</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Fechamento</th>
                    {canSeeCashBalances && <th className="whitespace-nowrap px-3 py-2.5 text-right">Inicial</th>}
                    <th className="whitespace-nowrap px-3 py-2.5 text-right">{canSeeCashBalances ? "Vendas" : "Qtd. vendas"}</th>
                    {canSeeCashBalances && <th className="whitespace-nowrap px-3 py-2.5 text-right">Saldo / final</th>}
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
                        <FinalAmount item={item} />
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
            <div className="history-card-list">
              {data.items.map((item) => (
                  <article
                    key={item.id}
                    className="history-record-card cash-history-card"
                  >
                    <div className="history-record-heading">
                      <div className="min-w-0">
                        <h2 className="history-record-title">{item.seller_name}</h2>
                        <p className="history-record-unit" title={item.unit_name || "Unidade principal"}>
                          <Store aria-hidden="true" className="h-3 w-3 shrink-0" /> {item.unit_name || "Unidade principal"}
                        </p>
                      </div>
                      <Status value={item.status} />
                    </div>
                    <dl className="cash-history-dates">
                      <div><dt><Clock3 aria-hidden="true" /> Abertura</dt><dd>{formatDate(item.opened_at)}</dd></div>
                      <div><dt><CircleCheck aria-hidden="true" /> Fechamento</dt><dd>{item.closed_at ? formatDate(item.closed_at) : 'Em andamento'}</dd></div>
                    </dl>
                    <dl className={`cash-history-values ${canSeeCashBalances ? '' : 'cash-history-count'}`}>
                      {canSeeCashBalances && <>
                        <Value label="Inicial" value={formatCurrency(item.opening_amount)} />
                      </>}
                      <Value
                        label={canSeeCashBalances ? "Vendas" : "Quantidade de vendas"}
                        value={canSeeCashBalances
                          ? formatCurrency(item.total_sales)
                          : item.sales_count || item.summary?.sales_count || 0}
                      />
                      {canSeeCashBalances && <Value label={item.status === 'fechado' ? "Final" : "Saldo atual"} value={<FinalAmount item={item} />} />}
                    </dl>
                    <div className="history-record-footer">
                      {canSeeCashBalances && <div className="cash-history-movements">
                        <span><PlusCircle aria-hidden="true" className="text-emerald-600 dark:text-emerald-400" /> Entradas <strong>{formatCurrency(item.entries)}</strong></span>
                        <span><MinusCircle aria-hidden="true" className="text-orange-600 dark:text-orange-400" /> Retiradas <strong>{formatCurrency(item.withdrawals)}</strong></span>
                      </div>}
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        aria-label={`Ver detalhes do caixa de ${item.seller_name}, aberto em ${formatDate(item.opened_at)}`}
                        className="history-record-details"
                      >
                        <Eye aria-hidden="true" className="h-3.5 w-3.5" /> Detalhes
                      </button>
                    </div>
                  </article>
              ))}
            </div>
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

function Status({ value }) {
  return <StatusBadge status={value} />;
}
function ClosingSituationFilter({ value, onChange }) {
  return (
    <FilterField label="Fechamento" icon={CircleCheck}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field">
        <option value="">Todos os caixas</option>
        <option value="conferido">Caixas conferidos</option>
        <option value="sobra">Caixas com sobra</option>
        <option value="falta">Caixas com falta</option>
      </select>
    </FilterField>
  );
}
function FinalAmount({ item }) {
  const situation = cashClosingSituation(item);
  return (
    <>
      <span className="block">{formatCurrency(item.final_amount)}</span>
      {situation === "conferido" && (
        <span className="block text-[11px] font-medium text-muted-foreground">Conferido</span>
      )}
      {(situation === "sobra" || situation === "falta") && (
        <span className={`block text-xs font-semibold ${situation === "sobra" ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
          {situation === "sobra" ? "Sobra +" : "Falta −"}{formatCurrency(Math.abs(Number(item.difference)))}
        </span>
      )}
    </>
  );
}
function Value({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-bold tabular-nums">{value}</dd>
    </div>
  );
}
