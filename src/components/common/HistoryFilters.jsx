import React, { useId, useRef, useState } from 'react';
import { CalendarRange, Check, ChevronDown, FilterX, SlidersHorizontal, X } from 'lucide-react';
import DatePicker from './DatePicker';

export function FilterField({ label, icon: Icon = null, children }) {
  const generatedId = useId();
  const fieldId = children.props.id || generatedId;
  return (
    <div className="history-filter-field">
      <label htmlFor={fieldId} className="history-filter-label">
        {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
        {label}
      </label>
      {children.type === 'input' && children.props.type === 'date'
        ? <DatePicker {...children.props} id={fieldId} />
        : React.cloneElement(children, { id: fieldId })}
    </div>
  );
}

export default function HistoryFilters({
  label,
  dates,
  search = null,
  quickRanges = [],
  activeFilters = [],
  onClear,
  actions = null,
  children,
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef(null);

  return (
    <section className="filter-surface history-filters" aria-label={label}>
      <div className={`history-filter-toolbar ${search ? 'has-search' : ''} ${actions ? 'has-actions' : ''}`}>
        <div className="history-filter-heading">
          <div className="history-filter-period">
            <span className="history-filter-label"><CalendarRange aria-hidden="true" className="h-4 w-4" /> Período</span>
            {quickRanges.length > 0 && (
              <div className="history-filter-presets" aria-label="Períodos rápidos">
                {quickRanges.map(({ label: rangeLabel, active, onClick }) => (
                  <button key={rangeLabel} type="button" aria-pressed={active} onClick={onClick}>
                    {rangeLabel}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`history-filter-main ${search ? 'has-search' : ''}`}>
          <div className="history-filter-dates">{dates}</div>
          {search && <div className="history-filter-search">{search}</div>}
          <button
            ref={toggleRef}
            type="button"
            className="history-filter-toggle"
            aria-label="Filtros adicionais"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            Filtros
            {activeFilters.length > 0 && <span className="history-filter-count">{activeFilters.length}</span>}
            <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {actions && <div className="history-filter-actions">{actions}</div>}
      </div>

      {activeFilters.length > 0 && (
        <div className="history-filter-active" aria-label="Filtros ativos">
          {activeFilters.map(({ key, label: filterLabel, onRemove }) => (
            <button key={key} type="button" onClick={onRemove} aria-label={`Remover filtro: ${filterLabel}`} className="history-filter-chip">
              <Check aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span>{filterLabel}</span>
              <X aria-hidden="true" className="h-3 w-3 shrink-0" />
            </button>
          ))}
          <button type="button" onClick={onClear} className="history-filter-clear"><FilterX aria-hidden="true" className="h-3.5 w-3.5" /> Limpar filtros</button>
        </div>
      )}

      <div
        id={panelId}
        hidden={!open}
        className="history-filter-extra"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setOpen(false);
            toggleRef.current?.focus();
          }
        }}
      >
        <div className="history-filter-extra-heading">
          <span className="history-filter-label">Refinar resultados</span>
          <button type="button" aria-label="Fechar filtros" onClick={() => { setOpen(false); toggleRef.current?.focus(); }}><X aria-hidden="true" className="h-4 w-4" /></button>
        </div>
        <div className="history-filter-fields">{children}</div>
      </div>
    </section>
  );
}
