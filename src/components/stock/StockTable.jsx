import React from 'react';
import {
  AlertTriangle,
  Copy,
  Package,
  Pencil,
  Trash2,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/helpers';
import {
  getStockState,
  StockEmptyState,
} from '@/components/stock/stock-view-utils';

const visibleColumns = [
  ['barcode', 'Código barras', 'text', 'hidden 2xl:table-cell'],
  ['internal_code', 'Código interno', 'text', 'hidden 2xl:table-cell'],
  ['sale_price', 'Venda', 'number', ''],
  ['cost_price', 'Custo', 'number', 'hidden 2xl:table-cell'],
  ['quantity', 'Estoque', 'number', ''],
  ['unit', 'Unidade', 'text', 'hidden min-[1320px]:table-cell'],
  ['last_sale_at', 'Última venda', 'date', 'hidden min-[1320px]:table-cell'],
  ['status', 'Status', 'text', 'hidden 2xl:table-cell'],
];

const columnWidths = {
  barcode: 'w-[138px]',
  internal_code: 'w-[128px]',
  sale_price: 'w-[112px]',
  cost_price: 'w-[112px]',
  quantity: 'w-[96px]',
  unit: 'w-[112px]',
  last_sale_at: 'w-[148px]',
  status: 'w-[112px]',
};

const fieldClass =
  'h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none transition hover:border-border focus:border-accent focus:bg-background';

export default function StockTable({
  products,
  lowStockThreshold,
  dirty,
  categories,
  deletingId,
  canDelete,
  SortIcon,
  onSort,
  onEdit,
  onDuplicate,
  onDelete,
  onInlineEdit,
  hasFilters,
  onClearFilters,
}) {
  return (
    <table className="hidden w-full min-w-[1180px] border-separate border-spacing-0 text-sm xl:table">
      <colgroup>
        <col className="w-[320px]" />
        {visibleColumns.map(([key, , , visibility]) => (
          <col
            key={key}
            className={`${columnWidths[key] || 'w-[120px]'} ${visibility}`}
          />
        ))}
        <col className="w-[122px]" />
      </colgroup>
      <thead className="sticky top-0 z-20 bg-secondary/95 text-secondary-foreground shadow-sm backdrop-blur">
        <tr>
          <HeaderButton
            sticky
            className="left-0 z-30"
            label="Produto"
            sortKey="name"
            SortIcon={SortIcon}
            onSort={onSort}
          />
          {visibleColumns.map(([key, label, , visibility]) => (
            <HeaderButton
              key={key}
              className={visibility}
              label={label}
              sortKey={key}
              SortIcon={SortIcon}
              onSort={onSort}
            />
          ))}
          <th className="sticky right-0 z-30 border-b border-border bg-secondary px-3 py-2 text-right text-[11px] font-black uppercase text-muted-foreground">
            Ações
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => {
          const { quantity, tracksStock, isZero, isLow, isDirty } =
            getStockState(product, lowStockThreshold, dirty);
          const rowTone = isDirty
            ? 'bg-amber-500/10'
            : tracksStock && isZero
              ? 'bg-red-500/10'
              : tracksStock && isLow
                ? 'bg-amber-500/5'
                : 'bg-card';
          const stickyTone = isDirty
            ? 'bg-amber-50 dark:bg-amber-950/30'
            : tracksStock && isZero
              ? 'bg-red-50 dark:bg-red-950/30'
              : tracksStock && isLow
                ? 'bg-amber-50 dark:bg-amber-950/20'
                : 'bg-card';
          const hasCostPrice =
            product.cost_price !== null &&
            product.cost_price !== '' &&
            Number.isFinite(Number(product.cost_price));
          const unitProfit =
            Number(product.sale_price || 0) - Number(product.cost_price || 0);

          return (
            <tr
              key={product.id}
              className={`group transition-colors hover:bg-muted/30 ${rowTone}`}
            >
              <td
                className={`sticky left-0 z-10 border-b border-border/70 p-2 align-middle ${stickyTone}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background shadow-sm"
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
                    <input
                      aria-label={`Produto ${product.name}`}
                      className={`${fieldClass} h-8 px-1 font-bold`}
                      type="text"
                      value={product.name ?? ''}
                      onChange={(event) =>
                        onInlineEdit(product.id, 'name', event.target.value, 'text')
                      }
                    />
                    <select
                      aria-label={`Categoria de ${product.name}`}
                      className="mt-0.5 h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-xs text-muted-foreground outline-none hover:border-border focus:border-accent focus:bg-background"
                      value={product.category || ''}
                      onChange={(event) =>
                        onInlineEdit(
                          product.id,
                          'category',
                          event.target.value,
                          'text',
                        )
                      }
                    >
                      <option value="">Sem categoria</option>
                      {categories.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  {tracksStock && (isZero || isLow) && (
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                        isZero
                          ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                      }`}
                      aria-label={`Atualizar estoque de ${product.name}`}
                      title={isZero ? 'Sem estoque' : 'Estoque baixo'}
                    >
                      <span className="sr-only">Atualizar estoque</span>
                      <AlertTriangle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
              {visibleColumns.map(([key, label, type, visibility]) => (
                <td
                  key={key}
                  className={`border-b border-border/70 px-2 py-2 align-middle ${visibility}`}
                >
                  <CellEditor
                    product={product}
                    fieldKey={key}
                    label={label}
                    type={type}
                    quantity={quantity}
                    tracksStock={tracksStock}
                    hasCostPrice={hasCostPrice}
                    unitProfit={unitProfit}
                    onInlineEdit={onInlineEdit}
                  />
                </td>
              ))}
              <td
                className={`sticky right-0 z-10 border-b border-border/70 p-2 align-middle ${stickyTone}`}
              >
                <div className="flex justify-end gap-1.5">
                  <ActionButton
                    label={`Editar ${product.name} no formulário`}
                    title="Editar"
                    onClick={() => onEdit(product)}
                  >
                    <Pencil className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    label={`Duplicar ${product.name}`}
                    title="Duplicar"
                    onClick={() => onDuplicate(product)}
                  >
                    <Copy className="h-4 w-4" />
                  </ActionButton>
                  {canDelete && (
                    <ActionButton
                      destructive
                      disabled={deletingId === product.id}
                      label={`Excluir ${product.name}`}
                      title="Excluir"
                      onClick={() => onDelete(product)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </ActionButton>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
        {!products.length && (
          <StockEmptyState
            table
            hasFilters={hasFilters}
            onClearFilters={onClearFilters}
          />
        )}
      </tbody>
    </table>
  );
}

function HeaderButton({
  label,
  sortKey,
  SortIcon,
  onSort,
  sticky = false,
  className = '',
}) {
  return (
    <th
      className={`${sticky ? 'sticky bg-secondary' : ''} border-b border-border p-0 text-left ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex h-11 w-full items-center gap-1.5 px-3 text-[11px] font-black uppercase tracking-wide text-muted-foreground hover:bg-muted/60"
        aria-label={`Ordenar por ${label}`}
      >
        <span className="truncate">{label}</span>
        <SortIcon column={sortKey} />
      </button>
    </th>
  );
}

function CellEditor({
  product,
  fieldKey,
  label,
  type,
  quantity,
  tracksStock,
  hasCostPrice,
  unitProfit,
  onInlineEdit,
}) {
  if (fieldKey === 'last_sale_at') {
    return (
      <div className="min-w-0">
        <span className="block truncate text-xs font-bold">
          {product.last_sale_at
            ? formatDateTime(product.last_sale_at)
            : 'Nunca vendido'}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
          {product.last_sale_at ? 'Última saída' : 'Sem vendas'}
        </span>
      </div>
    );
  }

  if (fieldKey === 'sale_price' || fieldKey === 'cost_price') {
    return (
      <div>
        <label className="relative block">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">
            R$
          </span>
          <input
            aria-label={`${label} de ${product.name}`}
            className={`${fieldClass} pl-7 pr-1 font-bold tabular-nums`}
            type="number"
            min="0"
            step="0.01"
            value={product[fieldKey] ?? ''}
            onChange={(event) =>
              onInlineEdit(product.id, fieldKey, event.target.value, type)
            }
          />
        </label>
        {fieldKey === 'sale_price' && hasCostPrice && (
          <span
            className={`mt-0.5 block truncate px-2 text-[10px] font-bold ${
              unitProfit >= 0
                ? 'text-emerald-600 dark:text-emerald-300'
                : 'text-red-600 dark:text-red-300'
            }`}
          >
            {unitProfit >= 0 ? '+ ' : '- '}
            {formatCurrency(Math.abs(unitProfit))}
          </span>
        )}
      </div>
    );
  }

  if (fieldKey === 'quantity') {
    return (
      <input
        aria-label={`${label} de ${product.name}`}
        className={`${fieldClass} font-bold tabular-nums ${
          tracksStock && quantity <= 0
            ? 'text-red-600 dark:text-red-300'
            : ''
        }`}
        type="number"
        min="0"
        step="any"
        value={product[fieldKey] ?? ''}
        onChange={(event) =>
          onInlineEdit(product.id, fieldKey, event.target.value, type)
        }
      />
    );
  }

  if (fieldKey === 'status') {
    return (
      <select
        aria-label={`${label} de ${product.name}`}
        className={fieldClass}
        value={product.status || 'ativo'}
        onChange={(event) =>
          onInlineEdit(product.id, fieldKey, event.target.value, type)
        }
      >
        <option value="ativo">Ativo</option>
        <option value="inativo">Inativo</option>
      </select>
    );
  }

  if (fieldKey === 'unit') {
    return (
      <select
        aria-label={`${label} de ${product.name}`}
        className={fieldClass}
        value={product.unit || 'unidade'}
        onChange={(event) =>
          onInlineEdit(product.id, fieldKey, event.target.value, type)
        }
      >
        <option value="unidade">Unidade</option>
        <option value="peso">Peso</option>
      </select>
    );
  }

  return (
    <input
      aria-label={`${label} de ${product.name}`}
      className={`${fieldClass} truncate`}
      type={type}
      value={product[fieldKey] ?? ''}
      onChange={(event) =>
        onInlineEdit(product.id, fieldKey, event.target.value, type)
      }
    />
  );
}

function ActionButton({
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
      className={`grid h-8 w-8 place-items-center rounded-lg border transition disabled:cursor-wait disabled:opacity-50 ${
        destructive
          ? 'border-destructive/25 text-destructive hover:bg-destructive/10'
          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
