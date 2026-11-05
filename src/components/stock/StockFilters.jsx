import React from 'react';
import ActiveFilters from '@/components/common/ActiveFilters';
import { LayoutGrid, List, Search, SlidersHorizontal } from 'lucide-react';

const controlClass =
  'h-9 min-w-0 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-10';

function SearchField({ value, onChange }) {
  return (
    <label className="relative">
      <span className="sr-only">Pesquisar produtos</span>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        className={`${controlClass} w-full pl-9 sm:pl-10`}
        placeholder="Produto, categoria ou código"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CategorySelect({ value, onChange, categories }) {
  return (
    <select
      aria-label="Filtrar por categoria"
      className={controlClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Todas as categorias</option>
      <option value="__uncategorized__">Sem categoria</option>
      {categories.map((item) => (
        <option key={item}>{item}</option>
      ))}
    </select>
  );
}

function AdvancedFilters({
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  stock,
  onStockChange,
  imageFilter,
  onImageFilterChange,
  pageSize,
  onPageSizeChange,
}) {
  return (
    <>
      <label className="sr-only" htmlFor="min-price">
        Preço mínimo
      </label>
      <input
        id="min-price"
        className={controlClass}
        type="number"
        min="0"
        step="0.01"
        placeholder="Preço mín."
        value={minPrice}
        onChange={(event) => onMinPriceChange(event.target.value)}
      />
      <label className="sr-only" htmlFor="max-price">
        Preço máximo
      </label>
      <input
        id="max-price"
        className={controlClass}
        type="number"
        min="0"
        step="0.01"
        placeholder="Preço máx."
        value={maxPrice}
        onChange={(event) => onMaxPriceChange(event.target.value)}
      />
      <select
        aria-label="Filtrar por disponibilidade"
        className={controlClass}
        value={stock}
        onChange={(event) => onStockChange(event.target.value)}
      >
        <option value="todos">Qualquer estoque</option>
        <option value="disponivel">Estoque normal</option>
        <option value="baixo">Estoque baixo</option>
        <option value="zerado">Sem estoque</option>
      </select>
      <select
        aria-label="Filtrar por imagem"
        className={controlClass}
        value={imageFilter}
        onChange={(event) => onImageFilterChange(event.target.value)}
      >
        <option value="all">Com ou sem imagem</option>
        <option value="with">Somente com imagem</option>
        <option value="without">Somente sem imagem</option>
      </select>
      <select
        aria-label="Quantidade por página"
        className={controlClass}
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      >
        <option value="20">20 por página</option>
        <option value="50">50 por página</option>
        <option value="100">100 por página</option>
        <option value="200">200 por página</option>
      </select>
    </>
  );
}

function ViewModeControl({ viewMode, onViewModeChange }) {
  return (
    <div className="inline-flex min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      <button
        type="button"
        aria-pressed={viewMode === 'table'}
        onClick={() => onViewModeChange('table')}
        className={`inline-flex min-h-9 items-center gap-2 px-3 text-xs font-bold sm:min-h-10 sm:text-sm ${viewMode === 'table' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
      >
        <List className="h-4 w-4" /> Tabela
      </button>
      <button
        type="button"
        aria-pressed={viewMode === 'grid'}
        onClick={() => onViewModeChange('grid')}
        className={`inline-flex min-h-9 items-center gap-2 border-l border-border px-3 text-xs font-bold sm:min-h-10 sm:text-sm ${viewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
      >
        <LayoutGrid className="h-4 w-4" /> Grade
      </button>
    </div>
  );
}

export default function StockFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  stock,
  onStockChange,
  imageFilter,
  onImageFilterChange,
  pageSize,
  onPageSizeChange,
  viewMode,
  onViewModeChange,
  onClearFilters,
}) {
  const advancedProps = {
    minPrice,
    onMinPriceChange,
    maxPrice,
    onMaxPriceChange,
    stock,
    onStockChange,
    imageFilter,
    onImageFilterChange,
    pageSize,
    onPageSizeChange,
  };

  const activeFilters = [
    search && { key: 'search', label: `Busca: ${search}`, onRemove: () => onSearchChange('') },
    category && { key: 'category', label: category === '__uncategorized__' ? 'Sem categoria' : category, onRemove: () => onCategoryChange('') },
    minPrice && { key: 'min', label: `Preço mín.: ${minPrice}`, onRemove: () => onMinPriceChange('') },
    maxPrice && { key: 'max', label: `Preço máx.: ${maxPrice}`, onRemove: () => onMaxPriceChange('') },
    stock !== 'todos' && { key: 'stock', label: { disponivel: 'Estoque normal', baixo: 'Estoque baixo', zerado: 'Sem estoque' }[stock], onRemove: () => onStockChange('todos') },
    imageFilter !== 'all' && { key: 'image', label: imageFilter === 'with' ? 'Com imagem' : 'Sem imagem', onRemove: () => onImageFilterChange('all') },
  ].filter(Boolean);
  const extraCount = activeFilters.filter(item => !['search', 'category'].includes(item.key)).length;
  return (
    <section className="filter-surface unified-filters mb-3" aria-label="Filtros do estoque">
      <div className="stock-filter-primary">
        <SearchField value={search} onChange={onSearchChange} />
        <CategorySelect value={category} onChange={onCategoryChange} categories={categories} />
        <ViewModeControl viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
      <details className="unified-filter-extra" onKeyDown={event => {
        if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
      }}>
        <summary className="history-filter-toggle"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Mais filtros {extraCount > 0 && <span className="history-filter-count">{extraCount}</span>}</summary>
        <div className="stock-filter-fields"><AdvancedFilters {...advancedProps} /></div>
      </details>
      <ActiveFilters items={activeFilters} onClear={onClearFilters} />
    </section>
  );
}
