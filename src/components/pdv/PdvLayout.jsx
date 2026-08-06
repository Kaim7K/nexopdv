import React from 'react';
import {
  ArrowRight,
  Banknote,
  Edit3,
  LayoutGrid,
  LockKeyhole,
} from 'lucide-react';
import ProductGrid from '@/components/pdv/ProductGrid';
import ProductSearch from '@/components/pdv/ProductSearch';
import SearchResults from '@/components/pdv/SearchResults';

const Kbd = ({ children }) => (
  <kbd className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs font-bold leading-none">
    {children}
  </kbd>
);

export function PdvTopBar({
  saleNumber,
  temporaryNumber,
  userLabel,
  cashOpen,
  cashLoading,
  hasItems,
  canUsePdv,
  onCashClick,
  onPriceCorrection,
}) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-2.5 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-black sm:text-[15px]">
          Venda #{saleNumber}
          {temporaryNumber && (
            <span className="ml-2 text-xs font-semibold text-accent">
              aberta #{temporaryNumber}
            </span>
          )}
        </h1>
        <p className="max-w-[150px] truncate text-[11px] text-muted-foreground sm:max-w-none sm:text-xs">
          {userLabel}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-3 text-xs text-muted-foreground xl:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>F1</Kbd> Pagamento
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>F2</Kbd> Remover
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>F4</Kbd> Buscar
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>F6</Kbd> Descartar
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>F7</Kbd> Minimizar
          </span>
        </div>
        <button
          type="button"
          onClick={onCashClick}
          disabled={cashLoading}
          aria-label={cashOpen ? 'Caixa aberto' : 'Abrir caixa'}
          className={`flex min-h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-bold transition disabled:opacity-50 sm:min-h-9 sm:px-3 sm:text-sm ${
            cashOpen
              ? 'border-emerald-300 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
              : 'border-border bg-card text-foreground hover:bg-muted'
          }`}
        >
          {cashOpen ? (
            <Banknote className="h-4 w-4" />
          ) : (
            <LockKeyhole className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {cashOpen ? 'Caixa aberto' : 'Abrir caixa'}
          </span>
        </button>
        <button
          type="button"
          onClick={onPriceCorrection}
          disabled={!hasItems || !canUsePdv}
          aria-label="Corrigir valor de um produto da venda"
          className="flex min-h-9 items-center gap-2 rounded-lg border border-amber-300 px-2.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-40 sm:min-h-9 sm:px-3 sm:text-sm dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30"
        >
          <Edit3 className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">Valor errado</span>
        </button>
      </div>
    </div>
  );
}

export function PdvLockedState({ continuePath, onContinue, onOpenCash }) {
  return (
    <div className="grid flex-1 place-items-center p-3 sm:p-5">
      <div className="max-w-md rounded-2xl border border-border bg-card p-4 text-center shadow-lg sm:p-5">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent sm:h-14 sm:w-14">
          <LockKeyhole className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <h2 className="mt-3 text-lg font-black sm:mt-4 sm:text-xl">
          Abra o caixa para começar
        </h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          Informe o troco inicial para liberar as vendas.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {continuePath && (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted sm:min-h-11 sm:px-5"
            >
              Continuar sem caixa <ArrowRight className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCash}
            className="min-h-10 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:bg-accent/90 sm:min-h-11 sm:px-5"
          >
            Abrir caixa
          </button>
        </div>
      </div>
    </div>
  );
}

export function PdvProductPanel({
  searchContainerRef,
  searchQuery,
  onSearchQueryChange,
  inputRef,
  onSearchFocus,
  showResults,
  searchResults,
  onSelectProduct,
  products,
  productsLoading,
}) {
  return (
    <div className="flex h-[32%] min-h-[210px] max-h-[280px] w-full flex-col overflow-hidden border-r border-border md:h-auto md:max-h-none md:w-[36%] md:min-w-[280px] xl:min-w-[300px]">
      <div className="flex-shrink-0 p-1.5 pb-1 sm:p-3 sm:pb-2">
        <div className="relative" ref={searchContainerRef}>
          <ProductSearch
            query={searchQuery}
            onQueryChange={onSearchQueryChange}
            inputRef={inputRef}
            onFocus={onSearchFocus}
          />
          {showResults && searchQuery && (
            <SearchResults
              results={searchResults}
              loading={false}
              onSelect={onSelectProduct}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-1.5 pb-1.5 sm:px-3 sm:pb-3">
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:rounded-xl">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2.5 py-1 text-[11px] font-semibold sm:px-4 sm:py-2 sm:text-xs">
            <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5" /> Produtos
          </div>
          <ProductGrid
            products={products}
            onSelect={onSelectProduct}
            loading={productsLoading}
          />
        </div>
      </div>
    </div>
  );
}
