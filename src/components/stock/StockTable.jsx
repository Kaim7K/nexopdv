import React from 'react';
import { ArrowRight, Copy, Package, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/helpers';
import {
  TABLE_COLUMNS,
  TABLE_COLUMN_VISIBILITY,
  tableColumnWidth,
} from '@/lib/stock-helpers';
import {
  getStockState,
  StockEmptyState,
} from '@/components/stock/stock-view-utils';

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
    <table className="hidden w-full min-w-[1560px] table-fixed text-sm xl:table">
      <thead className="sticky top-0 z-20 bg-secondary/95 text-secondary-foreground shadow-sm backdrop-blur">
        <tr>
          <th className="sticky left-0 z-30 w-[76px] bg-secondary px-3 py-3 text-left">
            <span className="sr-only">Imagem</span>
            <Package className="h-5 w-5" />
          </th>
          {TABLE_COLUMNS.map(([key, label]) => (
            <th
              key={key}
              className={`p-0 text-left ${TABLE_COLUMN_VISIBILITY[key] || ''} ${key === 'name' ? 'sticky left-[76px] z-30 bg-secondary' : ''}`}
            >
              <button
                type="button"
                onClick={() => onSort(key)}
                className={`flex w-full items-center gap-1.5 px-3 py-3 text-[11px] font-semibold uppercase tracking-wide hover:bg-muted ${tableColumnWidth(key)} ${key === 'name' ? 'whitespace-normal text-left leading-5' : 'whitespace-nowrap'}`}
                aria-label={`Ordenar por ${label}`}
              >
                {label} <SortIcon column={key} />
              </button>
            </th>
          ))}
          <th className="sticky right-0 z-30 w-[214px] bg-secondary px-3 py-3 text-right">
            Ações
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => {
          const { quantity, tracksStock, isZero, isLow, isDirty } =
            getStockState(product, lowStockThreshold, dirty);
          const rowBackground = isDirty
            ? 'bg-amber-500/10'
            : tracksStock && isZero
              ? 'bg-red-500/10'
              : tracksStock && isLow
                ? 'bg-amber-500/5'
                : '';
          const stickyBackground = isDirty
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
              className={`border-t border-border/80 transition-colors hover:bg-muted/30 ${rowBackground}`}
            >
              <td
                className={`sticky left-0 z-10 p-2 align-middle ${stickyBackground}`}
              >
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-border bg-background shadow-sm"
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
              </td>
              {TABLE_COLUMNS.map(([key, label, type]) => (
                <td
                  key={key}
                  className={`p-1 align-middle ${TABLE_COLUMN_VISIBILITY[key] || ''} ${
                    key === 'name'
                      ? `sticky left-[76px] z-10 ${stickyBackground}`
                      : ''
                  }`}
                >
                  {key === 'last_sale_at' ? (
                    <div className="min-w-[124px] px-2">
                      <span className="block text-xs font-bold">
                        {product.last_sale_at
                          ? formatDateTime(product.last_sale_at)
                          : 'Nunca vendido'}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {product.last_sale_at
                          ? 'Última saída registrada'
                          : 'Sem vendas registradas'}
                      </span>
                    </div>
                  ) : key === 'sale_price' || key === 'cost_price' ? (
                    <div className="min-w-[104px] px-1">
                      <label className="relative block">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                          R$
                        </span>
                        <input
                          aria-label={`${label} de ${product.name}`}
                          className="h-10 w-full rounded-lg border border-transparent bg-transparent pl-8 pr-2 text-sm font-bold tabular-nums hover:border-border focus:border-accent focus:bg-background focus:outline-none"
                          type="number"
                          min="0"
                          step="0.01"
                          value={product[key] ?? ''}
                          onChange={(event) =>
                            onInlineEdit(
                              product.id,
                              key,
                              event.target.value,
                              type,
                            )
                          }
                        />
                      </label>
                      {key === 'sale_price' && hasCostPrice && (
                        <span
                          className={`mt-0.5 block px-2 text-[10px] font-bold ${unitProfit >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}
                        >
                          {unitProfit >= 0 ? '+ ' : '- '}
                          {formatCurrency(Math.abs(unitProfit))}
                        </span>
                      )}
                    </div>
                  ) : key === 'category' ? (
                    <select
                      aria-label={`${label} de ${product.name}`}
                      className="h-10 w-full min-w-[132px] rounded-lg border border-transparent bg-transparent px-2 text-sm hover:border-border focus:border-accent focus:bg-background focus:outline-none"
                      value={product.category || ''}
                      onChange={(event) =>
                        onInlineEdit(product.id, key, event.target.value, type)
                      }
                    >
                      <option value="">Sem categoria</option>
                      {categories.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : key === 'status' ? (
                    <select
                      aria-label={`${label} de ${product.name}`}
                      className="h-10 w-full min-w-[96px] rounded-lg border border-transparent bg-transparent px-2 hover:border-border focus:border-accent focus:bg-background focus:outline-none"
                      value={product.status || 'ativo'}
                      onChange={(event) =>
                        onInlineEdit(product.id, key, event.target.value, type)
                      }
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  ) : key === 'unit' ? (
                    <select
                      aria-label={`${label} de ${product.name}`}
                      className="h-10 w-full min-w-[96px] rounded-lg border border-transparent bg-transparent px-2 hover:border-border focus:border-accent focus:bg-background focus:outline-none"
                      value={product.unit || 'unidade'}
                      onChange={(event) =>
                        onInlineEdit(product.id, key, event.target.value, type)
                      }
                    >
                      <option value="unidade">Unidade</option>
                      <option value="peso">Peso</option>
                    </select>
                  ) : key === 'name' ? (
                    <input
                      aria-label={`${label} de ${product.name}`}
                      className="h-10 w-full min-w-[200px] rounded-lg border border-transparent bg-transparent px-2 text-sm font-semibold leading-5 hover:border-border focus:border-accent focus:bg-background focus:outline-none"
                      type={type}
                      value={product[key] ?? ''}
                      onChange={(event) =>
                        onInlineEdit(product.id, key, event.target.value, type)
                      }
                    />
                  ) : (
                    <input
                      aria-label={`${label} de ${product.name}`}
                      className={`h-10 w-full rounded-lg border border-transparent bg-transparent px-2 hover:border-border focus:border-accent focus:bg-background focus:outline-none ${tableColumnWidth(key)}`}
                      type={type}
                      min={type === 'number' ? '0' : undefined}
                      step={
                        key === 'sale_price' || key === 'cost_price'
                          ? '0.01'
                          : 'any'
                      }
                      value={product[key] ?? ''}
                      onChange={(event) =>
                        onInlineEdit(product.id, key, event.target.value, type)
                      }
                    />
                  )}
                </td>
              ))}
              <td
                className={`sticky right-0 z-10 p-2 align-middle ${stickyBackground}`}
              >
                <div className="flex flex-wrap justify-end gap-1">
                  {tracksStock && isZero && (
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3 text-xs font-bold text-red-700 hover:bg-red-500/15 dark:text-red-300"
                    >
                      Atualizar estoque <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Editar ${product.name} no formulário`}
                    title="Editar no formulário"
                  >
                    <Pencil className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicate(product)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Duplicar ${product.name}`}
                    title="Duplicar produto"
                  >
                    <Copy className="h-[18px] w-[18px]" />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      disabled={deletingId === product.id}
                      onClick={() => onDelete(product)}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-destructive/25 text-destructive transition hover:bg-destructive/10 disabled:cursor-wait disabled:opacity-50"
                      aria-label={`Excluir ${product.name}`}
                      title="Excluir produto"
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
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
