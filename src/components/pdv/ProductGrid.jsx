import React, { useState, useMemo } from 'react';
import { Package, Search, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';

export default function ProductGrid({ products, onSelect, loading }) {
  const [category, setCategory] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return cats.sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchCat = !category || p.category === category;
      const q = localSearch.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q));
      return matchCat && matchSearch;
    }).slice(0, 100);
  }, [products, category, localSearch]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search + Category filter */}
      <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filtrar produtos..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-colors"
            autoComplete="off"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCategory('')}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${!category ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${category === cat ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Package className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map(product => (
              <button
                key={product.id}
                onClick={() => onSelect(product)}
                disabled={product.quantity <= 0}
                className="group flex flex-col bg-card rounded-xl border border-border p-2.5 text-left hover:border-accent hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:shadow-none"
              >
                <div className="aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden mb-2">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-8 h-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="text-xs font-medium leading-tight line-clamp-2 mb-1">{product.name}</div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-bold text-accent">{formatCurrency(product.sale_price)}</span>
                  {product.quantity <= 0 ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-destructive">
                      <AlertTriangle className="w-2.5 h-2.5" /> Sem estoque
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Estq: {product.quantity}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}