import React from 'react';
import { BarChart3, Copy, Package, Pencil, Trash2 } from 'lucide-react';
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
  onReport,
  onDuplicate,
  onDelete,
  hasFilters,
  onClearFilters,
}) {
  return (
    <div className="divide-y divide-border/70 xl:hidden">
      {products.map((product) => {
        const { quantity, tracksStock, isZero, isLow, isDirty } = getStockState(
          product,
          lowStockThreshold,
          dirty,
        );
        const stateClass = isDirty
          ? 'border-l-amber-500 bg-amber-500/10'
          : tracksStock && isZero
            ? 'border-l-red-500 bg-red-500/10'
            : tracksStock && isLow
              ? 'border-l-amber-500 bg-amber-500/5'
              : 'border-l-transparent bg-card';
        const stockLabel = tracksStock ? `Estq: ${quantity}` : 'Sem controle';
        const lastSaleLabel = product.last_sale_at
          ? formatDateTime(product.last_sale_at)
          : 'Nunca vendido';

        return (
          <article
            key={product.id}
            className={`flex min-w-0 items-center gap-1.5 border-l-2 px-2 py-1.5 transition-colors ${stateClass}`}
          >
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-label={`Editar ${product.name}`}
              title={`Última venda: ${lastSaleLabel}`}
            >
              <span className="hidden h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white min-[380px]:grid">
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
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-foreground">
                  {product.name}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {product.category || 'Sem categoria'} · {stockLabel}
                </span>
              </span>
              <strong className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                {formatCurrency(product.sale_price || 0)}
              </strong>
            </button>

            <div className="flex shrink-0 items-center gap-1">
              {onReport && (
                <RowAction
                  label={`Abrir relatório de ${product.name}`}
                  title="Relatório"
                  onClick={() => onReport(product)}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </RowAction>
              )}
              <RowAction
                label={`Editar ${product.name}`}
                title="Editar"
                onClick={() => onEdit(product)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </RowAction>
              <RowAction
                label={`Duplicar ${product.name}`}
                title="Duplicar"
                onClick={() => onDuplicate(product)}
              >
                <Copy className="h-3.5 w-3.5" />
              </RowAction>
              {canDelete && (
                <RowAction
                  destructive
                  disabled={deletingId === product.id}
                  label={`Excluir ${product.name}`}
                  title="Excluir"
                  onClick={() => onDelete(product)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </RowAction>
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

function RowAction({
  children,
  label,
  title,
  onClick,
  disabled = false,
  destructive = false,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={title}
      className={`grid h-8 w-8 place-items-center rounded-md border bg-card transition-colors disabled:cursor-wait disabled:opacity-50 ${
        destructive
          ? 'border-destructive/25 text-destructive hover:bg-destructive/10'
          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
