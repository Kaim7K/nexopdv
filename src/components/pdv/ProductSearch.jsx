import React from 'react';
import { Search, X } from 'lucide-react';

export default function ProductSearch({
  query,
  onQueryChange,
  inputRef,
  onFocus,
}) {
  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground sm:left-3.5 sm:h-5 sm:w-5" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        placeholder="Buscar por nome, similares, código de barras ou código interno..."
        className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-10 text-sm shadow-none transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent sm:h-10 sm:rounded-xl sm:pl-11 sm:pr-24"
        autoComplete="off"
      />
      <div className="absolute right-2 flex items-center gap-1.5 sm:right-3">
        {query && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => onQueryChange('')}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">
          F4
        </kbd>
      </div>
    </div>
  );
}
