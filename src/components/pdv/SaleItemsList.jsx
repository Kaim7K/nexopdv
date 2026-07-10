import React from 'react';
import { Trash2, Minus, Plus, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';

export default function SaleItemsList({ items, onUpdateQuantity, onUpdateWeight, onRemoveItem }) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <Package className="w-12 h-12 mb-3 text-muted-foreground/20" />
        <p className="text-sm font-medium">Nenhum produto adicionado</p>
        <p className="text-xs mt-1">Busque ou escaneie produtos para iniciar a venda</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors group">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{item.product_name}</div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(item.unit_price)} / {item.unit === 'peso' ? 'kg' : item.unit === 'pacote' ? 'pct' : 'un'}
            </div>
          </div>

          {item.unit === 'peso' ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="number"
                step="0.001"
                min="0"
                value={item.weight || ''}
                onChange={(e) => onUpdateWeight(index, e.target.value)}
                className="w-16 px-2 py-1 text-sm text-center bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-colors"
              />
              <span className="text-xs text-muted-foreground">kg</span>
            </div>
          ) : (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => onUpdateQuantity(index, parseInt(e.target.value) || 1)}
                className="w-10 px-1 py-1 text-sm text-center bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-colors font-medium"
              />
              <button
                onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="w-24 text-right font-bold text-sm tabular-nums flex-shrink-0">
            {formatCurrency(item.subtotal)}
          </div>

          <button
            onClick={() => onRemoveItem(index)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}