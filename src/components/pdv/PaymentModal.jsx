import React, { useState } from 'react';
import { X, Banknote, CreditCard, QrCode, Wallet, Clock, Trash2, Minimize2, Check } from 'lucide-react';
import { formatCurrency, calculateSaleTotals, PAYMENT_METHODS } from '@/lib/helpers';
import { toast } from 'react-hot-toast';

const METHOD_ICONS = {
  dinheiro: Banknote, debito: CreditCard, credito: CreditCard, pix: QrCode, outros: Wallet, fiado: Clock,
};

export default function PaymentModal({ sale, onClose, onComplete, onMinimize, onDiscard }) {
  const [payments, setPayments] = useState(sale.payments || []);
  const [observation, setObservation] = useState(sale.observation || '');
  const [showFiadoForm, setShowFiadoForm] = useState(false);
  const [fiadoData, setFiadoData] = useState({ responsible_name: '', phone: '', observation: '' });

  const { subtotal, discount, total } = calculateSaleTotals(sale);
  const nonFiadoPayments = payments.filter(p => p.method !== 'fiado');
  const paidAmount = nonFiadoPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = total - paidAmount;
  const change = remaining < 0 ? Math.abs(remaining) : 0;
  const hasFiado = payments.some(p => p.method === 'fiado');

  const addPayment = (method) => {
    if (method === 'fiado') {
      setShowFiadoForm(true);
      setPayments(prev => prev.some(p => p.method === 'fiado') ? prev : [...prev, { method, amount: total }]);
      return;
    }
    if (remaining <= 0 && !hasFiado) return;
    setPayments(prev => [...prev, { method, amount: remaining > 0 ? remaining : 0 }]);
  };

  const updateAmount = (idx, val) => {
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, amount: parseFloat(val) || 0 } : p));
  };

  const removePayment = (idx) => {
    const pm = payments[idx];
    setPayments(prev => prev.filter((_, i) => i !== idx));
    if (pm.method === 'fiado') setShowFiadoForm(false);
  };

  const handleComplete = () => {
    if (hasFiado) {
      if (!fiadoData.responsible_name.trim()) {
        toast.error('Nome do responsável é obrigatório para venda fiado.');
        return;
      }
      onComplete({ payments, observation, sale_type: 'fiado', fiado: fiadoData });
    } else {
      if (remaining > 0.01) {
        toast.error('Pagamento incompleto. Falta ' + formatCurrency(remaining));
        return;
      }
      onComplete({ payments, observation, sale_type: 'normal' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Pagamento</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Compact items list */}
          <div className="bg-secondary/50 rounded-lg p-3 max-h-32 overflow-y-auto">
            {sale.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-0.5">
                <span className="truncate flex-1 pr-2">{item.quantity || item.weight}x {item.product_name}</span>
                <span className="font-medium">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>{formatCurrency(discount)}</span></div>
            <div className="flex justify-between font-bold text-base col-span-2 border-t pt-2"><span>Total</span><span className="text-accent">{formatCurrency(total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pago</span><span>{formatCurrency(paidAmount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Restante</span><span className={remaining > 0.01 ? 'text-destructive font-medium' : ''}>{formatCurrency(Math.max(0, remaining))}</span></div>
            {change > 0 && <div className="flex justify-between font-bold text-green-600 col-span-2"><span>Troco</span><span>{formatCurrency(change)}</span></div>}
          </div>

          {/* Payment methods */}
          {!hasFiado && (
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(pm => {
                const Icon = METHOD_ICONS[pm.method];
                const disabled = pm.method !== 'fiado' && remaining <= 0;
                return (
                  <button key={pm.method} onClick={() => addPayment(pm.method)} disabled={disabled}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${disabled ? 'border-border opacity-40' : 'border-border hover:border-accent hover:bg-accent/5'}`}>
                    <Icon className="w-6 h-6 text-accent" />
                    <span className="text-xs font-medium">{pm.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active payments */}
          {payments.length > 0 && (
            <div className="space-y-2">
              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-sm w-32 truncate">{PAYMENT_METHODS.find(m => m.method === p.method)?.label}</span>
                  {p.method === 'fiado' ? (
                    <span className="flex-1 text-sm text-orange-600 font-medium">Valor: {formatCurrency(p.amount)}</span>
                  ) : (
                    <>
                      <span className="text-muted-foreground">R$</span>
                      <input type="number" step="0.01" min="0" value={p.amount}
                        onChange={(e) => updateAmount(idx, e.target.value)}
                        className="flex-1 px-2 py-1 border border-border rounded text-right focus:outline-none focus:ring-1 focus:ring-accent" />
                    </>
                  )}
                  <button onClick={() => removePayment(idx)} className="text-destructive hover:bg-destructive/10 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Fiado form */}
          {showFiadoForm && (
            <div className="border border-orange-300 bg-orange-50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium text-orange-800">Dados da Venda Fiado</div>
              <input type="text" placeholder="Nome do responsável *"
                value={fiadoData.responsible_name}
                onChange={(e) => setFiadoData({ ...fiadoData, responsible_name: e.target.value })}
                className="w-full px-3 py-2 border border-orange-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
              <input type="text" placeholder="Telefone (opcional)"
                value={fiadoData.phone}
                onChange={(e) => setFiadoData({ ...fiadoData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-orange-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
              <input type="text" placeholder="Observação (opcional)"
                value={fiadoData.observation}
                onChange={(e) => setFiadoData({ ...fiadoData, observation: e.target.value })}
                className="w-full px-3 py-2 border border-orange-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
          )}

          {/* Observation */}
          <input type="text" placeholder="Observação da venda (opcional)"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 px-6 py-4 border-t">
          <button onClick={onDiscard} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 text-sm font-medium">
            <Trash2 className="w-4 h-4" /> Descartar
          </button>
          <button onClick={onMinimize} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-secondary hover:bg-muted text-sm font-medium">
            <Minimize2 className="w-4 h-4" /> Minimizar
          </button>
          <button onClick={handleComplete} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-sm font-bold">
            <Check className="w-4 h-4" /> Concluir Venda
          </button>
        </div>
      </div>
    </div>
  );
}