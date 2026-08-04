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
  CalendarClock,
  CreditCard,
  Eye,
  FilterX,
  MinusCircle,
  PlusCircle,
  QrCode,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
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

const PAYMENT_FILTERS = [
  { method: "", label: "Todos" },
  { method: "dinheiro", label: "Dinheiro" },
  { method: "pix", label: "Pix" },
  { method: "debito", label: "Débito" },
  { method: "credito", label: "Crédito" },
  { method: "fiado", label: "Fiado" },
  { method: "outros", label: "Outros" },
];

const PAYMENT_ICONS = {
  dinheiro: Banknote,
  pix: QrCode,
  debito: CreditCard,
  credito: CreditCard,
  fiado: CalendarClock,
  outros: Wallet,
};
const roundDisplayMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

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
        description="Consulte o que entrou, o valor contado e quem abriu ou fechou cada caixa."
      />

      <FilterPanel aria-label="Filtros do histórico">
        <div className="grid gap-1.5 sm:hidden">
          <div className="grid grid-cols-2 gap-2">
            <Filter label="De">
              <input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} className="field" />
            </Filter>
            <Filter label="At?">
              <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter("to", e.target.value)} className="field" />
            </Filter>
          </div>
          <details className="group mobile-secondary-panel">
            <summary className="mobile-secondary-summary">
              <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Filtros avançados</span>
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
          <Filter label="At?"><input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter("to", e.target.value)} className="field" /></Filter>
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
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-4"
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
                  <dl className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-1.5 text-xs">
                    <Value label="Vendas" value={formatCurrency(item.total_sales)} />
                    <Value label="Final" value={formatCurrency(item.final_amount)} />
                    <Value label="Inicial" value={formatCurrency(item.opening_amount)} />
                  </dl>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-muted-foreground">
                      Entradas {formatCurrency(item.entries)} · Retiradas {formatCurrency(item.withdrawals)}
                    </span>
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

