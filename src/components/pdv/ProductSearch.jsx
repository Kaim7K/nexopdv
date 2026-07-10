import React from 'react';
import { Search, X } from 'lucide-react';

export default function ProductSearch({ query, onQueryChange, inputRef, onFocus }) {
  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3.5 w-5 h-5 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        placeholder="Buscar produto por nome, código de barras ou código interno..."
        className="w-full pl-11 pr-24 py-3 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
        autoComplete="off"
      />
      <div className="absolute right-3 flex items-center gap-1.5">
        {query && (
          <button onClick={() => onQueryChange('')} className="text-muted-foreground hover:text-foreground p-0.5">
            <X className="w-4 h-4" />
          </button>
        )}
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted border border-border rounded text-muted-foreground">F4</kbd>
      </div>
    </div>
  );
}