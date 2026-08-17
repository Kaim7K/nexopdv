import React from 'react';
import { Package, AlertTriangle, ScanLine } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';

export default function SearchResults({ results, onSelect, loading }) {
  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-border bg-card p-3 text-center text-muted-foreground shadow-lg">
        <div className="w-6 h-6 border-4 border-secondary border-t-accent rounded-full animate-spin mx-auto mb-2"></div>
        Buscando produtos...
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-border bg-card p-4 text-center shadow-lg">
        <ScanLine className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
        <p className="text-sm font-medium">Nenhum produto encontrado</p>
        <p className="text-xs text-muted-foreground mt-1">Escaneie o código de barras para cadastrar rapidamente.</p>
      </div>
    );
  }

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[320px] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card shadow-lg sm:max-h-[420px]">
      {results.map((product, i) => (
        <button
          type="button"
          key={product.id}
          onClick={() => onSelect(product)}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors odd:bg-muted/20 hover:bg-secondary/50 first:rounded-t-xl last:rounded-b-xl sm:gap-3 sm:px-3.5 sm:py-2.5"
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:h-10 sm:w-10">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ) : (
              <Package className="w-5 h-5 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{product.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              {product.category && <span className="truncate">{product.category}</span>}
              {product.barcode && <span className="text-[10px]">• {product.barcode}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-sm text-accent">{formatCurrency(product.sale_price)}</div>
            <div className={`text-[10px] flex items-center gap-0.5 justify-end ${product.quantity <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {product.quantity <= 0 && <AlertTriangle className="w-2.5 h-2.5" />}
              {product.quantity <= 0 ? 'Sem estoque' : `${product.quantity} ${product.unit === 'peso' ? 'kg' : 'un'}`}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
