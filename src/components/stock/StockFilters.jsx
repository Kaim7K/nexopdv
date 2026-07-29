import React from 'react';
import { FilterX, LayoutGrid, List, Search } from 'lucide-react';

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
  return (
    <section
      className="mb-2.5 rounded-xl border border-border bg-card p-2 shadow-sm sm:mb-3 sm:p-3"
      aria-label="Filtros do estoque"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[minmax(220px,1.4fr)_minmax(170px,1fr)_repeat(2,minmax(110px,.7fr))_repeat(2,minmax(145px,.9fr))_minmax(125px,.75fr)_auto]">
        <label className="relative sm:col-span-2 lg:col-span-2 2xl:col-span-1">
          <span className="sr-only">Pesquisar produtos</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm sm:h-11 sm:rounded-xl sm:pl-10 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="Produto, categoria ou código"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar por categoria"
          className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm sm:h-11 sm:rounded-xl outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="min-price">
          Preço mínimo
        </label>
        <input
          id="min-price"
          className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm sm:h-11 sm:rounded-xl outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
          className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm sm:h-11 sm:rounded-xl outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          type="number"
          min="0"
          step="0.01"
          placeholder="Preço máximo"
          value={maxPrice}
          onChange={(event) => onMaxPriceChange(event.target.value)}
        />
        <select
          aria-label="Filtrar por disponibilidade"
          className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm sm:h-11 sm:rounded-xl outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
          className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm sm:h-11 sm:rounded-xl outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          value={imageFilter}
          onChange={(event) => onImageFilterChange(event.target.value)}
        >
          <option value="all">Com ou sem imagem</option>
          <option value="with">Somente com imagem</option>
          <option value="without">Somente sem imagem</option>
        </select>
        <select
          aria-label="Quantidade por página"
          className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm sm:h-11 sm:rounded-xl outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          <option value="20">20 por página</option>
          <option value="50">50 por página</option>
          <option value="100">100 por página</option>
          <option value="200">200 por página</option>
        </select>
        <div className="inline-flex min-w-0 overflow-hidden rounded-lg border sm:rounded-xl border-border bg-background sm:justify-self-start 2xl:justify-self-stretch">
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            className={`inline-flex min-h-10 items-center gap-2 sm:min-h-11 px-3 text-sm font-semibold ${viewMode === 'table' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
          >
            <List className="h-4 w-4" /> Tabela
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={`inline-flex min-h-10 items-center gap-2 sm:min-h-11 border-l border-border px-3 text-sm font-semibold ${viewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
          >
            <LayoutGrid className="h-4 w-4" /> Grade
          </button>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg sm:min-h-11 sm:rounded-xl border border-border px-3 text-sm font-bold hover:bg-muted 2xl:col-start-8"
          >
            <FilterX className="h-4 w-4" /> Limpar
          </button>
        )}
      </div>
    </section>
  );
}

