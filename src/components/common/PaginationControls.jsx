import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationControls({ page, pageCount, total, pageSize, onPageChange }) {
  if (pageCount <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Paginação" className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 sm:flex-row">
      <span className="text-xs font-medium text-muted-foreground">Exibindo {first}–{last} de {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-bold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button>
        <span className="min-w-20 text-center text-xs font-bold">{page} de {pageCount}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-bold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">Próxima <ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
}
