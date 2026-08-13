import React, { useEffect, useRef, useState } from 'react';
import {
  Banknote,
  CalendarClock,
  Check,
  CreditCard,
  Minimize2,
  QrCode,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { calculateSaleTotals, formatCurrency, getPaymentLabel, PAYMENT_METHODS, roundCurrency } from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import { useModalBehavior } from '@/hooks/use-modal-behavior';
import { PAYMENT_VISUALS } from '@/components/common/visualTokens';

const DebitCardIcon = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path d="M6.5 10.5h4" />
    <path d="M6.5 13.5h2.5" />
    <path d="m14.5 13.2 1.8 1.8 3.2-4" />
  </svg>
);

const METHOD_ICONS = {
  dinheiro: Banknote,
  debito: DebitCardIcon,
  credito: CreditCard,
  pix: QrCode,
  outros: Wallet,
  fiado: CalendarClock,
};

const METHOD_STYLES = Object.fromEntries(
  Object.entries(PAYMENT_VISUALS).map(([method, visual]) => [method, visual.badge]),
);

const METHOD_SHORT_LABELS = {
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'Pix',
  outros: 'Outros',
  fiado: 'Fiado',
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
  const paidAmount = roundCurrency(
    nonFiadoPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    ),
  );
  const remaining = roundCurrency(total - paidAmount);
  const hasFiado = payments.some(payment => payment.method === 'fiado');
  const debtAmount = roundCurrency(Math.max(0, remaining));
  const change = !hasFiado && remaining < 0 ? roundCurrency(Math.abs(remaining)) : 0;

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
        : [...previous, { method, amount: roundCurrency(Math.max(0, remaining)) }]);
      return;
    }
    if (remaining <= 0 && !hasFiado) return;
    const index = payments.length;
    setPayments(previous => [...previous, { method, amount: remaining > 0 ? roundCurrency(remaining) : 0 }]);
    setFocusIndex(index);
  };

  const updateAmount = (index, value) => {
    setPayments(previous => previous.map((payment, currentIndex) => currentIndex === index
      ? { ...payment, amount: roundCurrency(Number.parseFloat(value) || 0) }
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
    : { ...payment, amount: roundCurrency(payment.amount) });

  const handleComplete = () => {
    if (nonFiadoPayments.some(payment => Number(payment.amount || 0) <= 0)) {
      toast.error('Informe um valor maior que zero ou remova essa forma de pagamento.');
      return;
    }
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
    completeOnce({ payments: normalizedPayments(), observation, sale_type: 'normal' });
  };

  return (
    <div className="modal-overlay bg-slate-950/75" role="presentation">
      <div ref={modalRef} tabIndex={-1} className="modal-panel sm:max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <div className="modal-header">
          <div>
            <h2 id="payment-title" className="modal-title">Forma de pagamento</h2>
            <p className="modal-subtitle hidden sm:block">Confira o total e escolha como o cliente vai pagar.</p>
          </div>
          <button type="button" aria-label="Fechar" disabled={completing} onClick={onClose} className="modal-icon-button"><X className="h-5 w-5" /></button>
        </div>

        <div className="modal-body space-y-3 bg-card sm:p-3.5">
          <section className="overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-500/[0.055]">
            <div className="grid items-stretch sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex items-center justify-between gap-4 p-3 sm:px-4 sm:py-3.5">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-300">Total da venda</span>
                  <strong className="mt-0.5 block text-[1.75rem] font-black leading-none tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400 sm:text-3xl">{formatCurrency(total)}</strong>
                  <span className="mt-1 block text-[11px] text-muted-foreground">Subtotal {formatCurrency(subtotal)}{discount > 0 ? ` · desconto ${formatCurrency(discount)}` : ''}</span>
                </div>
                {change > 0 && <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-right text-emerald-700 dark:text-emerald-300"><span className="block text-[10px] font-bold uppercase">Troco</span><strong className="text-lg tabular-nums">{formatCurrency(change)}</strong></div>}
              </div>
              <div className="grid grid-cols-2 border-t border-emerald-500/20 bg-card/55 sm:min-w-56 sm:border-l sm:border-t-0">
                <div className="flex flex-col justify-center px-3 py-2.5 sm:px-4"><span className="text-[11px] text-muted-foreground">Pago</span><strong className="mt-0.5 text-base tabular-nums">{formatCurrency(paidAmount)}</strong></div>
                <div className="flex flex-col justify-center border-l border-emerald-500/20 px-3 py-2.5 text-right sm:px-4"><span className="text-[11px] text-muted-foreground">{hasFiado ? 'A fiar' : 'Restante'}</span><strong className={`mt-0.5 text-base tabular-nums ${remaining > 0.01 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(Math.max(0, remaining))}</strong></div>
              </div>
            </div>
            <details className="group border-t border-emerald-500/20 bg-card/45">
              <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-bold text-muted-foreground marker:hidden hover:bg-muted/40 sm:px-4">
                <span>{sale.items.length} {sale.items.length === 1 ? 'produto na venda' : 'produtos na venda'}</span>
                <span className="group-open:hidden">Ver produtos</span><span className="hidden group-open:inline">Ocultar</span>
              </summary>
              <div className="max-h-32 divide-y divide-border overflow-y-auto border-t border-border px-3 sm:px-4">
                {sale.items.map((item, index) => (
                  <div key={`${item.product_id}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs sm:text-sm">
                    <span className="font-black tabular-nums">{item.unit === 'peso' ? `${Number(item.weight || 0).toFixed(2)}kg` : `${item.quantity}x`}</span>
                    <span className="truncate text-foreground/80">{item.product_name}</span>
                    <span className="font-bold tabular-nums">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </details>
          </section>

          <section className="space-y-3">
            {!hasFiado && (
              <div>
                <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <h3 className="text-sm font-black">Como o cliente vai pagar?</h3>
                  <span className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
                    {payments.length > 0
                      ? 'Para dividir, ajuste o valor informado e escolha outra forma'
                      : 'O restante é preenchido automaticamente'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PAYMENT_METHODS.map(method => {
                    const Icon = METHOD_ICONS[method.method];
                    const disabled = remaining <= 0;
                    return (
                      <button key={method.method} type="button" onClick={() => addPayment(method.method)} disabled={disabled} className={`group flex min-h-10 items-center gap-2 rounded-lg border px-2.5 text-left transition hover:-translate-y-px hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 sm:min-h-11 ${METHOD_STYLES[method.method] || 'border-border text-accent'}`}>
                        <span className="grid h-7 w-7 flex-none place-items-center rounded-md bg-white/65 dark:bg-black/15"><Icon className="h-4 w-4" /></span>
                        <span className="truncate text-xs font-black sm:text-sm">{METHOD_SHORT_LABELS[method.method] || method.label}</span>
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
                  <div key={`${payment.method}-${index}`} className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 p-2 sm:gap-3">
                    <span className="w-20 truncate text-xs font-bold sm:w-28 sm:text-sm">{METHOD_SHORT_LABELS[payment.method] || getPaymentLabel(payment.method)}</span>
                    {payment.method === 'fiado' ? (
                      <span className="flex-1 text-right text-lg font-black text-orange-600 tabular-nums dark:text-orange-400 sm:text-xl">{formatCurrency(debtAmount)}</span>
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
                          className="h-10 w-full appearance-none rounded-lg border border-border bg-card pl-10 pr-3 text-right text-base font-black tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:h-11 sm:text-lg [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </label>
                    )}
                    <button type="button" aria-label="Remover pagamento" onClick={() => removePayment(index)} className="grid h-9 w-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10 sm:h-10 sm:w-10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}

            {showFiadoForm && (
              <div className="space-y-2 rounded-xl border border-orange-400/50 bg-orange-500/10 p-3 sm:p-4">
                <div className="text-sm font-bold text-orange-700 dark:text-orange-300">Dados da venda fiado</div>
                <label className="block"><span className="sr-only">Nome do responsável</span><input type="text" autoComplete="name" placeholder="Nome do responsável *" value={fiadoData.responsible_name} onChange={event => setFiadoData({ ...fiadoData, responsible_name: event.target.value })} className="h-10 w-full rounded-lg border border-orange-400/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent sm:h-11" /></label>
                <label className="block"><span className="sr-only">Telefone</span><input type="tel" autoComplete="tel" inputMode="tel" placeholder="Telefone (opcional)" value={fiadoData.phone} onChange={event => setFiadoData({ ...fiadoData, phone: event.target.value })} className="h-10 w-full rounded-lg border border-orange-400/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent sm:h-11" /></label>
                <label className="block"><span className="sr-only">Observação do fiado</span><input type="text" placeholder="Observação (opcional)" value={fiadoData.observation} onChange={event => setFiadoData({ ...fiadoData, observation: event.target.value })} className="h-10 w-full rounded-lg border border-orange-400/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent sm:h-11" /></label>
              </div>
            )}

            <label className="block"><span className="sr-only">Observação da venda</span><input type="text" placeholder="Observação da venda (opcional)" value={observation} onChange={event => setObservation(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" /></label>
          </section>
        </div>

        <div className="modal-footer">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button type="button" onClick={onDiscard} disabled={completing} className="modal-button border border-transparent text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /> Descartar</button>
            <button type="button" onClick={() => onMinimize({ payments: normalizedPayments(), observation, sale_type: hasFiado ? 'fiado' : 'normal', fiado: hasFiado ? fiadoData : undefined })} disabled={completing} className="modal-button border border-border bg-background hover:bg-muted"><Minimize2 className="h-4 w-4" /> Minimizar</button>
            <button type="button" onClick={handleComplete} disabled={!payments.length || completing} className="modal-button col-span-2 bg-accent px-5 text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground sm:ml-auto"><Check className="h-5 w-5" /> {completing ? 'Concluindo...' : 'Concluir venda'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
