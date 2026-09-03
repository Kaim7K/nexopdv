import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  LogOut,
  LockKeyhole,
  TriangleAlert,
  ReceiptText,
  X,
} from "lucide-react";
import { PaymentIcon } from "@/components/common/visualTokens";
import {
  formatCurrency,
  formatCurrencyInput,
  getPaymentLabel,
  parseCurrencyDigits,
  roundCurrency,
} from "@/lib/helpers";
import { useModalBehavior } from "@/hooks/use-modal-behavior";

const brazilMinutesNow = () => {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === 'hour')?.value || 0) * 60
    + Number(parts.find((part) => part.type === 'minute')?.value || 0);
};

export default function CashRegisterModal({
  mode,
  cashState,
  processing,
  reporting = false,
  onClose,
  onContinue,
  onOpen,
  onCloseCash,
  onDownloadReport,
  onLogout,
  userRole,
}) {
  const modalRef = useModalBehavior({
    onClose,
    disabled: processing || reporting,
  });
  const [openingAmount, setOpeningAmount] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [closingEntry, setClosingEntry] = useState("");
  const [closingExpense, setClosingExpense] = useState("");
  const [clockTick, setClockTick] = useState(0);
  const summary = cashState?.summary || {};
  const paymentEntries = useMemo(
    () => Object.entries(summary.payments || {}),
    [summary.payments],
  );
  const isOpenMode = mode === "open";
  const isClosedMode = mode === "closed";
  const isClosingMode = !isOpenMode && !isClosedMode;
  const canSeeCashBalances = userRole !== 'vendedor';
  const closingTime = cashState?.closing_time || {};
  const minimumClosingMinutes = /^\d{2}:\d{2}$/.test(closingTime.minimum_time || '')
    ? Number(closingTime.minimum_time.slice(0, 2)) * 60 + Number(closingTime.minimum_time.slice(3, 5))
    : null;
  const closingTimeBlocked = isClosingMode && Boolean(closingTime.enabled) && (
    minimumClosingMinutes === null
      ? closingTime.can_close === false
      : brazilMinutesNow() < minimumClosingMinutes
  );
  useEffect(() => {
    if (!isClosingMode || !closingTime.enabled) return undefined;
    const interval = window.setInterval(() => setClockTick((value) => value + 1), 30_000);
    return () => window.clearInterval(interval);
  }, [closingTime.enabled, isClosingMode]);
  void clockTick;
  const expectedCash = useMemo(
    () =>
      roundCurrency(
        isClosingMode
          ? Number(summary.expected_cash || 0) +
              parseCurrencyDigits(closingEntry) -
              parseCurrencyDigits(closingExpense)
          : Number(summary.expected_cash || 0),
      ),
    [summary.expected_cash, closingEntry, closingExpense, isClosingMode],
  );
  const countedCash = isClosedMode
    ? Number(summary.closing_amount ?? expectedCash)
    : parseCurrencyDigits(closingAmount);
  const hasCountedCash = isClosedMode || closingAmount !== "";
  const difference = roundCurrency(countedCash - expectedCash);
  const isBalanced = hasCountedCash && Math.abs(difference) < 0.005;
  const closingStatus = !hasCountedCash
    ? "Aguardando contagem"
    : isBalanced
      ? "Sem diferença"
      : difference > 0
        ? `Sobra de ${formatCurrency(difference)}`
        : `Falta de ${formatCurrency(Math.abs(difference))}`;

  const submit = (event) => {
    event.preventDefault();
    if (isClosedMode) return onClose?.();
    if (isOpenMode) onOpen(parseCurrencyDigits(openingAmount));
    else
      onCloseCash({
        closingAmount: parseCurrencyDigits(closingAmount),
        closingEntry: parseCurrencyDigits(closingEntry),
        closingExpense: parseCurrencyDigits(closingExpense),
      });
  };

  return (
    <div
      className="modal-overlay cash-modal-overlay z-[70]"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !processing && onClose?.()
      }
    >
      <form
        ref={modalRef}
        onSubmit={submit}
        className={`modal-panel cash-mobile-modal ${isOpenMode ? "sm:max-w-[30rem]" : canSeeCashBalances ? "sm:max-w-[56rem]" : "sm:max-w-[34rem]"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-modal-title"
      >
        <div className="modal-header">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-accent/10 text-accent">
              {isOpenMode ? (
                <LockKeyhole className="h-5 w-5" />
              ) : (
                <Banknote className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 id="cash-modal-title" className="modal-title">
                {isOpenMode
                  ? "Abrir caixa"
                  : isClosedMode
                    ? "Caixa fechado"
                    : "Fechar caixa"}
              </h2>
              <p className="modal-subtitle">
                {isOpenMode
                  ? "Digite o troco inicial."
                  : isClosedMode
                    ? "Caixa encerrado e relatório pronto."
                    : "Confira o resumo antes de encerrar o turno."}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              disabled={processing}
              onClick={onClose}
              className="modal-icon-button cash-touch-target"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="modal-body cash-adaptive">
          {isOpenMode ? (
            <label className="block text-sm font-bold">
              Valor inicial do caixa
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  R$
                </span>
                <input
                  autoFocus
                  required
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInput(openingAmount)}
                  onChange={(event) =>
                    setOpeningAmount(event.target.value.replace(/\D/g, ""))
                  }
                  className="h-11 w-full rounded-lg border border-border bg-background pl-11 pr-3 text-base font-bold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  placeholder="0,00"
                />
              </div>
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                Valor em dinheiro disponível para troco.
              </span>
            </label>
          ) : (
            <div className="space-y-2.5">
              <div className={`cash-kpi-grid grid gap-px overflow-hidden rounded-xl bg-border/40 ${canSeeCashBalances ? '' : '!grid-cols-1'}`}>
                {canSeeCashBalances && (
                  <Metric
                    label="Valor inicial"
                    value={formatCurrency(summary.opening_amount)}
                  />
                )}
                <Metric label="Vendas" value={summary.sales_count || 0} />
                {canSeeCashBalances && (
                  <>
                    <Metric label="Total" value={formatCurrency(summary.total)} />
                    <Metric
                      label="Em dinheiro"
                      value={formatCurrency(summary.cash_sales)}
                    />
                  </>
                )}
              </div>

              <section className="overflow-hidden rounded-xl border border-accent/30 bg-accent/[0.045]">
                <div className="cash-reconcile-grid grid">
                  {canSeeCashBalances && (
                    <FinancialValue
                      label="Dinheiro esperado no caixa"
                      value={formatCurrency(expectedCash)}
                    />
                  )}
                  {isClosingMode ? (
                    <label className="cash-reconcile-segment p-[clamp(0.625rem,2cqi,0.75rem)]">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.045em] text-muted-foreground">
                        Dinheiro contado no fechamento
                      </span>
                      <div className="mt-1.5 flex h-11 min-w-0 items-center gap-2 border-b border-accent/25 focus-within:border-accent">
                        <span className="flex-none text-xl font-bold text-accent sm:text-2xl">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          autoFocus
                          value={formatCurrencyInput(closingAmount)}
                          onChange={(event) =>
                            setClosingAmount(
                              event.target.value.replace(/\D/g, ""),
                            )
                          }
                          className="cash-fluid-value h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-bold tabular-nums text-accent outline-none placeholder:text-muted-foreground/45 focus:ring-0"
                          placeholder="0,00"
                        />
                      </div>
                    </label>
                  ) : (
                    <FinancialValue
                      label="Dinheiro contado no fechamento"
                      value={formatCurrency(countedCash)}
                    />
                  )}
                  {canSeeCashBalances && <div
                    className={`cash-reconcile-segment p-[clamp(0.625rem,2cqi,0.75rem)] ${hasCountedCash && !isBalanced ? "bg-amber-500/[0.07]" : "bg-emerald-500/[0.07]"}`}
                  >
                    <span className="block text-[11px] font-bold uppercase tracking-[0.045em] text-muted-foreground">
                      Diferença
                    </span>
                    <strong
                      className={`mt-1 block text-xl font-bold tabular-nums sm:text-2xl ${hasCountedCash && !isBalanced ? "text-amber-700 dark:text-amber-300" : "text-accent"}`}
                    >
                      {hasCountedCash ? formatCurrency(difference) : "—"}
                    </strong>
                    <span
                      className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold ${hasCountedCash && !isBalanced ? "text-amber-700 dark:text-amber-300" : "text-accent"}`}
                    >
                      {hasCountedCash && isBalanced ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Clock3 className="h-4 w-4" />
                      )}
                      Status: {closingStatus}
                    </span>
                  </div>}
                </div>
                {canSeeCashBalances && <div className="cash-formula-grid grid gap-px border-t border-accent/15 bg-accent/10 text-xs">
                  <Formula
                    label="Valor inicial"
                    value={summary.opening_amount}
                  />
                  <Formula
                    label="Vendas em dinheiro"
                    value={summary.cash_sales}
                    positive
                  />
                  <Formula
                    label="Outras entradas"
                    value={summary.entries}
                    positive
                  />
                  <Formula
                    label="Retiradas"
                    value={summary.withdrawals}
                    negative
                  />
                  {isClosingMode && parseCurrencyDigits(closingEntry) > 0 && (
                    <Formula
                      label="Adicionado agora"
                      value={parseCurrencyDigits(closingEntry)}
                      positive
                    />
                  )}
                  {isClosingMode && parseCurrencyDigits(closingExpense) > 0 && (
                    <Formula
                      label="Despesa agora"
                      value={parseCurrencyDigits(closingExpense)}
                      negative
                    />
                  )}
                </div>}
              </section>

              <div
                className={`grid items-start gap-2.5 ${!isClosedMode && canSeeCashBalances ? "cash-support-grid" : ""}`}
              >
                {canSeeCashBalances && paymentEntries.length > 0 && (
                  <section className="cash-subcontainer rounded-lg bg-muted/20 p-2.5">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <ReceiptText className="h-4 w-4 text-accent" /> Resumo por
                      pagamento
                    </h3>
                    <div className="cash-subgrid mt-1.5 grid gap-px overflow-hidden rounded-lg bg-border/30">
                      {paymentEntries.map(([method, amount]) => (
                        <div
                          key={method}
                          className="flex items-center justify-between gap-3 bg-card px-3 py-2 text-sm"
                        >
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <PaymentIcon method={method} className="h-4 w-4" />
                            {getPaymentLabel(method)}
                          </span>
                          <strong className="tabular-nums">
                            {formatCurrency(amount)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {!isClosedMode && (
                  <section className="cash-subcontainer rounded-lg bg-muted/20 p-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-bold">
                        Ajustes do fechamento
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        Opcionais
                      </span>
                    </div>
                    <div className="cash-adjustment-grid mt-1.5 grid gap-2">
                      <MoneyField
                        label="Dinheiro adicionado agora"
                        hint="Soma ao esperado e identifica a entrada."
                        icon={Banknote}
                        value={closingEntry}
                        onChange={setClosingEntry}
                      />
                      <MoneyField
                        label="Dinheiro retirado para despesa"
                        hint="Reduz o caixa e cria a despesa no Financeiro."
                        icon={ReceiptText}
                        value={closingExpense}
                        onChange={setClosingExpense}
                      />
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-actions cash-modal-actions">
            {onClose && !isClosedMode && (
              <button
                type="button"
                disabled={processing || reporting}
                onClick={onClose}
                className="modal-button cash-touch-target border border-border hover:bg-muted"
              >
                Voltar
              </button>
            )}
            {(isOpenMode || isClosedMode) && onContinue && (
              <button
                type="button"
                disabled={processing || reporting}
                onClick={onContinue}
                className="modal-button cash-touch-target border border-border hover:bg-muted"
              >
                {isClosedMode ? "Continuar" : "Continuar sem caixa"}{" "}
                {isClosedMode ? (
                  <span className="sr-only">Continuar no sistema</span>
                ) : null}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {isClosedMode && onLogout && (
              <button
                type="button"
                disabled={processing || reporting}
                onClick={onLogout}
                className="modal-button cash-touch-target border border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            )}
            {!isOpenMode && canSeeCashBalances && onDownloadReport && (
              <button
                type="button"
                disabled={processing || reporting}
                onClick={onDownloadReport}
                className="modal-button cash-touch-target border border-accent text-accent hover:bg-accent/10"
              >
                <Download className="h-4 w-4" />{" "}
                {reporting ? "Gerando..." : "Relatório"}
              </button>
            )}
            {!isClosedMode && (
              <button
                type="submit"
                disabled={
                  processing ||
                  reporting ||
                  (isOpenMode && openingAmount === "") ||
                  (isClosingMode && (!hasCountedCash || closingTimeBlocked))
                }
                className="modal-button modal-actions-primary cash-touch-target bg-accent px-5 text-accent-foreground hover:bg-accent/90"
              >
                {processing
                  ? "Processando..."
                  : isOpenMode
                    ? "Abrir caixa"
                    : "Confirmar fechamento"}
              </button>
            )}
          </div>
          {closingTimeBlocked && (
            <div role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />
              <span>{closingTime.message || `O caixa só pode ser fechado a partir das ${closingTime.minimum_time}.`}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0 bg-card px-3 py-2.5">
      <span className="block text-[11px] font-bold text-muted-foreground">
        {label}
      </span>
      <strong className="mt-0.5 block truncate text-sm font-bold tabular-nums sm:text-base">
        {value}
      </strong>
    </div>
  );
}

function Formula({ label, value, positive = false, negative = false }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 bg-card/80 px-3 py-2">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <strong className="shrink-0 tabular-nums">
        {positive ? "+ " : negative ? "- " : ""}
        {formatCurrency(Math.abs(Number(value || 0)))}
      </strong>
    </div>
  );
}

function FinancialValue({ label, value }) {
  return (
    <div className="p-3">
      <span className="block text-[11px] font-bold uppercase tracking-[0.045em] text-muted-foreground">
        {label}
      </span>
      <strong className="cash-fluid-value mt-1 block font-bold tabular-nums text-accent">
        {value}
      </strong>
    </div>
  );
}

function MoneyField({ label, hint, icon: Icon, value, onChange }) {
  return (
    <label className="block min-w-0">
      <span className="cash-money-label block text-[11px] font-bold leading-4">
        {label}
      </span>
      <span className="sr-only">Campo opcional</span>
      <div className="relative mt-1">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
          R$
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={formatCurrencyInput(value)}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
          className="h-11 w-full rounded-lg border border-border/60 bg-background pl-16 pr-3 text-sm font-bold outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          placeholder="0,00"
        />
      </div>
      <span className="mt-1 block text-[10px] font-normal leading-3.5 text-muted-foreground">
        {hint}
      </span>
    </label>
  );
}
