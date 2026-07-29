import React, { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, Package, Search, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { searchProducts } from '@/lib/pdv';

function ProductGrid({ products, onSelect, loading }) {
  const [category, setCategory] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [sortMode, setSortMode] = useState('sold_desc');
  const deferredSearch = useDeferredValue(localSearch);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return cats.sort();
  }, [products]);

  const visibleProducts = useMemo(() => {
    const searchedProducts = deferredSearch
      ? searchProducts(products, deferredSearch, { limit: 300 })
      : products;
    const filtered = searchedProducts.filter(p => {
      const matchCat = !category || p.category === category;
      return matchCat;
    });

    const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
    const sorted = deferredSearch ? filtered : [...filtered].sort((a, b) => {
      if (sortMode === 'sold_desc') return Number(b.sales_count || 0) - Number(a.sales_count || 0) || collator.compare(String(a.name || ''), String(b.name || ''));
      if (sortMode === 'name_asc') return collator.compare(String(a.name || ''), String(b.name || ''));
      if (sortMode === 'name_desc') return collator.compare(String(b.name || ''), String(a.name || ''));
      return 0;
    });

    return sorted.slice(0, 100);
  }, [products, category, deferredSearch, sortMode]);

  if (loading) {
    return (
      <div role="status" aria-label="Carregando produtos" aria-live="polite" aria-busy="true" className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search + Category filter */}
      <div className="space-y-2 border-b border-border px-3 pb-2 pt-2 sm:px-4 sm:pt-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
          <select value={sortMode} onChange={event => setSortMode(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
            <option value="sold_desc">Mais vendidos</option>
            <option value="name_asc">Nome A-Z</option>
            <option value="name_desc">Nome Z-A</option>
          </select>
        </div>
        {categories.length > 0 && (
          <div>
            <label className="sr-only" htmlFor="product-category-filter">
              Filtrar por categoria
            </label>
            <select
              id="product-category-filter"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3">
        {visibleProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Package className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))]">
            {visibleProducts.map(product => (
              <button
                type="button"
                key={product.id}
                onClick={() => onSelect(product)}
                className="group flex min-w-0 flex-col rounded-xl border border-border bg-card p-2 text-left transition active:scale-[0.98] sm:p-2.5 sm:hover:border-accent sm:hover:shadow-md"
              >
                <div className="mb-1.5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-muted sm:mb-2 sm:aspect-square">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Package className="w-8 h-8 text-muted-foreground/40" />
                  )}
                </div>
                <div title={product.name} className="mb-1 line-clamp-2 min-h-8 text-[11px] font-semibold leading-4 sm:text-xs">{product.name}</div>
                <div className="mt-auto flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-bold text-accent">{formatCurrency(product.sale_price)}</span>
                  {product.quantity <= 0 ? (
                    <span className="flex min-w-0 items-center gap-0.5 text-[10px] leading-3 text-destructive">
                      <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">Sem estoque</span>
                    </span>
                  ) : (
                    <span className="truncate text-[10px] leading-3 text-muted-foreground">Estq: {product.quantity}</span>
                  )}
                </div>
                {sortMode === 'sold_desc' && (
                  <div className="mt-1 flex min-w-0 items-center gap-1 text-[10px] leading-3 text-muted-foreground">
                    <TrendingUp className="h-3 w-3 shrink-0" /> <span className="truncate">{Number(product.sales_count || 0)} venda(s)</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(ProductGrid);
