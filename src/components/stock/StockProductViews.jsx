import React, { useCallback, useRef } from 'react';
import { useMediaQuery } from '@/hooks/use-responsive-layout';
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
  onReport,
  onDuplicate,
  onDelete,
  onInlineEdit,
  hasFilters,
  onClearFilters,
  advancedReports = true,
  saving = false,
}) {
  const viewRef = useRef(null);
  const commitFocusedField = useCallback(() => {
    const field = document.activeElement;
    if (viewRef.current?.contains(field) && field instanceof HTMLElement) field.blur();
  }, []);
  const showTable = useMediaQuery('(min-width: 1280px)', commitFocusedField);
  const canViewReports = advancedReports && ['gerente', 'admin'].includes(userRole);

  if (viewMode === 'grid') {
    return (
      <>
        <StockGridView
          products={products}
          lowStockThreshold={lowStockThreshold}
          dirty={dirty}
          onEdit={onEdit}
          onReport={canViewReports ? onReport : undefined}
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
    <div ref={viewRef} className="contents">
      {!showTable ? <StockMobileList
        products={products}
        lowStockThreshold={lowStockThreshold}
        dirty={dirty}
        deletingId={deletingId}
        canDelete={canDelete}
        onEdit={onEdit}
        onReport={canViewReports ? onReport : undefined}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        hasFilters={hasFilters}
        onClearFilters={onClearFilters}
      /> : <StockTable
        saving={saving}
        products={products}
        lowStockThreshold={lowStockThreshold}
        dirty={dirty}
        categories={categories}
        deletingId={deletingId}
        canDelete={canDelete}
        SortIcon={SortIcon}
        onSort={onSort}
        onEdit={onEdit}
        onReport={canViewReports ? onReport : undefined}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onInlineEdit={onInlineEdit}
        hasFilters={hasFilters}
        onClearFilters={onClearFilters}
      />}
    </div>
  );
}
