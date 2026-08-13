import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  LogOut,
  LockKeyhole,
  ReceiptText,
  X,
} from 'lucide-react';
import {
  formatCurrency,
  formatCurrencyInput,
  getPaymentLabel,
  parseCurrencyDigits,
} from '@/lib/helpers';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

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
}) {
  const modalRef = useModalBehavior({ onClose, disabled: processing || reporting });
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingEntry, setClosingEntry] = useState('');
  const [closingExpense, setClosingExpense] = useState('');
  const summary = cashState?.summary || {};
  const paymentEntries = useMemo(
    () => Object.entries(summary.payments || {}),
    [summary.payments],
  );
  const isOpenMode = mode === 'open';
  const isClosedMode = mode === 'closed';
  const isClosingMode = !isOpenMode && !isClosedMode;
  const expectedCash = useMemo(
    () =>
      isClosingMode
        ? Number(summary.expected_cash || 0) +
          parseCurrencyDigits(closingEntry) -
          parseCurrencyDigits(closingExpense)
        : Number(summary.expected_cash || 0),
    [summary.expected_cash, closingEntry, closingExpense, isClosingMode],
  );
  const countedCash = parseCurrencyDigits(closingAmount);
  const hasCountedCash = closingAmount !== '';
  const difference = Math.round((countedCash - expectedCash) * 100) / 100;

  const submit = (event) => {
    event.preventDefault();
    if (isClosedMode) {
      onClose?.();
      return;
    }
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
      className="fixed inset-0 z-[70] grid items-end bg-slate-950/70 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !processing && onClose?.()
      }
    >
      <form
        ref={modalRef}
        onSubmit={submit}
        className="max-h-[96dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border/80 bg-card shadow-[0_-12px_42px_rgba(0,0,0,0.18)] sm:max-h-[92dvh] sm:rounded-xl sm:shadow-[0_18px_58px_rgba(0,0,0,0.24)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/80 bg-card p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
              {isOpenMode ? (
                <LockKeyhole className="h-5 w-5" />
              ) : (
                <Banknote className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 id="cash-modal-title" className="text-base font-black sm:text-lg">
                {isOpenMode
                  ? 'Abrir caixa'
                  : isClosedMode
                    ? 'Caixa fechado'
                    : 'Fechar caixa'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isOpenMode
                  ? 'Digite o troco inicial.'
                  : isClosedMode
                    ? 'Caixa encerrado e relatório pronto.'
                    : 'Confira o resumo antes de encerrar o turno.'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              disabled={processing}
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="bg-background/70 p-3 sm:p-4">
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
                    setOpeningAmount(event.target.value.replace(/\D/g, ''))
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Valor inicial" value={formatCurrency(summary.opening_amount)} />
                <Metric label="Vendas" value={summary.sales_count || 0} />
                <Metric label="Faturamento" value={formatCurrency(summary.total)} />
                <Metric label="Em dinheiro" value={formatCurrency(summary.cash_sales)} />
              </div>

              <div className="rounded-lg border border-accent/25 bg-accent/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Dinheiro esperado no caixa
                    </p>
                    <strong className="mt-1 block text-xl font-black text-accent sm:text-2xl">
                      {formatCurrency(expectedCash)}
                    </strong>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-accent" />
                </div>
                <div className="mt-3 grid gap-1.5 border-t border-accent/15 pt-3 text-xs sm:grid-cols-2">
                  <Formula label="Valor inicial" value={summary.opening_amount} />
                  <Formula label="Vendas em dinheiro" value={summary.cash_sales} positive />
                  <Formula label="Outras entradas" value={summary.entries} positive />
                  <Formula label="Retiradas" value={summary.withdrawals} negative />
                  {isClosingMode && parseCurrencyDigits(closingEntry) > 0 && (
                    <Formula label="Adicionado agora" value={parseCurrencyDigits(closingEntry)} positive />
                  )}
                  {isClosingMode && parseCurrencyDigits(closingExpense) > 0 && (
                    <Formula label="Despesa agora" value={parseCurrencyDigits(closingExpense)} negative />
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <h3 className="flex items-center gap-2 text-sm font-black">
                  <Clock3 className="h-4 w-4 text-accent" /> Resumo por pagamento
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {paymentEntries.length ? (
                    paymentEntries.map(([method, amount]) => (
                      <div
                        key={method}
                        className="flex items-center justify-between rounded-lg bg-muted/35 px-3 py-2 text-sm"
                      >
                        <span>{getPaymentLabel(method)}</span>
                        <strong>{formatCurrency(amount)}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma venda registrada neste caixa.
                    </p>
                  )}
                </div>
              </div>

              {!isClosedMode && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-bold sm:col-span-2">
                    Dinheiro adicionado agora{' '}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                    <div className="relative mt-2">
                      <Banknote className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatCurrencyInput(closingEntry)}
                        onChange={(event) =>
                          setClosingEntry(
                            event.target.value.replace(/\D/g, ''),
                          )
                        }
                        className="h-11 w-full rounded-xl border border-border bg-background pl-16 pr-3 text-sm font-bold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        placeholder="0,00"
                      />
                    </div>
                    <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                      Soma ao valor esperado e fica identificado no fechamento.
                    </span>
                  </label>
                  <label className="block text-sm font-bold sm:col-span-2">
                    Dinheiro retirado para despesa{' '}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                    <div className="relative mt-2">
                      <ReceiptText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatCurrencyInput(closingExpense)}
                        onChange={(event) =>
                          setClosingExpense(
                            event.target.value.replace(/\D/g, ''),
                          )
                        }
                        className="h-11 w-full rounded-xl border border-border bg-background pl-16 pr-3 text-sm font-bold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        placeholder="0,00"
                      />
                    </div>
                    <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                      Reduz o caixa e cria uma despesa vinculada no Financeiro.
                    </span>
                  </label>
                  <label className="block text-sm font-bold sm:col-span-2">
                    Dinheiro contado no fechamento
                    <div className="relative mt-2">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        autoFocus
                        value={formatCurrencyInput(closingAmount)}
                        onChange={(event) =>
                          setClosingAmount(event.target.value.replace(/\D/g, ''))
                        }
                        className="h-11 w-full rounded-xl border border-border bg-background pl-11 pr-3 text-sm font-bold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        placeholder={formatCurrency(expectedCash)}
                      />
                    </div>
                  </label>
                  {hasCountedCash && (
                    <div className={`rounded-xl border px-3 py-2.5 text-sm sm:col-span-2 ${Math.abs(difference) < 0.005 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200'}`}>
                      <strong className="block">
                        {Math.abs(difference) < 0.005
                          ? 'Contagem conferida'
                          : difference > 0
                            ? `Sobra de ${formatCurrency(difference)}`
                            : `Falta de ${formatCurrency(Math.abs(difference))}`}
                      </strong>
                      <span className="mt-0.5 block text-xs opacity-80">
                        Comparação com o valor esperado.
                      </span>
                    </div>
                  )}
                </div>
              )}
              {isClosedMode && (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
                  Fechamento concluído. O relatório do caixa está pronto.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-card p-3 sm:flex-row sm:justify-end sm:p-4">
          {onClose && (
            <button
              type="button"
              disabled={processing || reporting}
              onClick={onClose}
              className="min-h-10 rounded-lg border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"
            >
              Voltar
            </button>
          )}
          {(isOpenMode || isClosedMode) && onContinue && (
            <button
              type="button"
              disabled={processing || reporting}
              onClick={onContinue}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"
            >
              {isClosedMode ? 'Continuar no sistema' : 'Continuar sem caixa'}{' '}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {isClosedMode && onLogout && (
            <button
              type="button"
              disabled={processing || reporting}
              onClick={onLogout}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-destructive/40 px-4 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          )}
          {!isOpenMode && onDownloadReport && (
            <button
              type="button"
              disabled={processing || reporting}
              onClick={onDownloadReport}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-accent px-4 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />{' '}
              {reporting ? 'Gerando relatório...' : 'Baixar relatório'}
            </button>
          )}
          <button
            type="submit"
            disabled={processing || reporting || (isOpenMode && openingAmount === '') || (isClosingMode && !hasCountedCash)}
            className="min-h-10 rounded-lg bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing
              ? 'Processando...'
              : isOpenMode
                ? 'Abrir caixa'
                : isClosedMode
                  ? 'Concluir'
                  : 'Confirmar fechamento'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <span className="block text-[11px] font-bold text-muted-foreground">
        {label}
      </span>
      <strong className="mt-1 block text-base font-black tabular-nums">
        {value}
      </strong>
    </div>
  );
}

function Formula({ label, value, positive = false, negative = false }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-card/70 px-2.5 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <strong className="tabular-nums">
        {positive ? '+ ' : negative ? '- ' : ''}
        {formatCurrency(Math.abs(Number(value || 0)))}
      </strong>
    </div>
  );
}
