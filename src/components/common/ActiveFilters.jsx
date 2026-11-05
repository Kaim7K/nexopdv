import { Check, FilterX, X } from 'lucide-react';

export default function ActiveFilters({ items = [], onClear }) {
  if (!items.length) return null;
  return (
    <div className="history-filter-active" aria-label="Filtros ativos">
      {items.map(({ key, label, onRemove }) => (
        <button key={key} type="button" onClick={onRemove} aria-label={`Remover filtro: ${label}`} className="history-filter-chip">
          <Check aria-hidden="true" className="h-3 w-3 shrink-0" />
          <span>{label}</span>
          <X aria-hidden="true" className="h-3 w-3 shrink-0" />
        </button>
      ))}
      <button type="button" onClick={onClear} className="history-filter-clear"><FilterX aria-hidden="true" className="h-3.5 w-3.5" /> Limpar filtros</button>
    </div>
  );
}
