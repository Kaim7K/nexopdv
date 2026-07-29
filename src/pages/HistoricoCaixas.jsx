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
  Trash2,
  X,
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
import { useModalBehavior } from "@/hooks/use-modal-behavior";
import { useConfirm } from "@/components/common/ConfirmProvider";
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyDigits,
} from "@/lib/helpers";
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

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const PAYMENT_LABELS = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
  outros: "Outros",
  fiado: "Fiado",
};

export default function HistoricoCaixas() {
  const requestSequence = useRef(0);
  const { user } = /** @type {any} */ (useOutletContext());
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
    setFilters((current) => ({ ...current, [key]: value }));
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
    <div className="page-shell space-y-3 sm:space-y-5">
      <PageHeader
        icon={Banknote}
        eyebrow="Operação financeira"
        title="Histórico de caixas"
          description="Aberturas, vendas, movimentações, conferência e fechamento por operador."
      />

      <FilterPanel
        aria-label="Filtros do histórico"
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6"
      >
        <Filter label="De">
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => updateFilter("from", e.target.value)}
            className="field"
          />
        </Filter>
        <Filter label="Até">
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => updateFilter("to", e.target.value)}
            className="field"
          />
        </Filter>
        <Filter label="Operador">
          <select
            value={filters.operatorId}
            onChange={(e) => updateFilter("operatorId", e.target.value)}
            disabled={user.role === "vendedor"}
            className="field"
          >
            <option value="">Todos</option>
            {data.operators.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Status">
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="field"
          >
            <option value="">Todos</option>
            <option value="aberto">Em andamento</option>
            <option value="fechado">Fechado</option>
          </select>
        </Filter>
        <Filter label="Unidade">
          <select
            value={filters.unitId}
            onChange={(e) => updateFilter("unitId", e.target.value)}
            className="field"
          >
            <option value="">Todas</option>
            {data.units.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <button
          type="button"
          onClick={() => {
            setFilters({
              from: monthStartIsoDate(),
              to: todayIsoDate(),
              operatorId: "",
              status: "",
              unitId: "",
            });
            setPage(1);
          }}
          className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold hover:bg-muted"
        >
          <FilterX className="h-4 w-4" /> Limpar
        </button>
      </FilterPanel>

      {data.items.length > 0 && (
        <section
          className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4"
          aria-label="Resumo do período exibido"
        >
          <MetricCard
            label="Vendas na página"
            value={formatCurrency(totals.sales)}
            icon={ReceiptText}
          />
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
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Operador / unidade</th>
                  <th className="px-4 py-3">Abertura</th>
                  <th className="px-4 py-3">Fechamento</th>
                  <th className="px-4 py-3 text-right">Inicial</th>
                  <th className="px-4 py-3 text-right">Vendas</th>
                  <th className="px-4 py-3 text-right">Final</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/25">
                    <td className="px-4 py-3">
                      <strong className="block">{item.seller_name}</strong>
                      <span className="text-xs text-muted-foreground">
                        {item.unit_name || "Unidade principal"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(item.opened_at)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(item.closed_at)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(item.opening_amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {formatCurrency(item.total_sales)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {formatCurrency(item.final_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Status value={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-bold hover:bg-muted"
                      >
                        <Eye className="h-4 w-4" /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 xl:hidden">
            {data.items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-border bg-card p-2.5 shadow-sm sm:rounded-2xl sm:p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-black">{item.seller_name}</h2>
                      <p className="text-[11px] text-muted-foreground">
                        {item.unit_name || "Unidade principal"} ·{" "}
                        {formatDate(item.opened_at)}
                      </p>
                    </div>
                    <Status value={item.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
                    <Value
                      label="Valor inicial"
                      value={formatCurrency(item.opening_amount)}
                  />
                  <Value
                    label="Total de vendas"
                    value={formatCurrency(item.total_sales)}
                  />
                  <Value
                    label="Entradas / retiradas"
                    value={`${formatCurrency(item.entries)} / ${formatCurrency(item.withdrawals)}`}
                  />
                  <Value
                    label="Valor final"
                    value={formatCurrency(item.final_amount)}
                  />
                  </dl>
                  <button
                    type="button"
                    onClick={() => openDetail(item)}
                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold hover:bg-muted"
                  >
                    <Eye className="h-4 w-4" /> Ver resumo completo
                  </button>
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

function CashDetail({ data, loading, currentUser, onClose, onChanged }) {
  const { session, summary = {} } = data;
  const [movementOpen, setMovementOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedSaleLoading, setSelectedSaleLoading] = useState(false);
  const [movement, setMovement] = useState({
    type: "entrada",
    amount: "",
    note: "",
  });
  const [editForm, setEditForm] = useState({
    opening_amount: "",
    closing_amount: "",
    closing_expense: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingCash, setEditingCash] = useState(false);
  const confirmDialog = useConfirm();
  const modalRef = useModalBehavior({ onClose, disabled: saving || deleting });
  const canMove =
    session.status === "aberto" && session.seller_id === currentUser.id;
  const canDelete = currentUser.role === "admin" && session.status === "fechado";
  const canManageClosed = currentUser.role === "admin" && session.status === "fechado";
  const paymentEntries = Object.entries(summary.payments || {});
  const openingAmount = Number(summary.opening_amount ?? session.opening_amount ?? 0);
  const totalSales = Number(summary.total || 0);
  const cashReceived = Number(
    summary.payments?.dinheiro ?? summary.cash_sales ?? 0,
  );
  const expectedBeforeExpense = Number(summary.expected_cash || 0);
  const closingExpense = Number(
    session.closing_expense ?? summary.closing_expense ?? 0,
  );
  const expectedAfterExpense = expectedBeforeExpense - closingExpense;
  const declaredCash = Number(session.closing_amount ?? expectedAfterExpense);
  const cashDifference =
    session.difference !== null && session.difference !== undefined
      ? Number(session.difference)
      : declaredCash - expectedAfterExpense;
  const hasDifference = Math.abs(cashDifference) >= 0.005;
  const differenceLabel = !hasDifference
    ? "Caixa conferido"
    : cashDifference > 0
      ? "Sobra no caixa"
      : "Falta no caixa";
  const differenceTone = !hasDifference
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-red-600 dark:text-red-300";
  const differenceSummary = !hasDifference
    ? "Dinheiro contado bate com o esperado."
    : "Revise recebimentos em dinheiro, despesas e contagem final.";

  useEffect(() => {
    setEditing(false);
    setEditForm({
      opening_amount: formatCurrencyInput(
        String(Math.round(Number(session.opening_amount || 0) * 100)),
      ),
      closing_amount: formatCurrencyInput(
        String(
          Math.round(
            Number(session.closing_amount ?? summary.expected_cash ?? 0) * 100,
          ),
        ),
      ),
      closing_expense: formatCurrencyInput(
        String(
          Math.round(Number(session.closing_expense || summary.closing_expense || 0) * 100),
        ),
      ),
    });
  }, [
    session.id,
    session.opening_amount,
    session.closing_amount,
    session.closing_expense,
    session.status,
    summary.expected_cash,
    summary.closing_expense,
  ]);
  const saveMovement = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await nexoApi.cash.addMovement(session.id, movement);
      toast.success(
        movement.type === "entrada"
          ? "Entrada registrada."
          : "Retirada registrada.",
      );
      setMovement({ type: "entrada", amount: "", note: "" });
      setMovementOpen(false);
      await onChanged();
    } catch (cause) {
      toast.error(
        cause.message || "Não foi possível registrar a movimentação.",
      );
    } finally {
      setSaving(false);
    }
  };
  const deleteSession = async () => {
    const confirmed = await confirmDialog({
      title: "Excluir este caixa?",
      description:
        "Esta ação remove somente esta sessão do histórico, junto com as movimentações ligadas a ela. Caixas em aberto não podem ser excluídos.",
      confirmLabel: "Excluir caixa",
      tone: "destructive",
    });
    if (!confirmed) return;
    if (deleting) return;
    setDeleting(true);
    try {
      await nexoApi.cash.remove(session.id);
      toast.success("Caixa excluído do histórico.");
      await onChanged({ refetchDetail: false });
      onClose();
    } catch (cause) {
      toast.error(cause.message || "Não foi possível excluir o caixa.");
    } finally {
      setDeleting(false);
    }
  };
  const reopenSession = async () => {
    const confirmed = await confirmDialog({
      title: "Reabrir este caixa?",
      description:
        "O caixa ficará em aberto novamente para permitir ajustes e continuidade do turno.",
      confirmLabel: "Reabrir caixa",
      tone: "primary",
    });
    if (!confirmed || editingCash) return;
    setEditingCash(true);
    try {
      await nexoApi.cash.reopen(session.id);
      toast.success("Caixa reaberto.");
      await onChanged();
    } catch (cause) {
      toast.error(cause.message || "Não foi possível reabrir o caixa.");
    } finally {
      setEditingCash(false);
    }
  };
  const saveEdit = async (event) => {
    event.preventDefault();
    if (editingCash) return;
    setEditingCash(true);
    try {
      await nexoApi.cash.update(session.id, {
        status: "fechado",
        opening_amount: parseCurrencyDigits(editForm.opening_amount),
        closing_amount: parseCurrencyDigits(editForm.closing_amount),
        closing_expense: parseCurrencyDigits(editForm.closing_expense),
      });
      toast.success("Caixa atualizado.");
      setEditing(false);
      await onChanged();
    } catch (cause) {
      toast.error(cause.message || "Não foi possível salvar as alterações.");
    } finally {
      setEditingCash(false);
    }
  };
  const openSaleDetail = async (sale) => {
    setSelectedSale({ ...sale, _loading: true });
    setSelectedSaleLoading(true);
    try {
      setSelectedSale(await nexoApi.entities.Sale.get(sale.id));
    } catch (cause) {
      setSelectedSale(null);
      toast.error(cause.message || "Não foi possível abrir a venda.");
    } finally {
      setSelectedSaleLoading(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-0 backdrop-blur-sm sm:p-4"
      role="presentation"
    >
      <section
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-detail-title"
        className="flex h-dvh w-full max-w-4xl flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[94dvh] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl"
      >
        <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="cash-detail-title" className="truncate text-lg font-black sm:text-xl">
                Caixa de {session.seller_name}
              </h2>
              <Status value={session.status} />
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
              {session.unit_name || "Unidade principal"} · aberto em{" "}
              {formatDate(session.opened_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-none">
            {canManageClosed && !editing && (
              <>
                <button
                  type="button"
                  onClick={reopenSession}
                  disabled={editingCash}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-500/5 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
                >
                  <PlusCircle className="h-4 w-4" />
                  {editingCash ? "Reabrindo..." : "Reabrir"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={editingCash}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-bold hover:bg-muted disabled:opacity-50"
                >
                  <ReceiptText className="h-4 w-4" />
                  Editar caixa
                </button>
              </>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={deleteSession}
                disabled={deleting}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar detalhes"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <LoadingState label="Carregando movimentação completa..." />
          ) : (
            <>
              <section className="rounded-2xl border border-border bg-muted/10 p-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black">Resumo do turno</h3>
                    <p className="text-xs text-muted-foreground">
                      Vendas registradas no período deste caixa.
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    {summary.sales_count || 0} venda(s)
                  </span>
                </div>
                <dl className="grid gap-2 sm:grid-cols-3">
                  <ValueCard
                    label="Total vendido"
                    value={formatCurrency(totalSales)}
                    hint="Receita registrada"
                  />
                  <ValueCard
                    label="Dinheiro"
                    value={formatCurrency(cashReceived)}
                    hint="Vai para conferência"
                  />
                  <ValueCard
                    label="Outras formas"
                    value={formatCurrency(totalSales - cashReceived)}
                    hint="Pix, cartão, fiado"
                  />
                </dl>
              </section>

              <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                  <div>
                    <h3 className="font-black">Conferência do dinheiro</h3>
                    <p className="text-xs text-muted-foreground">
                      Valor inicial + dinheiro recebido - despesas = dinheiro esperado.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">
                      Resultado
                    </p>
                    <strong className={`mt-1 block text-xl font-black tabular-nums ${differenceTone}`}>
                      {differenceLabel}
                    </strong>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {differenceSummary}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <dl className="grid gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                    <div className="px-3 pb-1 text-xs font-black uppercase text-muted-foreground">
                      Cálculo esperado
                    </div>
                    <CashFormulaRow label="Valor inicial" value={openingAmount} />
                    <CashFormulaRow label="Recebido em dinheiro" value={cashReceived} positive />
                    <CashFormulaRow label="Despesa no fechamento" value={closingExpense} negative />
                    <CashFormulaRow
                      label="Esperado no caixa"
                      value={expectedAfterExpense}
                      total
                    />
                  </dl>
                  <dl className="grid gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                    <div className="px-3 pb-1 text-xs font-black uppercase text-muted-foreground">
                      Fechamento informado
                    </div>
                    <CashFormulaRow
                      label="Dinheiro contado"
                      value={declaredCash}
                      total
                    />
                    <CashFormulaRow
                      label="Diferença"
                      value={cashDifference}
                      total
                      tone={
                        !hasDifference
                          ? "neutral"
                          : cashDifference > 0
                            ? "positive"
                            : "negative"
                      }
                    />
                    <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {session.status === "fechado"
                        ? "A diferença compara o dinheiro esperado com o dinheiro contado no fechamento."
                        : "Caixa em andamento. A conferência final aparece ao fechar."}
                    </p>
                  </dl>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-black">Distribuição dos pagamentos</h3>
                  {canMove && (
                    <button
                      type="button"
                      onClick={() => setMovementOpen((v) => !v)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-xs font-bold text-accent-foreground"
                    >
                      <PlusCircle className="h-4 w-4" /> Movimentar caixa
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {paymentEntries.length ? (
                    paymentEntries.map(
                      ([method, value]) => (
                        <div
                          key={method}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-sm"
                        >
                          <span>{PAYMENT_LABELS[method] || method}</span>
                          <strong>{formatCurrency(value)}</strong>
                        </div>
                      ),
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum pagamento registrado.
                    </p>
                  )}
                </div>
              </section>
              {editing && canManageClosed && (
                <form
                  onSubmit={saveEdit}
                  className="rounded-2xl border border-accent/30 bg-accent/5 p-4"
                >
                  <div className="mb-3">
                    <h3 className="font-black">Ajustar conferência</h3>
                    <p className="text-xs text-muted-foreground">
                      Edite apenas os valores físicos usados no fechamento do caixa.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Filter label="Valor inicial do caixa">
                      <input
                        className="field"
                        required
                        type="text"
                        inputMode="numeric"
                        value={editForm.opening_amount}
                        onChange={(e) =>
                          setEditForm((current) => ({
                            ...current,
                            opening_amount: formatCurrencyInput(
                              e.target.value.replace(/\D/g, ""),
                            ),
                          }))
                        }
                      />
                    </Filter>
                    <Filter label="Dinheiro contado no fechamento">
                      <input
                        className="field"
                        type="text"
                        inputMode="numeric"
                        value={editForm.closing_amount}
                        onChange={(e) =>
                          setEditForm((current) => ({
                            ...current,
                            closing_amount: formatCurrencyInput(
                              e.target.value.replace(/\D/g, ""),
                            ),
                          }))
                        }
                      />
                    </Filter>
                    <Filter label="Despesa no fechamento">
                      <input
                        className="field"
                        type="text"
                        inputMode="numeric"
                        value={editForm.closing_expense}
                        onChange={(e) =>
                          setEditForm((current) => ({
                            ...current,
                            closing_expense: formatCurrencyInput(
                              e.target.value.replace(/\D/g, ""),
                            ),
                          }))
                        }
                      />
                    </Filter>
                  </div>
                  <div className="mt-4 flex gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={editingCash}
                      className="min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50"
                    >
                      {editingCash ? "Salvando..." : "Salvar alterações"}
                    </button>
                  </div>
                </form>
              )}
              {movementOpen && (
                <form
                  onSubmit={saveMovement}
                  className="grid gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:grid-cols-3"
                >
                  <Filter label="Tipo">
                    <select
                      className="field"
                      value={movement.type}
                      onChange={(e) =>
                        setMovement((v) => ({ ...v, type: e.target.value }))
                      }
                    >
                      <option value="entrada">Entrada</option>
                      <option value="retirada">Retirada</option>
                    </select>
                  </Filter>
                  <Filter label="Valor">
                    <input
                      className="field"
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={movement.amount}
                      onChange={(e) =>
                        setMovement((v) => ({ ...v, amount: e.target.value }))
                      }
                    />
                  </Filter>
                  <Filter label="Motivo">
                    <input
                      className="field"
                      required
                      maxLength={500}
                      value={movement.note}
                      onChange={(e) =>
                        setMovement((v) => ({ ...v, note: e.target.value }))
                      }
                    />
                  </Filter>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50 sm:col-span-3"
                  >
                    {saving ? "Registrando..." : "Confirmar movimentação"}
                  </button>
                </form>
              )}
              <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card p-4">
                <h3 className="mb-3 font-black">Entradas e retiradas</h3>
                {summary.movements?.length ? (
                  <div className="space-y-2">
                    {summary.movements.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-border p-3"
                      >
                        <span
                          className={
                            item.type === "entrada"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }
                        >
                          {item.type === "entrada" ? (
                            <PlusCircle className="h-5 w-5" />
                          ) : (
                            <MinusCircle className="h-5 w-5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <strong className="block text-sm capitalize">
                            {item.type}
                          </strong>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.note || "Sem observação"} ·{" "}
                            {formatDate(item.created_at || item.created_date)}
                          </p>
                        </div>
                        <strong>{formatCurrency(item.amount)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma entrada ou retirada avulsa.
                  </p>
                )}
              </section>
              <section className="rounded-2xl border border-border bg-card p-4">
                <h3 className="mb-3 font-black">Vendas vinculadas</h3>
                {summary.sales?.length ? (
                  <div className="space-y-2">
                    {summary.sales.map((sale) => (
                      <button
                        key={sale.id}
                        type="button"
                        onClick={() => openSaleDetail(sale)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left text-sm transition hover:bg-muted/25"
                      >
                        <div className="min-w-0">
                          <strong className="block truncate">
                            Venda #{sale.sale_number}
                          </strong>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {formatDate(sale.created_date)} · {sale.status}
                          </p>
                        </div>
                        <strong className="flex-none tabular-nums">
                          {formatCurrency(sale.total)}
                        </strong>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma venda vinculada a este caixa.
                  </p>
                )}
              </section>
              </div>
            </>
          )}
        </div>
        {selectedSale && (
          <CashSaleDetailModal
            sale={selectedSale}
            loading={selectedSaleLoading || selectedSale._loading}
            onClose={() => setSelectedSale(null)}
          />
        )}
      </section>
    </div>
  );
}

function CashSaleDetailModal({ sale, loading, onClose }) {
  const { summary = {} } = sale;
  const totals = {
    subtotal: Number(sale.subtotal ?? (sale.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0)),
    total: Number(sale.total ?? summary.total ?? 0),
  };
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-0 backdrop-blur-sm sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex h-dvh w-full max-w-2xl flex-col overflow-hidden bg-card shadow-2xl sm:h-auto sm:max-h-[94dvh] sm:rounded-2xl sm:border sm:border-border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-sale-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div className="min-w-0">
            <h2 id="cash-sale-detail-title" className="truncate text-lg font-black">
              Venda #{sale.sale_number}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {formatDate(sale.created_date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl hover:bg-muted"
            aria-label="Fechar venda"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <LoadingState label="Carregando venda..." />
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 rounded-xl bg-muted/30 p-3 sm:grid-cols-2">
                <Value label="Status" value={sale.status === "concluida" ? "Concluída" : "Cancelada"} />
                <Value label="Total" value={formatCurrency(totals.total)} />
                <Value label="Subtotal" value={formatCurrency(totals.subtotal)} />
                <Value label="Pagamento" value={(sale.payments || []).map((payment) => PAYMENT_LABELS[payment.method] || payment.method).join(", ") || "—"} />
              </div>
              <section>
                <h3 className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
                  Itens
                </h3>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {(sale.items || []).map((item, index) => {
                    const amount =
                      item.unit === "peso"
                        ? `${Number(item.weight || 0).toLocaleString("pt-BR")} kg`
                        : `${item.quantity || 0} un.`;
                    return (
                      <div
                        key={`${item.product_id || item.product_name}-${index}`}
                        className="flex items-center justify-between gap-3 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{item.product_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{amount}</p>
                        </div>
                        <span className="flex-none font-bold tabular-nums">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
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
  const open = value === "aberto";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${open ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}
    >
      {open ? "Em andamento" : "Fechado"}
    </span>
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

function CashFormulaRow({
  label,
  value,
  positive = false,
  negative = false,
  total = false,
  tone = "neutral",
}) {
  const sign = negative ? "- " : positive ? "+ " : "";
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-300"
      : tone === "negative"
        ? "text-red-600 dark:text-red-300"
        : "text-foreground";

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
        total ? "bg-muted/40 font-black" : "bg-muted/20"
      }`}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-sm tabular-nums ${total ? toneClass : ""}`}>
        {sign}
        {formatCurrency(Math.abs(Number(value || 0)))}
      </dd>
    </div>
  );
}

function ValueCard({ label, value, hint = null }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-black tabular-nums">{value}</dd>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
