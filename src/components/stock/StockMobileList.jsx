import React from 'react';
import { Copy, Package, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/helpers';
import {
  getStockState,
  StockEmptyState,
} from '@/components/stock/stock-view-utils';

export default function StockMobileList({
  products,
  lowStockThreshold,
  dirty,
  deletingId,
  canDelete,
  onEdit,
  onDuplicate,
  onDelete,
  hasFilters,
  onClearFilters,
}) {
  return (
    <div className="space-y-1.5 p-1.5 xl:hidden">
      {products.map((product) => {
        const { quantity, tracksStock, isZero, isLow, isDirty } = getStockState(
          product,
          lowStockThreshold,
          dirty,
        );
        const stateClass = isDirty
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100'
          : tracksStock && isZero
            ? 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-100'
            : tracksStock && isLow
              ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-100'
              : 'border-border bg-card text-foreground';
        const stockLabel = tracksStock ? `Estoque: ${quantity}` : 'Sem controle';
        const lastSaleLabel = product.last_sale_at
          ? formatDateTime(product.last_sale_at)
          : 'Nunca vendido';

        return (
          <article
            key={product.id}
            className={`rounded-xl border p-2 shadow-none transition active:scale-[0.995] ${stateClass}`}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white"
                aria-label={`Editar ${product.name}`}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt=""
                    className="h-full w-full object-contain p-1"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-black leading-4">
                      {product.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {product.category || 'Sem categoria'}
                    </p>
                  </div>
                  <strong className="shrink-0 text-sm font-black tabular-nums text-foreground">
                    {formatCurrency(product.sale_price || 0)}
                  </strong>
                </div>

                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded-full border border-border bg-background px-2 py-0.5">
                    {stockLabel}
                  </span>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5">
                    {product.status === 'inativo' ? 'Inativo' : 'Ativo'}
                  </span>
                </div>

                <div className="mt-1 grid gap-0.5 text-[10px] leading-3 text-muted-foreground">
                  <span className="truncate">
                    Código: {product.barcode || '-'}
                  </span>
                  <span className="truncate">
                    Última venda: {lastSaleLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-bold hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(product)}
                className="inline-flex min-h-8 w-10 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted"
                aria-label={`Duplicar ${product.name}`}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {canDelete && (
                <button
                  type="button"
                  disabled={deletingId === product.id}
                  onClick={() => onDelete(product)}
                  className="inline-flex min-h-8 w-10 items-center justify-center rounded-lg border border-destructive/25 bg-card text-destructive hover:bg-destructive/10 disabled:cursor-wait disabled:opacity-50"
                  aria-label={`Excluir ${product.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </article>
        );
      })}
      {!products.length && (
        <StockEmptyState hasFilters={hasFilters} onClearFilters={onClearFilters} />
      )}
    </div>
  );
}
