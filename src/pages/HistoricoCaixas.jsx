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

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};
const toStart = (value) => (value ? `${value}T00:00:00` : "");
const toExclusiveEnd = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};
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
    from: monthStart(),
    to: today(),
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
        from: toStart(filters.from),
        to: toExclusiveEnd(filters.to),
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
    <div className="page-shell space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <Banknote className="h-3.5 w-3.5" /> Operação financeira
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Histórico de caixas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aberturas, vendas, movimentações, conferência e fechamento por
            operador.
          </p>
        </div>
      </header>

      <section
        aria-label="Filtros do histórico"
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-6"
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
              from: monthStart(),
              to: today(),
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
      </section>

      {data.items.length > 0 && (
        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Resumo do período exibido"
        >
          <Metric
            label="Vendas na página"
            value={formatCurrency(totals.sales)}
            icon={ReceiptText}
          />
          <Metric
            label="Entradas"
            value={formatCurrency(totals.entries)}
            icon={PlusCircle}
            tone="text-emerald-600"
          />
          <Metric
            label="Retiradas"
            value={formatCurrency(totals.withdrawals)}
            icon={MinusCircle}
            tone="text-amber-600"
          />
          <Metric
            label="Diferenças"
            value={formatCurrency(totals.differences)}
            icon={Banknote}
            tone={
              Math.abs(totals.differences) > 0.009
                ? "text-red-600"
                : "text-emerald-600"
            }
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
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
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
          <div className="grid gap-3 lg:hidden">
            {data.items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"
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
        <header className="flex items-start justify-between border-b border-border p-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="cash-detail-title" className="text-xl font-black">
                Caixa de {session.seller_name}
              </h2>
              <Status value={session.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.unit_name || "Unidade principal"} · aberto em{" "}
              {formatDate(session.opened_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManageClosed && !editing && (
              <>
                <button
                  type="button"
                  onClick={reopenSession}
                  disabled={editingCash}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-500/5 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
                >
                  <PlusCircle className="h-4 w-4" />
                  {editingCash ? "Reabrindo..." : "Reabrir"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={editingCash}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-bold hover:bg-muted disabled:opacity-50"
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
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar detalhes"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {loading ? (
            <LoadingState label="Carregando movimentação completa..." />
          ) : (
            <>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ValueCard
                  label="Valor inicial"
                  value={formatCurrency(
                    summary.opening_amount ?? session.opening_amount,
                  )}
                />
                <ValueCard
                  label="Total de vendas"
                  value={formatCurrency(summary.total)}
                  hint={`${summary.sales_count || 0} venda(s)`}
                />
                <ValueCard
                  label="Esperado em dinheiro"
                  value={formatCurrency(summary.expected_cash)}
                />
                <ValueCard
                  label="Valor final"
                  value={formatCurrency(
                    session.closing_amount ?? summary.expected_cash,
                  )}
                  hint={
                    session.difference !== null &&
                    session.difference !== undefined
                      ? `Diferença: ${formatCurrency(session.difference)}`
                      : "Em andamento"
                  }
                />
              </dl>
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-black">Formas de pagamento</h3>
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
                <div className="grid gap-2 sm:grid-cols-3">
                  {Object.entries(summary.payments || {}).length ? (
                    Object.entries(summary.payments || {}).map(
                      ([method, value]) => (
                        <div
                          key={method}
                          className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3 text-sm"
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
                  className="grid gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:grid-cols-3"
                >
                  <Filter label="Valor inicial">
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
                  <Filter label="Valor final">
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
                  <Filter label="Despesa">
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
                  <div className="flex gap-2 sm:col-span-3 sm:justify-end">
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
              <section>
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
              <section>
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
function Metric({ label, value, icon: Icon, tone = "text-accent" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div
        className={`mb-3 grid h-9 w-9 place-items-center rounded-xl bg-muted ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-xl font-black tabular-nums">
        {value}
      </strong>
    </div>
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
function ValueCard({ label, value, hint = null }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-black tabular-nums">{value}</dd>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
