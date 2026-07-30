import React, { useEffect, useState } from 'react';
import {
  Copy,
  Package,
  Pencil,
  Trash2,
} from 'lucide-react';
import { formatDateTime } from '@/lib/helpers';
import {
  getStockState,
  StockEmptyState,
} from '@/components/stock/stock-view-utils';

const TABLE_COLUMNS = [
  {
    key: 'name',
    label: 'Produto',
    sortKey: 'name',
    width: 'w-[300px]',
    sticky: 'left',
  },
  {
    key: 'category',
    label: 'Categoria',
    sortKey: 'category',
    width: 'w-[190px]',
    type: 'text',
  },
  {
    key: 'barcode',
    label: 'Cod. barras',
    sortKey: 'barcode',
    width: 'w-[150px]',
    type: 'text',
  },
  {
    key: 'sale_price',
    label: 'Venda',
    sortKey: 'sale_price',
    width: 'w-[120px]',
    type: 'number',
  },
  {
    key: 'quantity',
    label: 'Estoque',
    sortKey: 'quantity',
    width: 'w-[110px]',
    type: 'number',
  },
  {
    key: 'last_sale_at',
    label: 'Ultima venda',
    sortKey: 'last_sale_at',
    width: 'w-[150px]',
    type: 'date',
  },
  {
    key: 'status',
    label: 'Status',
    sortKey: 'status',
    width: 'w-[128px]',
    type: 'text',
  },
  {
    key: 'actions',
    label: 'Acoes',
    width: 'w-[116px]',
    sticky: 'right',
  },
];

const inputClass =
  'h-8 w-full min-w-0 rounded-md border !border-transparent !bg-transparent px-2 text-sm !shadow-none outline-none transition-colors hover:!border-transparent hover:!bg-transparent focus:!border-accent/45 focus:!bg-background focus:!shadow-none focus:!ring-2 focus:!ring-accent/15';

