import { useEffect, useState } from "react";
import {
  Banknote,
  MinusCircle,
  PlusCircle,
  ReceiptText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { nexoApi } from "@/api/nexoApi";
import { LoadingState } from "@/components/common/PageState";
import {
  PaymentBadge,
  PaymentIcon,
  StatusBadge,
} from "@/components/common/visualTokens";
import { SaleDetailModal } from "@/components/sales/SaleHistory";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { useModalBehavior } from "@/hooks/use-modal-behavior";
import { useCashDetailModel } from "@/features/cash-history/hooks/use-cash-detail-model";
import CashRegisterModal from "@/components/pdv/CashRegisterModal";
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyDigits,
} from "@/lib/helpers";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

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

export default function CashDetail({
  data,
  loading,
  currentUser,
  onClose,
  onChanged,
}) {
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
  const [closingCash, setClosingCash] = useState(false);
  const confirmDialog = useConfirm();
  const modalRef = useModalBehavior({ onClose, disabled: saving || deleting });
  const {
    canMove,
    canCloseAny,
    canDelete,
    canManageClosed,
    paymentEntries,
    linkedSales,
    openingAmount,
    totalSales,
    cashReceived,
    movementEntries,
    movementWithdrawals,
    closingExpense,
    closingEntry,
    expectedAfterExpense,
    declaredCash,
    valueWithoutCashDrawer,
    cashDifference,
    cashMovements,
    hasDifference,
    differenceLabel,
    differenceTone,
    differenceSummary,
  } = useCashDetailModel({
    session,
    summary,
    currentUser,
    salePaymentFilter,
  });
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
          Math.round(
            Number(session.closing_entry || summary.closing_entry || 0) * 100,
          ),
        ),
      ),
      closing_expense: formatCurrencyInput(
        String(
          Math.round(
            Number(session.closing_expense || summary.closing_expense || 0) *
              100,
          ),
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
  const closeSession = async ({
    closingAmount,
    closingExpense,
    closingEntry,
  }) => {
    if (editingCash) return;
    setEditingCash(true);
    try {
      await nexoApi.cash.close(
        closingAmount,
        closingExpense,
        closingEntry,
        session.id,
      );
      toast.success(`Caixa de ${session.seller_name} fechado.`);
      setClosingCash(false);
      await onChanged();
    } catch (cause) {
      toast.error(cause.message || "Não foi possível fechar este caixa.");
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
    <div className="modal-overlay cash-modal-overlay" role="presentation">
      <section
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-detail-title"
        className="cash-adaptive cash-mobile-modal flex h-dvh w-full max-w-6xl flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[min(48rem,calc(100dvh-2rem))] sm:rounded-2xl sm:border sm:border-border/60 sm:shadow-[0_22px_70px_rgba(0,0,0,0.32)]"
      >
        <header className="relative flex flex-col gap-2 border-b border-border/80 bg-muted/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5 pr-12 sm:pr-0">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <Banknote className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="cash-detail-title"
                  className="cash-fluid-title break-words font-bold"
                >
                  Caixa de {session.seller_name}
                </h2>
                <Status value={session.status} />
              </div>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">
                {session.unit_name || "Unidade principal"} · aberto em{" "}
                {formatDate(session.opened_at)}
              </p>
            </div>
          </div>
          <div className="cash-header-actions grid w-full items-center gap-1.5 sm:flex sm:w-auto sm:flex-none sm:pr-12">
            {canCloseAny && (
              <button
                type="button"
                onClick={() => setClosingCash(true)}
                disabled={editingCash}
                className="cash-touch-target inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-3 text-xs font-bold text-accent-foreground disabled:opacity-50"
              >
                <Banknote className="h-4 w-4" />
                Fechar caixa
              </button>
            )}
            {canManageClosed && !editing && (
              <>
                <button
                  type="button"
                  onClick={reopenSession}
                  disabled={editingCash}
                  className="cash-touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-500/5 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
                >
                  <PlusCircle className="h-4 w-4" />
                  {editingCash ? "Reabrindo..." : "Reabrir"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={editingCash}
                  className="cash-touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-bold hover:bg-muted disabled:opacity-50"
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
                className="cash-touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar detalhes"
              onClick={onClose}
              className="cash-touch-target absolute right-2 top-2 grid place-items-center rounded-xl hover:bg-muted sm:right-3 sm:top-3"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="cash-modal-scroll flex-1 space-y-[clamp(0.5rem,2cqi,0.75rem)] overflow-y-auto overflow-x-hidden bg-card p-[clamp(0.5rem,2cqi,0.75rem)]">
          {loading ? (
            <LoadingState label="Carregando movimentação completa..." />
          ) : currentUser.role === "vendedor" ? (
            <section className="rounded-xl border border-border bg-muted/20 p-5 text-center">
              <ReceiptText className="mx-auto h-7 w-7 text-accent" />
              <h3 className="mt-2 font-bold">Resumo do caixa</h3>
              <strong className="mt-3 block text-3xl font-black tabular-nums text-accent">
                {summary.sales_count || 0}
              </strong>
              <p className="mt-1 text-sm text-muted-foreground">
                venda(s) registrada(s). Os valores financeiros são restritos à gerência.
              </p>
            </section>
          ) : (
            <>
              <section className="rounded-lg bg-muted/20 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold">Resumo do caixa</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Valores principais para conferência.
                    </p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                    {summary.sales_count || 0} venda(s)
                  </span>
                </div>
                <dl className="cash-detail-summary-grid grid gap-1.5">
                  <ValueCard
                    label="Total vendido"
                    value={formatCurrency(totalSales)}
                    hint="vendas"
                    primary
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

              <section className="overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-500/[0.035]">
                <div className="px-3 pt-3">
                  <h3 className="font-bold">Conferência do dinheiro</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Compare contado, esperado e diferença.
                  </p>
                </div>
                <div className="cash-detail-conference-grid mx-3 mt-2 grid gap-px overflow-hidden rounded-lg bg-emerald-500/15 text-xs">
                  <div className="bg-card px-3 py-2.5">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                      Esperado
                    </span>
                    <strong className="cash-fluid-value mt-0.5 block font-bold tabular-nums">
                      {formatCurrency(expectedAfterExpense)}
                    </strong>
                  </div>
                  <div className="bg-card px-3 py-2.5">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                      Contado
                    </span>
                    <strong className="cash-fluid-value mt-0.5 block font-bold tabular-nums">
                      {formatCurrency(declaredCash)}
                    </strong>
                  </div>
                  <div className="bg-card px-3 py-2.5">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                      Diferença
                    </span>
                    <strong
                      className={`cash-fluid-value mt-0.5 block font-bold tabular-nums ${differenceTone}`}
                    >
                      {formatCurrency(cashDifference)}
                    </strong>
                  </div>
                  <div className="bg-emerald-500/[0.08] px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Resultado
                    </p>
                    <strong
                      className={`mt-0.5 block text-base font-bold tabular-nums ${differenceTone}`}
                    >
                      {differenceLabel}
                    </strong>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                      {differenceSummary}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 border-t border-emerald-500/15 bg-card/65 p-3">
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                    Cálculo completo
                  </div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    Cálculo esperado
                  </div>
                  <dl className="cash-detail-calculation-grid mt-1 grid gap-px overflow-hidden rounded-lg bg-border/25 text-sm">
                    <CashFormulaRow
                      label="Valor inicial"
                      value={openingAmount}
                    />
                    <CashFormulaRow
                      label="Recebido em dinheiro"
                      value={cashReceived}
                      positive
                    />
                    <CashFormulaRow
                      label="Outras entradas"
                      value={movementEntries}
                      positive
                    />
                    <CashFormulaRow
                      label="Retiradas"
                      value={movementWithdrawals}
                      negative
                    />
                    <CashFormulaRow
                      label="Entrada no fechamento"
                      value={closingEntry}
                      positive
                    />
                    <CashFormulaRow
                      label="Despesa no fechamento"
                      value={closingExpense}
                      negative
                    />
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
                  <div className="mt-2 text-[10px] font-bold uppercase text-muted-foreground">
                    Fechamento informado
                  </div>
                  <dl className="cash-detail-closing-grid mt-1 grid gap-px overflow-hidden rounded-lg bg-border/25 text-sm">
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
                    <p className="flex items-center bg-card px-3 py-2 text-xs text-muted-foreground">
                      {session.status === "fechado"
                        ? "Diferença entre esperado e contado."
                        : "A conferência final aparece ao fechar."}
                    </p>
                  </dl>
                </div>
              </section>

              <section className="rounded-lg bg-muted/15 p-2.5">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold">Vendas deste caixa</h3>
                    <p className="text-xs text-muted-foreground">
                      {linkedSales.length} de {summary.sales?.length || 0}{" "}
                      venda(s)
                    </p>
                  </div>
                  <label className="cash-sales-filter relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={salePaymentFilter}
                      onChange={(event) =>
                        setSalePaymentFilter(event.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                      aria-label="Filtrar vendas por pagamento"
                    >
                      {PAYMENT_FILTERS.map((payment) => (
                        <option
                          key={payment.method || "todos"}
                          value={payment.method}
                        >
                          {payment.method
                            ? payment.label
                            : "Todos os pagamentos"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {summary.sales?.length ? (
                  linkedSales.length ? (
                    <div className="cash-subgrid grid gap-1.5">
                      {linkedSales.map((sale) => (
                        <LinkedSaleButton
                          key={sale.id}
                          sale={sale}
                          onClick={() => openSaleDetail(sale)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/50 px-3 py-2.5 text-sm text-muted-foreground">
                      Nenhuma venda encontrada para este pagamento.
                    </div>
                  )
                ) : (
                  <div className="rounded-lg border border-dashed border-border/50 px-3 py-2.5 text-sm text-muted-foreground">
                    Nenhuma venda vinculada a este caixa.
                  </div>
                )}
              </section>

              <div className="grid items-start gap-3">
                <div className="cash-detail-operations-grid grid items-start gap-3">
                  <section className="cash-subcontainer rounded-lg bg-muted/15 p-2.5">
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-bold">Pagamentos</h3>
                      {canMove && (
                        <button
                          type="button"
                          onClick={() => setMovementOpen((v) => !v)}
                          className="cash-touch-target inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-bold text-accent-foreground"
                        >
                          <PlusCircle className="h-4 w-4" /> Movimentar caixa
                        </button>
                      )}
                    </div>
                    <div className="cash-subgrid grid gap-1.5">
                      {paymentEntries.length ? (
                        paymentEntries.map(([method, value]) => (
                          <div
                            key={method}
                            className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-2 text-sm"
                          >
                            <span className="inline-flex items-center gap-2">
                              <PaymentIcon
                                method={method}
                                className="h-4 w-4 text-muted-foreground"
                              />
                              {PAYMENT_LABELS[method] || method}
                            </span>
                            <strong>{formatCurrency(value)}</strong>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Nenhum pagamento registrado.
                        </p>
                      )}
                    </div>
                  </section>
                  <section className="cash-subcontainer rounded-lg bg-muted/15 p-2.5">
                    <div className="mb-2">
                      <h3 className="font-bold">Movimentações manuais</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Entradas, retiradas e ajustes fora das vendas.
                      </p>
                    </div>
                    {cashMovements.length ? (
                      <div className="divide-y divide-border/40 rounded-lg bg-card">
                        {cashMovements.map((item) => {
                          const reversed = ["estornado", "cancelado"].includes(
                            item.status,
                          );
                          return (
                            <div
                              key={item.id}
                              className={`cash-movement-row grid items-start gap-2.5 px-2.5 py-2.5 ${reversed ? "opacity-55" : ""}`}
                            >
                              <span
                                className={`mt-0.5 grid h-8 w-8 place-items-center rounded-lg ${item.type === "entrada" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}
                              >
                                {item.type === "entrada" ? (
                                  <PlusCircle className="h-4 w-4" />
                                ) : (
                                  <MinusCircle className="h-4 w-4" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <strong className="text-sm">
                                    {item.title}
                                  </strong>
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                                    {reversed
                                      ? "Estornado"
                                      : movementOriginLabel(item.origin)}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {item.note}
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {formatDate(item.date)} · {item.operator}
                                </p>
                              </div>
                              <strong
                                className={`cash-movement-amount pt-1 text-sm tabular-nums ${item.type === "entrada" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
                              >
                                {item.type === "entrada" ? "+ " : "- "}
                                {formatCurrency(item.amount)}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                        Nenhuma entrada, retirada ou ajuste além das vendas.
                      </div>
                    )}
                  </section>
                  {editing && canManageClosed && (
                    <form
                      onSubmit={saveEdit}
                      className="cash-operation-form rounded-xl border border-accent/30 bg-accent/5 p-[clamp(0.625rem,2cqi,1rem)]"
                    >
                      <div className="mb-3">
                        <h3 className="font-bold">Ajustar conferência</h3>
                        <p className="text-xs text-muted-foreground">
                          Edite apenas os valores físicos usados no fechamento
                          do caixa.
                        </p>
                      </div>
                      <div className="cash-detail-calculation-grid grid gap-2.5">
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
                      className="cash-operation-form cash-movement-form grid gap-2.5 rounded-xl border border-accent/30 bg-accent/5 p-[clamp(0.625rem,2cqi,1rem)]"
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
                            setMovement((v) => ({
                              ...v,
                              amount: e.target.value,
                            }))
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
                        className="cash-movement-submit min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50"
                      >
                        {saving ? "Registrando..." : "Confirmar movimentação"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {selectedSale && (
          <SaleDetailModal
            sale={selectedSale}
            loading={selectedSaleLoading || selectedSale._loading}
            onClose={() => setSelectedSale(null)}
          />
        )}
        {closingCash && (
          <CashRegisterModal
            mode="close"
            cashState={{
              session,
              summary,
              closing_time: { enabled: false, can_close: true },
            }}
            processing={editingCash}
            onClose={() => setClosingCash(false)}
            onContinue={undefined}
            onOpen={undefined}
            onCloseCash={closeSession}
            onDownloadReport={undefined}
            onLogout={undefined}
            userRole={currentUser.role}
          />
        )}
      </section>
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
        total ? "bg-card font-bold" : "bg-card/80"
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

function ValueCard({ label, value, hint = null, primary = false }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-card px-3 py-2 ${primary ? "ring-1 ring-emerald-500/20" : ""}`}
    >
      <dt className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-0.5 font-bold tabular-nums ${primary ? "text-lg text-accent sm:text-xl" : "text-base sm:text-lg"}`}
      >
        {value}
      </dd>
      {hint ? (
        <p className="text-[10px] leading-3.5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function LinkedSaleButton({ sale, onClick }) {
  const payments = sale.payments || [];
  return (
    <button
      type="button"
      onClick={onClick}
      className="cash-touch-target grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-card px-2.5 py-2 text-left text-sm transition hover:bg-accent/5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <strong className="truncate leading-tight">
            #{sale.sale_number}
          </strong>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
            {sale.status}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          <span className="truncate">{formatDate(sale.created_date)}</span>
          <SalePaymentSummary payments={payments} />
        </div>
      </div>
      <strong className="text-sm font-bold tabular-nums">
        {formatCurrency(sale.total)}
      </strong>
    </button>
  );
}

function SalePaymentSummary({ payments }) {
  if (!payments.length) return <span>Sem pagamento</span>;
  return (
    <>
      {payments.map((payment, index) => (
        <PaymentBadge
          key={`${payment.method}-${index}`}
          method={payment.method}
          compact
          className="max-w-36"
        />
      ))}
    </>
  );
}

function movementOriginLabel(origin) {
  return (
    {
      manual: "Manual",
      financeiro: "Financeiro",
      compra: "Compra",
      fiado: "Fiado",
      fechamento: "Fechamento",
    }[origin] || "Movimentação"
  );
}
