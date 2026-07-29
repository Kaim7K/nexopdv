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
  ['barcode', 'Cod. barras', 'text', 'hidden 2xl:table-cell'],
  ['internal_code', 'Cod. interno', 'text', 'hidden 2xl:table-cell'],
  ['sale_price', 'Venda', 'number', ''],
  ['cost_price', 'Custo', 'number', 'hidden 2xl:table-cell'],
  ['quantity', 'Estoque', 'number', ''],
  ['unit', 'Unidade', 'text', 'hidden min-[1320px]:table-cell'],
  ['last_sale_at', 'Ultima venda', 'date', 'hidden min-[1320px]:table-cell'],
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
  'h-7 w-full rounded-sm border border-transparent bg-transparent px-1.5 text-sm outline-none transition hover:bg-muted/35 focus:border-accent/40 focus:bg-background';

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
        <col className="w-[340px]" />
        {visibleColumns.map(([key, , , visibility]) => (
          <col
            key={key}
            className={`${columnWidths[key] || 'w-[120px]'} ${visibility}`}
          />
        ))}
        <col className="w-[122px]" />
      </colgroup>
      <thead className="sticky top-0 z-20 bg-card/95 text-card-foreground backdrop-blur">
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
          <th className="sticky right-0 z-30 border-b border-l border-border/70 bg-card px-3 py-2 text-right text-[11px] font-black uppercase text-muted-foreground">
            Acoes
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => {
          const { quantity, tracksStock, isZero, isLow, isDirty } =
            getStockState(product, lowStockThreshold, dirty);
          const rowTone = 'bg-card';
          const stickyTone = 'bg-card';
          const stockStripe = isDirty
            ? 'before:bg-amber-400'
            : tracksStock && isZero
              ? 'before:bg-red-500'
              : tracksStock && isLow
                ? 'before:bg-amber-400'
                : 'before:bg-transparent';
          const hasCostPrice =
            product.cost_price !== null &&
            product.cost_price !== '' &&
            Number.isFinite(Number(product.cost_price));
          const unitProfit =
            Number(product.sale_price || 0) - Number(product.cost_price || 0);

          return (
            <tr
              key={product.id}
              className={`group transition-colors hover:bg-muted/25 ${rowTone}`}
            >
              <td
                className={`sticky left-0 z-10 border-b border-r border-border/60 px-2 py-1.5 align-middle ${stickyTone} before:absolute before:bottom-0 before:left-0 before:top-0 before:w-0.5 ${stockStripe}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-border/80 bg-background"
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
                    <input
                      aria-label={`Produto ${product.name}`}
                      className={`${fieldClass} px-1 font-bold`}
                      type="text"
                      value={product.name ?? ''}
                      onChange={(event) =>
                        onInlineEdit(product.id, 'name', event.target.value, 'text')
                      }
                    />
                    <select
                      aria-label={`Categoria de ${product.name}`}
                      className="mt-0.5 h-6 w-full rounded-sm border border-transparent bg-transparent px-1 text-xs text-muted-foreground outline-none hover:bg-muted/35 focus:border-accent/40 focus:bg-background"
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
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                        isZero
                          ? 'border-red-500/35 bg-transparent text-red-600 dark:text-red-300'
                          : 'border-amber-500/35 bg-transparent text-amber-600 dark:text-amber-300'
                      }`}
                      aria-label={`Atualizar estoque de ${product.name}`}
                      title={isZero ? 'Sem estoque' : 'Estoque baixo'}
                    >
                      <span className="sr-only">Atualizar estoque</span>
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </td>
              {visibleColumns.map(([key, label, type, visibility]) => (
                <td
                  key={key}
                  className={`border-b border-border/60 px-2 py-1.5 align-middle ${visibility}`}
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
                className={`sticky right-0 z-10 border-b border-l border-border/60 px-2 py-1.5 align-middle ${stickyTone}`}
              >
                <div className="flex justify-end gap-1">
                  <ActionButton
                    label={`Editar ${product.name} no formulario`}
                    title="Editar"
                    onClick={() => onEdit(product)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </ActionButton>
                  <ActionButton
                    label={`Duplicar ${product.name}`}
                    title="Duplicar"
                    onClick={() => onDuplicate(product)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </ActionButton>
                  {canDelete && (
                    <ActionButton
                      destructive
                      disabled={deletingId === product.id}
                      label={`Excluir ${product.name}`}
                      title="Excluir"
                      onClick={() => onDelete(product)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
      className={`${sticky ? 'sticky bg-card' : ''} border-b border-border/70 p-0 text-left ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex h-9 w-full items-center gap-1.5 px-3 text-[11px] font-black uppercase tracking-wide text-muted-foreground hover:bg-muted/40"
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
          {product.last_sale_at ? 'Ultima saida' : 'Sem vendas'}
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
            className={`mt-0.5 block truncate px-1.5 text-[10px] font-bold ${
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
      className={`grid h-7 w-7 place-items-center rounded-md border transition disabled:cursor-wait disabled:opacity-50 ${
        destructive
          ? 'border-destructive/25 text-destructive hover:bg-destructive/10'
          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