const cellClass =
  'border-b border-border/70 bg-card px-3 py-2 align-middle transition-colors group-hover:bg-muted/25';

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
    <table className="hidden w-full min-w-[1224px] table-fixed border-separate border-spacing-0 text-sm xl:table">
      <colgroup>
        {TABLE_COLUMNS.map((column) => (
          <col
            key={column.key}
            className={`${column.width} ${column.visibility || ''}`}
          />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-40 bg-card">
        <tr>
          {TABLE_COLUMNS.map((column) => (
            <HeaderCell
              key={column.key}
              column={column}
              SortIcon={SortIcon}
              onSort={onSort}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {products.map((product) => {
          const stock = getStockState(product, lowStockThreshold, dirty);
          return (
            <ProductRow
              key={product.id}
              product={product}
              stock={stock}
              categories={categories}
              deletingId={deletingId}
              canDelete={canDelete}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onInlineEdit={onInlineEdit}
            />
          );
        })}
        {!products.length && (
          <StockEmptyState
            table
            colSpan={TABLE_COLUMNS.length}
            hasFilters={hasFilters}
            onClearFilters={onClearFilters}
          />
        )}
      </tbody>
    </table>
  );
}

function HeaderCell({ column, SortIcon, onSort }) {
  const stickyClass =
    column.sticky === 'left'
      ? 'sticky left-0 z-30'
      : column.sticky === 'right'
        ? 'sticky right-0 z-30 text-right'
        : '';

  return (
    <th
      className={`${stickyClass} border-b border-border bg-card px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-muted-foreground shadow-none ${column.visibility || ''}`}
    >
      {column.sortKey ? (
        <button
          type="button"
          onClick={() => onSort(column.sortKey)}
          className={`flex h-6 w-full items-center gap-1.5 rounded-md transition hover:text-foreground ${
            column.sticky === 'right' ? 'justify-end' : ''
          }`}
          aria-label={`Ordenar por ${column.label}`}
        >
          <span className="truncate">{column.label}</span>
          <SortIcon column={column.sortKey} />
        </button>
      ) : (
        <span>{column.label}</span>
      )}
    </th>
  );
}

function ProductRow({
  product,
  stock,
  categories,
  deletingId,
  canDelete,
  onEdit,
  onDuplicate,
  onDelete,
  onInlineEdit,
}) {
  const { quantity, tracksStock, isZero, isLow, isDirty } = stock;
  const stripeClass = isDirty
    ? 'before:bg-amber-400'
    : tracksStock && isZero
      ? 'before:bg-red-500'
      : tracksStock && isLow
        ? 'before:bg-amber-400'
        : 'before:bg-transparent';

  return (
    <tr className="group">
      <td
        className={`${cellClass} sticky left-0 z-10 border-r border-border/70 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-0.5 ${stripeClass} relative`}
      >
        <ProductIdentity
          product={product}
          onEdit={onEdit}
          onInlineEdit={onInlineEdit}
        />
      </td>
      {TABLE_COLUMNS.slice(1, -1).map((column) => (
        <td key={column.key} className={`${cellClass} ${column.visibility || ''}`}>
          <CellEditor
            product={product}
            column={column}
            quantity={quantity}
            tracksStock={tracksStock}
            categories={categories}
            onInlineEdit={onInlineEdit}
          />
        </td>
      ))}
      <td className={`${cellClass} sticky right-0 z-10 border-l border-border/70`}>
        <div className="flex justify-end gap-1.5">
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
}

function ProductIdentity({ product, onEdit, onInlineEdit }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={() => onEdit(product)}
        className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background transition-colors group-hover:border-accent/25"
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
        <InlineField
          aria-label={`Produto ${product.name}`}
          className={`${inputClass} h-7 px-1.5 font-bold`}
          type="text"
          value={product.name ?? ''}
          onCommit={(value) => onInlineEdit(product.id, 'name', value, 'text')}
        />
      </div>
    </div>
  );
}

function CellEditor({
  product,
  column,
  quantity,
  tracksStock,
  categories,
  onInlineEdit,
}) {
  const fieldKey = column.key;
  const label = column.label;
  const type = column.type;

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

  if (fieldKey === 'category') {
    return (
      <InlineSelect
        aria-label={`Categoria de ${product.name}`}
        className={`${inputClass} text-muted-foreground`}
        value={product.category || ''}
        onCommit={(value) =>
          onInlineEdit(product.id, 'category', value, 'text')
        }
      >
        <option value="">Sem categoria</option>
        {categories.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </InlineSelect>
    );
  }

  if (fieldKey === 'sale_price' || fieldKey === 'cost_price') {
    return (
      <div className="min-w-0">
        <label className="relative block">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">
            R$
          </span>
          <InlineField
            aria-label={`${label} de ${product.name}`}
            className={`${inputClass} pl-7 pr-2 font-bold tabular-nums`}
            type="number"
            min="0"
            step="0.01"
            value={product[fieldKey] ?? ''}
            onCommit={(value) =>
              onInlineEdit(product.id, fieldKey, value, type)
            }
          />
        </label>
      </div>
    );
  }

  if (fieldKey === 'quantity') {
    return (
      <InlineField
        aria-label={`${label} de ${product.name}`}
        className={`${inputClass} font-bold tabular-nums ${
          tracksStock && quantity <= 0
            ? 'text-red-600 dark:text-red-300'
            : ''
        }`}
        type="number"
        min="0"
        step="any"
        value={product[fieldKey] ?? ''}
        onCommit={(value) => onInlineEdit(product.id, fieldKey, value, type)}
      />
    );
  }

  if (fieldKey === 'status') {
    return (
      <InlineSelect
        aria-label={`${label} de ${product.name}`}
        className={inputClass}
        value={product.status || 'ativo'}
        onCommit={(value) => onInlineEdit(product.id, fieldKey, value, type)}
      >
        <option value="ativo">Ativo</option>
        <option value="inativo">Inativo</option>
      </InlineSelect>
    );
  }

  if (fieldKey === 'unit') {
    return (
      <InlineSelect
        aria-label={`${label} de ${product.name}`}
        className={inputClass}
        value={product.unit || 'unidade'}
        onCommit={(value) => onInlineEdit(product.id, fieldKey, value, type)}
      >
        <option value="unidade">Unidade</option>
        <option value="peso">Peso</option>
      </InlineSelect>
    );
  }

  return (
    <InlineField
      aria-label={`${label} de ${product.name}`}
      className={`${inputClass} truncate`}
      type={type}
      value={product[fieldKey] ?? ''}
      onCommit={(value) => onInlineEdit(product.id, fieldKey, value, type)}
    />
  );
}

function InlineField({ value, onCommit, ...props }) {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    if (String(draft ?? '') !== String(value ?? '')) onCommit(draft);
  };

  return (
    <input
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(value ?? '');
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function InlineSelect({ value, onCommit, children, ...props }) {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    if (String(draft ?? '') !== String(value ?? '')) onCommit(draft);
  };

  return (
    <select
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(value ?? '');
          event.currentTarget.blur();
        }
      }}
    >
      {children}
    </select>
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
      className={`grid h-8 w-8 place-items-center rounded-lg border bg-card !shadow-none transition-colors disabled:cursor-wait disabled:opacity-50 ${
        destructive
          ? 'border-destructive/25 text-destructive hover:bg-destructive/10'
          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
