import React from 'react';
import StockGridView from '@/components/stock/StockGridView';
import StockMobileList from '@/components/stock/StockMobileList';
import StockTable from '@/components/stock/StockTable';
import { StockEmptyState } from '@/components/stock/stock-view-utils';

export default function StockProductViews({
  viewMode,
  products,
  lowStockThreshold,
  dirty,
  categories,
  userRole,
  deletingId,
  SortIcon,
  onSort,
  onEdit,
  onDuplicate,
  onDelete,
  onInlineEdit,
  hasFilters,
  onClearFilters,
}) {
  if (viewMode === 'grid') {
    return (
      <>
        <StockGridView
          products={products}
          lowStockThreshold={lowStockThreshold}
          dirty={dirty}
          onEdit={onEdit}
        />
        {!products.length && (
          <div className="p-2">
            <StockEmptyState
              hasFilters={hasFilters}
              onClearFilters={onClearFilters}
            />
          </div>
        )}
      </>
    );
  }

  const canDelete = ['admin', 'gerente'].includes(userRole);

  return (
    <>
      <StockMobileList
        products={products}
        lowStockThreshold={lowStockThreshold}
        dirty={dirty}
        deletingId={deletingId}
        canDelete={canDelete}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        hasFilters={hasFilters}
        onClearFilters={onClearFilters}
      />
      <StockTable
        products={products}
        lowStockThreshold={lowStockThreshold}
        dirty={dirty}
        categories={categories}
        deletingId={deletingId}
        canDelete={canDelete}
        SortIcon={SortIcon}
        onSort={onSort}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onInlineEdit={onInlineEdit}
        hasFilters={hasFilters}
        onClearFilters={onClearFilters}
      />
    </>
  );
}
