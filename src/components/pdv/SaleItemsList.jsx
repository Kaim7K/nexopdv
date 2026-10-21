import React, { useLayoutEffect, useRef } from 'react';
import { Minus, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyDigits,
} from '@/lib/helpers';

export default function SaleItemsList({
  items,
  onUpdateQuantity,
  onUpdateWeight,
  onUpdatePrice,
  onRemoveItem,
}) {
  const listRef = useRef(null);
  const previousItemsRef = useRef([]);

  useLayoutEffect(() => {
    const previousItems = previousItemsRef.current;
    previousItemsRef.current = items;
    const list = listRef.current;
    if (!list) return;

    // Follow additions, including a repeated scan of an existing product.
    // Price edits, decreases and removals keep the operator's scroll position.
    let latestIndex = -1;
    items.forEach((item, index) => {
      const previous = previousItems.find(
        (candidate) => candidate.product_id === item.product_id,
      );
      if (
        !previous ||
        Number(item.quantity) > Number(previous.quantity) ||
        Number(item.weight) > Number(previous.weight)
      ) {
        latestIndex = index;
      }
    });
    if (latestIndex < 0) return;

    const row = list.querySelectorAll('.pdv-sale-item')[latestIndex];
    const header = list.querySelector('.pdv-sale-items-header');
    const visibleTop = list.getBoundingClientRect().top + (header?.clientHeight || 0);
    const visibleBottom = list.getBoundingClientRect().bottom;
    const bounds = row.getBoundingClientRect();
    if (bounds.bottom > visibleBottom) {
      list.scrollTop += bounds.bottom - visibleBottom;
    } else if (bounds.top < visibleTop) {
      list.scrollTop += bounds.top - visibleTop;
    }
  }, [items]);

  if (!items.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-3 text-center text-muted-foreground sm:p-6">
        <Package className="mb-2 h-7 w-7 text-muted-foreground/20 sm:h-10 sm:w-10" />
        <p className="text-xs font-semibold sm:text-sm">Nenhum produto adicionado</p>
        <p className="mt-1 text-[11px] sm:text-xs">
          Busque ou escaneie produtos para iniciar a venda.
        </p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="pdv-sale-items min-h-0 flex-1 overscroll-contain overflow-y-auto">
      <div className="pdv-sale-items-header sticky top-0 z-10 gap-3 bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Quantidade</span>
        <span>Produto</span>
        <span className="text-right">Valor unitário</span>
        <span className="text-right">Subtotal</span>
        <span />
      </div>

      {items.map((item, index) => (
        <div
          key={`${item.product_id}-${index}`}
          className="pdv-sale-item grid items-center gap-x-2 gap-y-1 px-2.5 py-1.5 transition-colors sm:px-4 sm:py-2"
        >
          <div className="pdv-sale-item-quantity">
            {item.unit === 'peso' ? (
              <div className="flex items-center gap-1.5">
                <input
                  aria-label={`Peso de ${item.product_name}`}
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={item.weight ?? ''}
                  onChange={(event) =>
                    onUpdateWeight(index, event.target.value)
                  }
                  className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-center text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  kg
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  onClick={() =>
                    onUpdateQuantity(
                      index,
                      Math.max(1, Number(item.quantity || 1) - 1),
                    )
                  }
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  aria-label={`Quantidade de ${item.product_name}`}
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity ?? 1}
                  onChange={(event) =>
                    onUpdateQuantity(
                      index,
                      Math.max(
                        1,
                        Number.parseInt(event.target.value, 10) || 1,
                      ),
                    )
                  }
                  className="h-8 w-12 rounded-lg border border-border bg-background px-1 text-center text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-accent sm:h-9 sm:text-base"
                />
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  onClick={() =>
                    onUpdateQuantity(index, Number(item.quantity || 1) + 1)
                  }
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="pdv-sale-item-product min-w-0">
            <p title={item.product_name} className="line-clamp-1 text-xs font-semibold leading-4 sm:text-sm sm:leading-5">
              {item.product_name}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
              {item.unit === 'peso'
                ? `Peso: ${Number(item.weight || 0).toFixed(2)} kg`
                : `Quantidade: ${item.quantity || 1}`}
            </p>
          </div>

          <div className="pdv-sale-item-price flex min-w-0 flex-wrap items-center gap-x-1.5">
            <span className="pdv-sale-item-label text-[10px] uppercase text-muted-foreground">
              Unitário
            </span>
            {item.allow_pdv_price_edit ? (
              <div className="flex items-center gap-1.5">
                <input
                  aria-label={`Valor unitário de ${item.product_name}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formatCurrencyInput(item.unit_price)}
                  onChange={(event) =>
                    onUpdatePrice(
                      index,
                      parseCurrencyDigits(event.target.value),
                    )
                  }
                  className="h-9 w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 text-right text-sm font-semibold tabular-nums text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400/30 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200"
                />
                <Pencil className="h-4 w-4 text-amber-600" />
              </div>
            ) : (
              <p className="text-sm font-medium tabular-nums">
                {formatCurrency(item.unit_price)}
              </p>
            )}
          </div>

          <div className="pdv-sale-item-subtotal flex flex-wrap items-center justify-end gap-x-1.5 text-right">
            <span className="pdv-sale-item-label text-[10px] uppercase text-muted-foreground">
              Subtotal
            </span>
            <p className="text-sm font-bold tabular-nums">
              {formatCurrency(item.subtotal)}
            </p>
          </div>

          <button
            type="button"
            aria-label={`Remover ${item.product_name}`}
            onClick={() => onRemoveItem(index)}
            className="pdv-sale-item-remove grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10 sm:h-9 sm:w-9"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
