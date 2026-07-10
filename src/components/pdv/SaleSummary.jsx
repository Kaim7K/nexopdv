import React from 'react';
import { CreditCard, Minimize2, Trash2, Tag, AlertTriangle, ShoppingCart } from 'lucide-react';
import { formatCurrency, calculateSaleTotals } from '@/lib/helpers';

const Kbd = ({ children }) => (
  <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-black/10 rounded">{children}</kbd>
);

export default function SaleSummary({ sale, onPaymentClick, onMinimizeClick, onDiscardClick, onDiscountChange, canDiscount, minimizedCount, maxMinimized }) {
  const { subtotal, discount, total, totalItems } = calculateSaleTotals(sale);
  const canMinimize = minimizedCount < maxMinimized;

  return (
    <div className="flex flex-col h-full border-t border-border bg-card">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Resumo da Venda</span>
        </div>
      </div>

      {/* Discount */}
      {canDiscount && (
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-muted/30">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Desconto:</span>
          <select
            value={sale.discount_type || 'valor'}
            onChange={(e) => onDiscountChange({ ...sale, discount_type: e.target.value })}
            className="text-xs bg-card border border-border rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="valor">R$</option>
            <option value="percentual">%</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={sale.discount_value || ''}
            onChange={(e) => onDiscountChange({ ...sale, discount_value: parseFloat(e.target.value) || 0 })}
            placeholder="0,00"
            className="w-20 px-2 py-1 text-xs text-right bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent tabular-nums"
          />
        </div>
      )}

      {/* Items + Subtotal */}
      <div className="px-5 py-3.5 space-y-1.5 flex-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Desconto</span>
            <span className="tabular-nums">- {formatCurrency(discount)}</span>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="px-5 py-4 border-t border-border bg-muted/20">
        <div className="flex items-end justify-between">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <span className="text-3xl font-bold text-foreground tabular-nums tracking-tight">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onDiscardClick}
            disabled={sale.items.length === 0}
            title="Descartar venda (F6)"
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl border border-border text-destructive hover:bg-destructive/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-[10px] font-mono opacity-60">F6</span>
          </button>
          <button
            onClick={onMinimizeClick}
            disabled={sale.items.length === 0 || !canMinimize}
            title={canMinimize ? 'Minimizar venda (F7)' : `Limite de ${maxMinimized} vendas minimizadas`}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
            <span className="text-[10px] font-mono opacity-60">F7</span>
          </button>
        </div>
        <button
          onClick={onPaymentClick}
          disabled={sale.items.length === 0}
          title="Pagamento (F1)"
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors shadow-sm"
        >
          <CreditCard className="w-5 h-5" />
          Pagamento
          <Kbd>F1</Kbd>
        </button>
      </div>

      {!canMinimize && (
        <div className="px-4 pb-3 -mt-1 text-xs text-orange-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Limite de {maxMinimized} vendas minimizadas atingido
        </div>
      )}
    </div>
  );
}