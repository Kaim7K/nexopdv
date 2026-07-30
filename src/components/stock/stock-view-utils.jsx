import React from 'react';
import { Package } from 'lucide-react';
import { TABLE_COLUMNS } from '@/lib/stock-helpers';

export function StockEmptyState({
  hasFilters,
  onClearFilters,
  table = false,
  colSpan = TABLE_COLUMNS.length + 2,
}) {
  const content = (
    <>
      <Package className="mx-auto h-10 w-10 text-muted-foreground/25" />
      <p className="mt-3 font-bold">Nenhum produto encontrado</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Altere os filtros ou cadastre um novo produto.
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground"
        >
          Limpar filtros
        </button>
      )}
    </>
  );

  if (table) {
    return (
      <tr>
        <td colSpan={colSpan} className="p-8 text-center sm:p-12">
          {content}
        </td>
      </tr>
    );
  }

  return (
    <div className="rounded-xl border border-border p-5 text-center sm:p-6">
      {content}
    </div>
  );
}

export function getStockState(product, lowStockThreshold, dirty) {
  const quantity = Number(product.quantity || 0);
  const tracksStock = product.track_stock !== false;
  const isZero = quantity <= 0;
  const isLow = tracksStock && !isZero && quantity <= lowStockThreshold;

  return {
    quantity,
    tracksStock,
    isZero,
    isLow,
    isDirty: dirty.has(product.id),
  };
}
