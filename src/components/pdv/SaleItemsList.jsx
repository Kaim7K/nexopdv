import React from 'react';
import { Minus, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';

export default function SaleItemsList({ items, onUpdateQuantity, onUpdateWeight, onUpdatePrice, onRemoveItem }) {
  if (!items.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-muted-foreground">
        <Package className="mb-3 h-12 w-12 text-muted-foreground/20" />
        <p className="text-sm font-semibold">Nenhum produto adicionado</p>
        <p className="mt-1 text-xs">Busque ou escaneie produtos para iniciar a venda.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 hidden grid-cols-[118px_minmax(150px,1fr)_110px_105px_40px] gap-3 border-b border-border bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
        <span>Quantidade</span>
        <span>Produto</span>
        <span className="text-right">Valor unitário</span>
        <span className="text-right">Subtotal</span>
        <span />
      </div>

      {items.map((item, index) => (
        <div key={`${item.product_id}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/30 lg:grid-cols-[118px_minmax(150px,1fr)_110px_105px_40px] lg:items-center">
          <div className="order-2 lg:order-1">
            {item.unit === 'peso' ? (
              <div className="flex items-center gap-1.5">
                <input
                  aria-label={`Peso de ${item.product_name}`}
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={item.weight ?? ''}
                  onChange={event => onUpdateWeight(index, event.target.value)}
                  className="h-10 w-20 rounded-lg border border-border bg-background px-2 text-center text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <span className="text-xs font-medium text-muted-foreground">kg</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Diminuir quantidade" onClick={() => onUpdateQuantity(index, Math.max(1, Number(item.quantity || 1) - 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  aria-label={`Quantidade de ${item.product_name}`}
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity ?? 1}
                  onChange={event => onUpdateQuantity(index, Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                  className="h-9 w-14 rounded-lg border border-border bg-background px-1 text-center text-base font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button type="button" aria-label="Aumentar quantidade" onClick={() => onUpdateQuantity(index, Number(item.quantity || 1) + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            <p className="truncate text-sm font-semibold">{item.product_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.unit === 'peso' ? `Peso: ${Number(item.weight || 0).toFixed(3)} kg` : `Quantidade: ${item.quantity || 1}`}
            </p>
          </div>

          <div className="order-3 col-span-1 text-left lg:col-span-1 lg:text-right">
            <span className="text-[10px] uppercase text-muted-foreground lg:hidden">Unitário</span>
            {item.allow_pdv_price_edit ? (
              <div className="flex items-center gap-2 lg:justify-end">
                <input
                  aria-label={`Valor unitário de ${item.product_name}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price ?? ''}
                  onChange={event => onUpdatePrice(index, event.target.value)}
                  className="h-10 w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 text-right text-sm font-semibold tabular-nums text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400/30 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200"
                />
                <Pencil className="h-4 w-4 text-amber-600" />
              </div>
            ) : (
              <p className="text-sm font-medium tabular-nums">{formatCurrency(item.unit_price)}</p>
            )}
          </div>

          <div className="order-4 text-right">
            <span className="text-[10px] uppercase text-muted-foreground lg:hidden">Subtotal</span>
            <p className="text-sm font-bold tabular-nums">{formatCurrency(item.subtotal)}</p>
          </div>

          <button type="button" aria-label={`Remover ${item.product_name}`} onClick={() => onRemoveItem(index)} className="order-5 col-span-2 ml-auto grid h-9 w-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10 lg:col-span-1 lg:ml-0">
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
