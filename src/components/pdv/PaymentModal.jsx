import React, { useEffect, useRef, useState } from 'react';
import { Banknote, Check, Clock, CreditCard, Minimize2, QrCode, Trash2, Wallet, X } from 'lucide-react';
import { calculateSaleTotals, formatCurrency, getPaymentLabel, PAYMENT_METHODS } from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

const METHOD_ICONS = {
  dinheiro: Banknote,
  debito: CreditCard,
  credito: CreditCard,
  pix: QrCode,
  outros: Wallet,
  fiado: Clock,
};

export default function PaymentModal({ sale, onClose, onComplete, onMinimize, onDiscard }) {
  const [payments, setPayments] = useState(sale.payments || []);
  const [observation, setObservation] = useState(sale.observation || '');
  const [showFiadoForm, setShowFiadoForm] = useState((sale.payments || []).some(payment => payment.method === 'fiado'));
  const [fiadoData, setFiadoData] = useState(sale.fiado || { responsible_name: '', phone: '', observation: '' });
  const [focusIndex, setFocusIndex] = useState(null);
  const [completing, setCompleting] = useState(false);
  const amountRefs = useRef([]);
  const modalRef = useModalBehavior({ onClose, disabled: completing });

  const { subtotal, discount, total } = calculateSaleTotals(sale);
  const nonFiadoPayments = payments.filter(payment => payment.method !== 'fiado');
  const paidAmount = nonFiadoPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const remaining = total - paidAmount;
  const hasFiado = payments.some(payment => payment.method === 'fiado');
  const debtAmount = Math.max(0, remaining);
  const change = !hasFiado && remaining < 0 ? Math.abs(remaining) : 0;

  useEffect(() => {
    if (focusIndex === null) return;
    const input = amountRefs.current[focusIndex];
    if (input) {
      input.focus();
      input.select();
      setFocusIndex(null);
    }
  }, [payments, focusIndex]);

  const addPayment = method => {
    if (method === 'fiado') {
      setShowFiadoForm(true);
      setPayments(previous => previous.some(payment => payment.method === 'fiado')
        ? previous
        : [...previous, { method, amount: Math.max(0, remaining) }]);
      return;
    }
    if (remaining <= 0 && !hasFiado) return;
    const index = payments.length;
    setPayments(previous => [...previous, { method, amount: remaining > 0 ? remaining : 0 }]);
    setFocusIndex(index);
  };

  const updateAmount = (index, value) => {
    setPayments(previous => previous.map((payment, currentIndex) => currentIndex === index
      ? { ...payment, amount: Number.parseFloat(value) || 0 }
      : payment));
  };

  const removePayment = index => {
    const payment = payments[index];
    setPayments(previous => previous.filter((_, currentIndex) => currentIndex !== index));
    if (payment.method === 'fiado') setShowFiadoForm(false);
  };

  const completeOnce = async payload => {
    if (completing) return;
    setCompleting(true);
    try {
      await onComplete(payload);
    } finally {
      setCompleting(false);
    }
  };

  const normalizedPayments = () => payments.map(payment => payment.method === 'fiado'
    ? { ...payment, amount: debtAmount }
    : payment);

  const handleComplete = () => {
    if (hasFiado) {
      if (!fiadoData.responsible_name.trim()) {
        toast.error('Nome do responsável é obrigatório para venda fiado.');
        return;
      }
      if (remaining < -0.009) {
        toast.error('O valor recebido não pode ser maior que o total em uma venda fiada.');
        return;
      }
      if (debtAmount < 0.01) {
        toast.error('Não há saldo restante para registrar como fiado.');
        return;
      }
      completeOnce({ payments: normalizedPayments(), observation, sale_type: 'fiado', fiado: fiadoData });
      return;
    }
    if (remaining > 0.01) {
      toast.error(`Pagamento incompleto. Falta ${formatCurrency(remaining)}.`);
      return;
    }
    completeOnce({ payments, observation, sale_type: 'normal' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-5" role="presentation">
      <div ref={modalRef} tabIndex={-1} className="flex h-dvh w-full max-w-5xl flex-col overflow-hidden bg-card text-card-foreground sm:h-auto sm:max-h-[95dvh] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
          <div>
            <h2 id="payment-title" className="text-xl font-black">Forma de pagamento</h2>
            <p className="text-xs text-muted-foreground">Selecione a forma e digite o valor. O campo será ativado automaticamente.</p>
          </div>
          <button type="button" aria-label="Fechar" disabled={completing} onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-6 w-6" /></button>
        </div>

        <div className="grid flex-1 overscroll-contain overflow-y-auto lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-5 border-b border-border p-5 lg:border-b-0 lg:border-r lg:p-7">
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Resumo dos produtos</h3>
              <div className="space-y-2">
                {sale.items.map((item, index) => (
                  <div key={`${item.product_id}-${index}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm">
                    <span className="font-bold tabular-nums">{item.unit === 'peso' ? `${Number(item.weight || 0).toFixed(3)}kg` : `${item.quantity}x`}</span>
                    <span className="truncate">{item.product_name}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-background p-5">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Desconto</span><span className="font-semibold tabular-nums">{formatCurrency(discount)}</span></div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                <div className="flex items-end justify-between gap-4">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">Total</span>
                  <span className="text-4xl font-black tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">{formatCurrency(total)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground">Pago</span>
                  <p className="mt-1 text-xl font-black tabular-nums">{formatCurrency(paidAmount)}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground">{hasFiado ? 'Saldo fiado' : 'Restante'}</span>
                  <p className={`mt-1 text-xl font-black tabular-nums ${remaining > 0.01 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(Math.max(0, remaining))}</p>
                </div>
              </div>
              {change > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-3 text-emerald-700 dark:text-emerald-300">
                  <span className="font-bold">Troco</span>
                  <span className="text-2xl font-black tabular-nums">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-5 p-5 lg:p-7">
            {!hasFiado && (
              <div>
                <h3 className="mb-3 text-sm font-bold">Escolha a forma de pagamento</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {PAYMENT_METHODS.map(method => {
                    const Icon = METHOD_ICONS[method.method];
                    const disabled = method.method !== 'fiado' && remaining <= 0;
                    return (
                      <button key={method.method} type="button" onClick={() => addPayment(method.method)} disabled={disabled} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 border-border p-3 transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-35">
                        <Icon className="h-8 w-8 text-accent" />
                        <span className="text-sm font-bold">{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {payments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold">Valores informados</h3>
                {payments.map((payment, index) => (
                  <div key={`${payment.method}-${index}`} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                    <span className="w-24 truncate text-sm font-semibold sm:w-32">{getPaymentLabel(payment.method)}</span>
                    {payment.method === 'fiado' ? (
                      <span className="flex-1 text-right text-xl font-black text-orange-600 tabular-nums dark:text-orange-400">{formatCurrency(debtAmount)}</span>
                    ) : (
                      <label className="relative flex-1">
                        <span className="sr-only">Valor em {getPaymentLabel(payment.method)}</span>
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">R$</span>
                        <input
                          ref={element => { amountRefs.current[index] = element; }}
                          type="number"
                          step="0.01"
                          min="0"
                          value={payment.amount}
                          onChange={event => updateAmount(index, event.target.value)}
                          className="h-14 w-full rounded-xl border-2 border-border bg-card pl-10 pr-3 text-right text-2xl font-black tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                      </label>
                    )}
                    <button type="button" aria-label="Remover pagamento" onClick={() => removePayment(index)} className="grid h-11 w-11 place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-5 w-5" /></button>
                  </div>
                ))}
              </div>
            )}

            {showFiadoForm && (
              <div className="space-y-3 rounded-xl border border-orange-400/50 bg-orange-500/10 p-4">
                <div className="text-sm font-bold text-orange-700 dark:text-orange-300">Dados da venda fiado</div>
                <label className="block"><span className="sr-only">Nome do responsável</span><input type="text" autoComplete="name" placeholder="Nome do responsável *" value={fiadoData.responsible_name} onChange={event => setFiadoData({ ...fiadoData, responsible_name: event.target.value })} className="h-11 w-full rounded-lg border border-orange-400/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" /></label>
                <label className="block"><span className="sr-only">Telefone</span><input type="tel" autoComplete="tel" inputMode="tel" placeholder="Telefone (opcional)" value={fiadoData.phone} onChange={event => setFiadoData({ ...fiadoData, phone: event.target.value })} className="h-11 w-full rounded-lg border border-orange-400/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" /></label>
                <label className="block"><span className="sr-only">Observação do fiado</span><input type="text" placeholder="Observação (opcional)" value={fiadoData.observation} onChange={event => setFiadoData({ ...fiadoData, observation: event.target.value })} className="h-11 w-full rounded-lg border border-orange-400/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" /></label>
              </div>
            )}

            <label className="block"><span className="sr-only">Observação da venda</span><input type="text" placeholder="Observação da venda (opcional)" value={observation} onChange={event => setObservation(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" /></label>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:px-7 sm:py-4">
          <button type="button" onClick={onDiscard} disabled={completing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-destructive px-4 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="h-5 w-5" /> Descartar</button>
          <button type="button" onClick={() => onMinimize({ payments: normalizedPayments(), observation, sale_type: hasFiado ? 'fiado' : 'normal', fiado: hasFiado ? fiadoData : undefined })} disabled={completing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"><Minimize2 className="h-5 w-5" /> Minimizar</button>
          <button type="button" onClick={handleComplete} disabled={!payments.length || completing} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-black text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground"><Check className="h-6 w-6" /> {completing ? 'Concluindo...' : 'Concluir venda'}</button>
        </div>
      </div>
    </div>
  );
}
