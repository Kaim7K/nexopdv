import React from 'react';
import { Package } from 'lucide-react';
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
        const badgeClass = isDirty
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
          : tracksStock && isZero
            ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
            : tracksStock && isLow
              ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-200'
              : 'border-border bg-card text-foreground';

        return (
          <article
            key={product.id}
            className={`rounded-xl border p-2 shadow-sm shadow-black/[0.025] ${badgeClass}`}
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
                  <Package className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 break-words text-sm font-bold leading-4">
                  {product.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {product.category || 'Sem categoria'}
                </p>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded-full border border-border bg-background px-2 py-0.5">
                    {tracksStock ? `Estoque: ${quantity}` : 'Sem controle'}
                  </span>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5">
                    Preço: {formatCurrency(product.sale_price || 0)}
                  </span>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5">
                    {product.status === 'inativo' ? 'Inativo' : 'Ativo'}
                  </span>
                </div>
                <div className="mt-1 grid gap-0.5 text-[10px] leading-4 text-muted-foreground">
                  <span className="truncate">
                    Código de barras: {product.barcode || '-'}
                  </span>
                  <span className="truncate">
                    Última venda:{' '}
                    {product.last_sale_at
                      ? formatDateTime(product.last_sale_at)
                      : 'Nunca vendido'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-bold hover:bg-muted"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(product)}
                className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-bold hover:bg-muted"
              >
                Duplicar
              </button>
              {canDelete && (
                <button
                  type="button"
                  disabled={deletingId === product.id}
                  onClick={() => onDelete(product)}
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-destructive/25 bg-card px-2.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:cursor-wait disabled:opacity-50"
                >
                  Excluir
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
