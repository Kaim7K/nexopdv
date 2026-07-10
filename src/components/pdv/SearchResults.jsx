import React from 'react';
import { Package, AlertTriangle, ScanLine } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';

export default function SearchResults({ results, onSelect, loading }) {
  if (loading) {
    return (
      <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl p-5 text-center text-muted-foreground">
        <div className="w-6 h-6 border-4 border-secondary border-t-accent rounded-full animate-spin mx-auto mb-2"></div>
        Buscando produtos...
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl p-6 text-center">
        <ScanLine className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm font-medium">Nenhum produto encontrado</p>
        <p className="text-xs text-muted-foreground mt-1">Escaneie o código de barras para cadastrar rapidamente.</p>
      </div>
    );
  }

  return (
    <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl max-h-[420px] overflow-y-auto overflow-x-hidden">
      {results.map((product, i) => (
        <button
          key={product.id}
          onClick={() => onSelect(product)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-secondary/50 transition-colors text-left border-b border-border last:border-0 last:rounded-b-xl first:rounded-t-xl"
        >
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
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