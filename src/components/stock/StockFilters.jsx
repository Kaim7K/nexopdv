import React from 'react';
import { FilterX, LayoutGrid, List, Search, SlidersHorizontal } from 'lucide-react';

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
        placeholder="Preço mínimo"
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
        placeholder="Preço máximo"
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
        onClick={() => onViewModeChange('table')}
        className={`inline-flex min-h-9 items-center gap-2 px-3 text-xs font-bold sm:min-h-10 sm:text-sm ${viewMode === 'table' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
      >
        <List className="h-4 w-4" /> Tabela
      </button>
      <button
        type="button"
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
  hasFilters,
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

  return (
    <section
      className="mb-2.5 rounded-xl border border-border bg-card p-2 shadow-sm shadow-black/[0.025] sm:mb-3 sm:p-2.5"
      aria-label="Filtros do estoque"
    >
      <div className="space-y-1.5 sm:hidden">
        <SearchField value={search} onChange={onSearchChange} />
        <CategorySelect
          value={category}
          onChange={onCategoryChange}
          categories={categories}
        />
        <div className="flex items-stretch justify-between gap-1.5">
          <ViewModeControl viewMode={viewMode} onViewModeChange={onViewModeChange} />
          {hasFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold hover:bg-muted"
            >
              <FilterX className="h-4 w-4" /> Limpar
            </button>
          )}
        </div>
        <details className="group mobile-secondary-panel">
          <summary className="mobile-secondary-summary">
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Filtros avançados
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              abrir
            </span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">
              fechar
            </span>
          </summary>
          <div className="grid gap-1.5 border-t border-border p-1.5">
            <AdvancedFilters {...advancedProps} />
          </div>
        </details>
      </div>

      <div className="hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[minmax(220px,1.4fr)_minmax(170px,1fr)_repeat(2,minmax(110px,.7fr))_repeat(2,minmax(145px,.9fr))_minmax(125px,.75fr)_auto]">
        <div className="sm:col-span-2 lg:col-span-2 2xl:col-span-1">
          <SearchField value={search} onChange={onSearchChange} />
        </div>
        <CategorySelect
          value={category}
          onChange={onCategoryChange}
          categories={categories}
        />
        <AdvancedFilters {...advancedProps} />
        <div className="sm:justify-self-start 2xl:justify-self-stretch">
          <ViewModeControl viewMode={viewMode} onViewModeChange={onViewModeChange} />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-bold hover:bg-muted 2xl:col-start-8"
          >
            <FilterX className="h-4 w-4" /> Limpar
          </button>
        )}
      </div>
    </section>
  );
}
