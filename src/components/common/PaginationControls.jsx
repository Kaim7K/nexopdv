import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationControls({ page, pageCount, total, pageSize, onPageChange }) {
  if (pageCount <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Paginação" className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3 sm:flex-row">
      <span className="text-xs font-medium text-muted-foreground">Exibindo {first}–{last} de {total}</span>
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:w-auto">
        <button type="button" aria-label="Página anterior" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border px-2 text-xs font-bold hover:bg-muted disabled:opacity-40 sm:px-3"><ChevronLeft className="h-4 w-4" /> <span className="hidden min-[380px]:inline">Anterior</span></button>
        <span className="min-w-16 text-center text-xs font-bold tabular-nums sm:min-w-20">{page} de {pageCount}</span>
        <button type="button" aria-label="Próxima página" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border px-2 text-xs font-bold hover:bg-muted disabled:opacity-40 sm:px-3"><span className="hidden min-[380px]:inline">Próxima</span> <ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
}