function CashDetail({ data, loading, currentUser, onClose, onChanged }) {
  const { session, summary = {} } = data;
  const [movementOpen, setMovementOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedSaleLoading, setSelectedSaleLoading] = useState(false);
  const [salePaymentFilter, setSalePaymentFilter] = useState("");
  const [movement, setMovement] = useState({
    type: "entrada",
    amount: "",
    note: "",
  });
  const [editForm, setEditForm] = useState({
    opening_amount: "",
    closing_amount: "",
    closing_entry: "",
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
  const paymentEntries = Object.entries(summary.payments || {}).filter(
    ([, amount]) => Math.abs(Number(amount || 0)) >= 0.005,
  );
  const linkedSales = useMemo(
    () =>
      (summary.sales || []).filter(
        (sale) =>
          !salePaymentFilter ||
          (sale.payments || []).some(
            (payment) => payment.method === salePaymentFilter,
          ),
      ),
    [summary.sales, salePaymentFilter],
  );
  const openingAmount = Number(summary.opening_amount ?? session.opening_amount ?? 0);
  const totalSales = Number(summary.total || 0);
  const cashReceived = Number(
    summary.payments?.dinheiro ?? summary.cash_sales ?? 0,
  );
  const movementEntries = Number(summary.entries || 0);
  const movementWithdrawals = Number(summary.withdrawals || 0);
  const closingExpense = Number(
    session.closing_expense ?? summary.closing_expense ?? 0,
  );
  const closingEntry = Number(
    session.closing_entry ?? summary.closing_entry ?? 0,
  );
  const summaryClosingEntry = Number(summary.closing_entry || 0);
  const summaryClosingExpense = Number(summary.closing_expense || 0);
  const hasStoredClosingSummary =
    summary.expected_cash_before_expense !== undefined ||
    summary.closing_entry !== undefined ||
    summary.closing_expense !== undefined;
  const expectedBeforeExpense = Number(
    summary.expected_cash_before_expense ??
      (hasStoredClosingSummary
        ? Number(summary.expected_cash || 0) -
          summaryClosingEntry +
          summaryClosingExpense
        : Number(summary.expected_cash || 0)),
  );
  const expectedAfterExpense = roundDisplayMoney(
    expectedBeforeExpense + closingEntry - closingExpense,
  );
  const declaredCash = Number(session.closing_amount ?? expectedAfterExpense);
  const valueWithoutCashDrawer = roundDisplayMoney(
    declaredCash - openingAmount + closingEntry,
  );
  const cashDifference = declaredCash - expectedAfterExpense;
  const cashMovements = useMemo(() => {
    const items = (summary.movements || []).map((item) => ({
      id: item.id,
      type: item.type,
      amount: Number(item.amount || 0),
      title:
        item.origin === "compra"
          ? `Compra #${item.purchase_number || "sem número"}`
          : item.origin === "fiado"
            ? `Recebimento do fiado #${item.sale_number || "sem número"}`
            : item.note || (item.type === "entrada" ? "Entrada no caixa" : "Retirada do caixa"),
      note: item.note || "Sem observação",
      origin: item.origin || "manual",
      operator: item.operator_name || session.seller_name || "Não informado",
      date: item.created_at || item.created_date,
      status: item.status || "ativo",
    }));
    if (closingEntry > 0)
      items.push({
        id: "closing-entry",
        type: "entrada",
        amount: closingEntry,
        title: "Dinheiro adicionado no fechamento",
        note: "Ajuste informado ao encerrar o caixa",
        origin: "fechamento",
        operator: session.seller_name || "Não informado",
        date: session.closed_at || session.updated_date,
        status: "ativo",
      });
    if (closingExpense > 0)
      items.push({
        id: "closing-expense",
        type: "retirada",
        amount: closingExpense,
        title: "Despesa do fechamento",
        note: "Vinculada automaticamente ao Financeiro",
        origin: "fechamento",
        operator: session.seller_name || "Não informado",
        date: session.closed_at || session.updated_date,
        status: "ativo",
      });
    return items.sort(
      (left, right) =>
        new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime(),
    );
  }, [summary.movements, closingEntry, closingExpense, session]);
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
    setSalePaymentFilter("");
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
      closing_entry: formatCurrencyInput(
        String(
          Math.round(Number(session.closing_entry || summary.closing_entry || 0) * 100),
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
    session.closing_entry,
    session.closing_expense,
    session.status,
    summary.expected_cash,
    summary.closing_expense,
    summary.closing_entry,
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
        "A exclusão só será permitida se não houver nenhuma venda vinculada. Movimentações e auditorias financeiras não serão deixadas sem origem.",
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
        "O caixa voltará a ficar aberto. A despesa vinculada ao fechamento será estornada no Financeiro até que um novo fechamento seja confirmado.",
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
        closing_entry: parseCurrencyDigits(editForm.closing_entry),
        closing_expense: parseCurrencyDigits(editForm.closing_expense),
      });
      toast.success("Caixa atualizado e despesa de fechamento sincronizada.");
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
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-0 backdrop-blur-[2px] sm:p-4"
      role="presentation"
    >
      <section
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-detail-title"
        className="flex h-dvh w-full max-w-6xl flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[94dvh] sm:rounded-[20px] sm:border sm:border-border/80 sm:shadow-[0_28px_90px_rgba(0,0,0,0.35)]"
      >
        <header className="relative flex flex-col gap-3 border-b border-border/80 bg-muted/15 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex min-w-0 items-center gap-3 pr-11 sm:pr-0">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <Banknote className="h-5 w-5" />
            </span>
            <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="cash-detail-title" className="truncate text-base font-black sm:text-lg">
                Caixa de {session.seller_name}
              </h2>
              <Status value={session.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {session.unit_name || "Unidade principal"} · aberto em{" "}
              {formatDate(session.opened_at)}
            </p>
            </div>
          </div>
          <div className="grid w-full grid-cols-3 items-center gap-2 sm:flex sm:w-auto sm:flex-none sm:pr-11">
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
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl hover:bg-muted sm:right-4 sm:top-4"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 space-y-2.5 overflow-y-auto bg-muted/10 p-2.5 sm:space-y-3 sm:p-4">
          {loading ? (
            <LoadingState label="Carregando movimentação completa..." />
          ) : (
            <>
              <section className="rounded-xl border border-border/80 bg-card p-2.5 sm:p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-black">Visão rápida</h3>
                    <p className="text-xs text-muted-foreground">
                      Resultado principal do caixa.
                    </p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-black text-accent">
                    {summary.sales_count || 0} venda(s)
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <ValueCard
                    label="Total vendido"
                    value={formatCurrency(totalSales)}
                    hint="vendas"
                  />
                  <ValueCard
                    label="Dinheiro"
                    value={formatCurrency(cashReceived)}
                    hint="conferir"
                  />
                  <ValueCard
                    label="Outras formas"
                    value={formatCurrency(totalSales - cashReceived)}
                    hint="pix/cartão"
                  />
                  <ValueCard
                    label="Valor sem caixa"
                    value={formatCurrency(valueWithoutCashDrawer)}
                    hint="líquido"
                  />
                </dl>
              </section>

              <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-2.5 sm:p-4">
                <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                  <div>
                    <h3 className="font-black">Conferência do dinheiro</h3>
                    <p className="text-xs text-muted-foreground">
                      Compare contado, esperado e diferença.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 shadow-sm shadow-black/[0.025]">
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
                <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-card p-2 text-center text-xs sm:gap-2">
                  <div className="rounded-lg bg-muted/25 px-2 py-2">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">Esperado</span>
                    <strong className="mt-0.5 block text-sm tabular-nums">{formatCurrency(expectedAfterExpense)}</strong>
                  </div>
                  <div className="rounded-lg bg-muted/25 px-2 py-2">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">Contado</span>
                    <strong className="mt-0.5 block text-sm tabular-nums">{formatCurrency(declaredCash)}</strong>
                  </div>
                  <div className="rounded-lg bg-muted/25 px-2 py-2">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">Diferença</span>
                    <strong className={`mt-0.5 block text-sm tabular-nums ${differenceTone}`}>{formatCurrency(cashDifference)}</strong>
                  </div>
                </div>
                <details className="group mt-2 rounded-xl border border-border bg-card">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-black marker:hidden">
                    Ver cálculo completo
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground transition group-open:rotate-90" />
                  </summary>
                  <div className="grid gap-2 border-t border-border p-2.5 lg:grid-cols-2">
                  <dl className="grid gap-1.5 rounded-xl border border-border bg-background p-2.5 text-sm">
                    <div className="px-3 pb-1 text-xs font-black uppercase text-muted-foreground">
                      Cálculo esperado
                    </div>
                    <CashFormulaRow label="Valor inicial" value={openingAmount} />
                    <CashFormulaRow label="Recebido em dinheiro" value={cashReceived} positive />
                    <CashFormulaRow label="Outras entradas" value={movementEntries} positive />
                    <CashFormulaRow label="Retiradas" value={movementWithdrawals} negative />
                    <CashFormulaRow label="Entrada no fechamento" value={closingEntry} positive />
                    <CashFormulaRow label="Despesa no fechamento" value={closingExpense} negative />
                    <CashFormulaRow
                      label="Esperado no caixa"
                      value={expectedAfterExpense}
                      total
                    />
                    <CashFormulaRow
                      label="Valor sem caixa"
                      value={valueWithoutCashDrawer}
                      total
                    />
                  </dl>
                  <dl className="grid gap-1.5 rounded-xl border border-border bg-background p-2.5 text-sm">
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
                        ? "Diferença entre esperado e contado."
                        : "A conferência final aparece ao fechar."}
                    </p>
                  </dl>
                  </div>
                </details>
              </section>

              <section className="rounded-xl border border-border/80 bg-card p-2.5 sm:p-3">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black">Vendas deste caixa</h3>
                    <p className="text-xs text-muted-foreground">
                      {linkedSales.length} de {summary.sales?.length || 0} venda(s)
                    </p>
                  </div>
                  <label className="relative block sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={salePaymentFilter}
                      onChange={(event) => setSalePaymentFilter(event.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                      aria-label="Filtrar vendas por pagamento"
                    >
                      {PAYMENT_FILTERS.map((payment) => (
                        <option key={payment.method || "todos"} value={payment.method}>
                          {payment.method ? payment.label : "Todos os pagamentos"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {summary.sales?.length ? (
                  linkedSales.length ? (
                    <div className="grid max-h-[42dvh] gap-1.5 overflow-y-auto pr-1 sm:max-h-96 md:grid-cols-2">
                      {linkedSales.map((sale) => (
                        <LinkedSaleButton
                          key={sale.id}
                          sale={sale}
                          onClick={() => openSaleDetail(sale)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                      Nenhuma venda encontrada para este pagamento.
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                    Nenhuma venda vinculada a este caixa.
                  </div>
                )}
              </section>

              <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <div className="space-y-3">
              <section className="rounded-xl border border-border/80 bg-card p-2.5 sm:p-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-black">Pagamentos</h3>
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
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {paymentEntries.length ? (
                    paymentEntries.map(
                      ([method, value]) => (
                        <div
                          key={method}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-sm"
                        >
                          <span className="inline-flex items-center gap-2">
                            <PaymentIcon method={method} className="h-4 w-4 text-muted-foreground" />
                            {PAYMENT_LABELS[method] || method}
                          </span>
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
              <section className="rounded-xl border border-border/80 bg-card p-2.5 sm:p-3">
                <div className="mb-3">
                  <h3 className="font-black">Movimentações manuais</h3>
                  <p className="text-xs text-muted-foreground">
                    Entradas, retiradas e ajustes fora das vendas.
                  </p>
                </div>
                {cashMovements.length ? (
                  <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                    {cashMovements.map((item) => {
                      const reversed = ["estornado", "cancelado"].includes(item.status);
                      return (
                        <div
                          key={item.id}
                          className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5 ${reversed ? "opacity-55" : ""}`}
                        >
                          <span className={`mt-0.5 grid h-8 w-8 place-items-center rounded-lg ${item.type === "entrada" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
                            {item.type === "entrada" ? (
                              <PlusCircle className="h-4 w-4" />
                            ) : (
                              <MinusCircle className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <strong className="text-sm">{item.title}</strong>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                                {reversed ? "Estornado" : movementOriginLabel(item.origin)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {formatDate(item.date)} · {item.operator}
                            </p>
                          </div>
                          <strong className={`pt-1 text-sm tabular-nums ${item.type === "entrada" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                            {item.type === "entrada" ? "+ " : "- "}
                            {formatCurrency(item.amount)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    Nenhuma entrada, retirada ou ajuste além das vendas.
                  </div>
                )}
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
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    <Filter label="Entrada no fechamento">
                      <input
                        className="field"
                        type="text"
                        inputMode="numeric"
                        value={editForm.closing_entry}
                        onChange={(e) =>
                          setEditForm((current) => ({
                            ...current,
                            closing_entry: formatCurrencyInput(
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
                </div>
              <section className="hidden rounded-xl border border-border/80 bg-card p-3 xl:sticky xl:top-0">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black">Vendas vinculadas</h3>
                    <p className="text-xs text-muted-foreground">
                      {linkedSales.length} de {summary.sales?.length || 0} venda(s)
                    </p>
                  </div>
                  <label className="relative block sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={salePaymentFilter}
                      onChange={(event) => setSalePaymentFilter(event.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                      aria-label="Filtrar vendas por pagamento"
                    >
                      {PAYMENT_FILTERS.map((payment) => (
                        <option key={payment.method || "todos"} value={payment.method}>
                          {payment.method ? `Pagamento: ${payment.label}` : "Todos os pagamentos"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {summary.sales?.length ? (
                  linkedSales.length ? (
                    <div className="grid max-h-96 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                      {linkedSales.map((sale) => (
                        <LinkedSaleButton
                          key={sale.id}
                          sale={sale}
                          onClick={() => openSaleDetail(sale)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                      Nenhuma venda encontrada para este pagamento.
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                    Nenhuma venda vinculada a este caixa.
                  </div>
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

function LinkedSaleButton({ sale, onClick }) {
  const payments = sale.payments || [];
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left text-sm transition hover:border-accent/40 hover:bg-accent/5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <strong className="truncate leading-tight">#{sale.sale_number}</strong>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
            {sale.status}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          <span className="truncate">{formatDate(sale.created_date)}</span>
          <SalePaymentSummary payments={payments} />
        </div>
      </div>
      <strong className="text-sm font-black tabular-nums">{formatCurrency(sale.total)}</strong>
    </button>
  );
}

function SalePaymentSummary({ payments }) {
  if (!payments.length) return <span>Sem pagamento</span>;
  return (
    <>
      {payments.slice(0, 3).map((payment, index) => (
        <span
          key={`${payment.method}-${index}`}
          className="inline-flex max-w-36 items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
          title={PAYMENT_LABELS[payment.method] || payment.method}
        >
          <PaymentIcon method={payment.method} className="h-3 w-3 flex-none" />
          <span className="truncate">
            {PAYMENT_LABELS[payment.method] || payment.method}
          </span>
        </span>
      ))}
      {payments.length > 3 && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          +{payments.length - 3}
        </span>
      )}
    </>
  );
}

function PaymentIcon({ method, className }) {
  const Icon = PAYMENT_ICONS[method] || Wallet;
  return <Icon className={className} aria-hidden="true" />;
}

function movementOriginLabel(origin) {
  return {
    manual: "Manual",
    financeiro: "Financeiro",
    compra: "Compra",
    fiado: "Fiado",
    fechamento: "Fechamento",
  }[origin] || "Movimentação";
}

function CashSaleDetailModal({ sale, loading, onClose }) {
  const modalRef = useModalBehavior({ onClose });
  const { summary = {} } = sale;
  const payments = sale.payments || [];
  const totals = {
    subtotal: Number(sale.subtotal ?? (sale.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0)),
    total: Number(sale.total ?? summary.total ?? 0),
  };
  const discount = Math.max(0, totals.subtotal - totals.total);
  const received = payments
    .filter((payment) => payment.method !== "fiado")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const change = Number(sale.change_amount || Math.max(0, received - totals.total));
  return (
    <div
      className="fixed inset-0 z-[60] grid items-end bg-slate-950/75 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[20px] border border-border/80 bg-card shadow-[0_-20px_70px_rgba(0,0,0,0.3)] sm:max-h-[92dvh] sm:rounded-[20px] sm:shadow-[0_28px_90px_rgba(0,0,0,0.38)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-sale-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/80 bg-muted/15 p-4">
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
        <div className="flex-1 overflow-y-auto bg-muted/10 p-4 sm:p-5">
          {loading ? (
            <LoadingState label="Carregando venda..." />
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 rounded-xl bg-muted/30 p-3 sm:grid-cols-2">
                <Value label="Status" value={sale.status === "concluida" ? "Concluída" : "Cancelada"} />
                <Value label="Responsável" value={sale.seller_name || "Não informado"} />
                <Value label="Subtotal" value={formatCurrency(totals.subtotal)} />
                <Value label="Desconto" value={formatCurrency(discount)} />
                <Value label="Total da venda" value={formatCurrency(totals.total)} />
                <Value label="Valor recebido" value={formatCurrency(received)} />
                {change > 0 && <Value label="Troco devolvido" value={formatCurrency(change)} />}
              </div>
              <section>
                <h3 className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
                  Pagamentos
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {payments.length ? payments.map((payment, index) => (
                    <div key={`${payment.method}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <PaymentIcon method={payment.method} className="h-4 w-4 text-muted-foreground" />
                        {PAYMENT_LABELS[payment.method] || payment.method}
                      </span>
                      <strong className="tabular-nums">{formatCurrency(payment.amount)}</strong>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">Nenhum pagamento informado.</p>
                  )}
                </div>
              </section>
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
    <div className="relative overflow-hidden rounded-lg border border-border/80 bg-background px-3 py-2.5 pl-4">
      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-emerald-500" />
      <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-black tabular-nums sm:text-lg">{value}</dd>
      {hint && <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{hint}</p>}
    </div>
  );
}
