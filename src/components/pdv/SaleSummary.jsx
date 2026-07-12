import React from 'react';
import { AlertTriangle, CreditCard, Minimize2, ShoppingCart, Tag, Trash2 } from 'lucide-react';
import { calculateSaleTotals, formatCurrency } from '@/lib/helpers';
import SaleItemsList from './SaleItemsList';

const Kbd = ({ children }) => (
  <kbd className="rounded-md border border-current/20 bg-black/10 px-2 py-1 font-mono text-xs font-bold leading-none">{children}</kbd>
);

export default function SaleSummary({
  sale,
  onPaymentClick,
  onMinimizeClick,
  onDiscardClick,
  onDiscountChange,
  onUpdateQuantity,
  onUpdateWeight,
  onUpdatePrice,
  onRemoveItem,
  canDiscount,
  minimizedCount,
  maxMinimized,
}) {
  const { subtotal, discount, total, totalItems } = calculateSaleTotals(sale);
  const canMinimize = minimizedCount < maxMinimized;

  return (
    <div className="flex h-full flex-col border-t border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-accent" />
          <span className="text-sm font-bold">Produtos da venda</span>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
      </div>

      {canDiscount && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-5 py-2.5">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Desconto</span>
          <select value={sale.discount_type || 'valor'} onChange={event => onDiscountChange({ ...sale, discount_type: event.target.value })} className="h-9 rounded-lg border border-border bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="valor">R$</option>
            <option value="percentual">%</option>
          </select>
          <input type="number" min="0" step="0.01" value={sale.discount_value || ''} onChange={event => onDiscountChange({ ...sale, discount_value: Number.parseFloat(event.target.value) || 0 })} placeholder="0,00" className="h-9 w-28 rounded-lg border border-border bg-card px-3 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
      )}

      <SaleItemsList items={sale.items} onUpdateQuantity={onUpdateQuantity} onUpdateWeight={onUpdateWeight} onUpdatePrice={onUpdatePrice} onRemoveItem={onRemoveItem} />

      <div className="border-t border-border bg-muted/20 px-5 py-4">
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Desconto</span>
            <span className="tabular-nums">- {formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex items-end justify-between gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Total da venda</span>
          <span className="text-3xl font-black tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400 sm:text-4xl">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="space-y-2 p-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onDiscardClick} disabled={!sale.items.length} title="Descartar venda (F6)" className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border text-destructive transition-colors hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-30">
            <Trash2 className="h-5 w-5" />
            <span className="text-sm font-semibold">Descartar</span>
            <Kbd>F6</Kbd>
          </button>
          <button onClick={onMinimizeClick} disabled={!sale.items.length || !canMinimize} title={canMinimize ? 'Minimizar venda (F7)' : `Limite de ${maxMinimized} vendas minimizadas`} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30">
            <Minimize2 className="h-5 w-5" />
            <span className="text-sm font-semibold">Minimizar</span>
            <Kbd>F7</Kbd>
          </button>
        </div>
        <button onClick={onPaymentClick} disabled={!sale.items.length} title="Pagamento (F1)" className="flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-accent px-4 text-base font-black text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-30">
          <CreditCard className="h-6 w-6" /> Pagamento <Kbd>F1</Kbd>
        </button>
      </div>

      {!canMinimize && (
        <div className="-mt-1 flex items-center gap-1 px-4 pb-3 text-xs text-orange-600 dark:text-orange-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Limite de {maxMinimized} vendas minimizadas atingido
        </div>
      )}
    </div>
  );
}
