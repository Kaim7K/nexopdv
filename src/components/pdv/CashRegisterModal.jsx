import React, { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Clock3, LockKeyhole, X } from 'lucide-react';
import { formatCurrency, getPaymentLabel } from '@/lib/helpers';

export default function CashRegisterModal({ mode, cashState, processing, onClose, onOpen, onCloseCash }) {
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const summary = cashState?.summary || {};
  const paymentEntries = useMemo(() => Object.entries(summary.payments || {}), [summary.payments]);
  const isOpenMode = mode === 'open';

  const submit = event => {
    event.preventDefault();
    if (isOpenMode) onOpen(openingAmount);
    else onCloseCash(closingAmount);
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => event.target === event.currentTarget && !processing && onClose?.()}>
      <form onSubmit={submit} className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cash-modal-title">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-accent/10 text-accent">
              {isOpenMode ? <LockKeyhole className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="cash-modal-title" className="text-xl font-black">{isOpenMode ? 'Abrir caixa' : 'Fechar caixa'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{isOpenMode ? 'Informe o valor disponível antes da primeira venda.' : 'Confira o resumo antes de encerrar o turno.'}</p>
            </div>
          </div>
          {onClose && <button type="button" disabled={processing} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label="Fechar"><X className="h-5 w-5" /></button>}
        </div>

        <div className="p-5 sm:p-6">
          {isOpenMode ? (
            <label className="block text-sm font-bold">
              Valor inicial do caixa
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
                <input autoFocus required type="number" min="0" step="0.01" value={openingAmount} onChange={event => setOpeningAmount(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background pl-11 pr-3 text-lg font-bold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="0,00" />
              </div>
              <span className="mt-2 block text-xs font-normal text-muted-foreground">Use o valor real em dinheiro disponível para troco.</span>
            </label>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Valor inicial" value={formatCurrency(summary.opening_amount)} />
                <Metric label="Vendas" value={summary.sales_count || 0} />
                <Metric label="Faturamento" value={formatCurrency(summary.total)} />
                <Metric label="Em dinheiro" value={formatCurrency(summary.cash_sales)} />
              </div>

              <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dinheiro esperado no caixa</p><strong className="mt-1 block text-2xl font-black text-accent">{formatCurrency(summary.expected_cash)}</strong></div>
                  <CheckCircle2 className="h-8 w-8 text-accent" />
                </div>
              </div>

              <div className="rounded-2xl border border-border p-4">
                <h3 className="flex items-center gap-2 text-sm font-black"><Clock3 className="h-4 w-4 text-accent" /> Resumo por pagamento</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {paymentEntries.length ? paymentEntries.map(([method, amount]) => (
                    <div key={method} className="flex items-center justify-between rounded-xl bg-muted/35 px-3 py-2 text-sm"><span>{getPaymentLabel(method)}</span><strong>{formatCurrency(amount)}</strong></div>
                  )) : <p className="text-sm text-muted-foreground">Nenhuma venda registrada neste caixa.</p>}
                </div>
              </div>

              <label className="block text-sm font-bold">
                Dinheiro contado no fechamento <span className="font-normal text-muted-foreground">(opcional)</span>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
                  <input type="number" min="0" step="0.01" value={closingAmount} onChange={event => setClosingAmount(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background pl-11 pr-3 text-sm font-bold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder={Number(summary.expected_cash || 0).toFixed(2)} />
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:justify-end sm:p-6">
          {onClose && <button type="button" disabled={processing} onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50">Voltar</button>}
          <button type="submit" disabled={processing || (isOpenMode && openingAmount === '')} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50">
            {processing ? 'Processando...' : isOpenMode ? 'Abrir caixa e começar' : 'Confirmar fechamento'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-2xl border border-border bg-muted/20 p-3"><span className="block text-[11px] font-bold text-muted-foreground">{label}</span><strong className="mt-1 block text-base font-black tabular-nums">{value}</strong></div>;
}
