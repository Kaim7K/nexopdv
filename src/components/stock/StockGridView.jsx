import React from 'react';
import { Package } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { getStockState } from '@/components/stock/stock-view-utils';

export default function StockGridView({
  products,
  lowStockThreshold,
  dirty,
  onEdit,
}) {
  return (
    <div className="grid grid-cols-2 gap-2 p-2 min-[390px]:grid-cols-3 sm:grid-cols-4 sm:p-2.5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {products.map((product) => {
        const { quantity, tracksStock, isZero, isLow, isDirty } = getStockState(
          product,
          lowStockThreshold,
          dirty,
        );
        const statusClass = isDirty
          ? 'border-amber-500/40 bg-amber-500/10'
          : tracksStock && isZero
            ? 'border-red-500/30 bg-red-500/10'
            : tracksStock && isLow
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-border bg-card';

        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onEdit(product)}
            className={`group min-w-0 overflow-hidden rounded-xl border text-left transition active:scale-[0.98] sm:hover:-translate-y-0.5 sm:hover:shadow-md ${statusClass}`}
          >
            <div className="aspect-[4/3] bg-muted/30 sm:aspect-square">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-contain p-1.5"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="grid h-full place-items-center text-muted-foreground/30">
                  <Package className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="space-y-1 p-2">
              <div>
                <p className="line-clamp-2 min-h-8 text-[11px] font-bold leading-4 sm:text-xs">
                  {product.name}
                </p>
                <p className="line-clamp-1 text-[9px] text-muted-foreground sm:text-[10px]">
                  {product.category || 'Sem categoria'}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-black text-accent">
                  {formatCurrency(product.sale_price || 0)}
                </span>
                <span className="max-w-16 truncate rounded-full border border-border bg-background px-1.5 py-0.5 text-[8px] font-semibold text-muted-foreground">
                  {product.unit || 'unidade'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[9px]">
                <span
                  className={
                    tracksStock && isZero
                      ? 'font-bold text-destructive'
                      : 'text-muted-foreground'
                  }
                >
                  {!tracksStock
                    ? 'Sem controle'
                    : isZero
                      ? 'Sem estoque'
                      : `Estq: ${quantity}`}
                </span>
                <span className="min-w-0 truncate text-muted-foreground">
                  {product.barcode || product.internal_code || '-'}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
