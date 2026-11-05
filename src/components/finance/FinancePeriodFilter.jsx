import IconButton from '@/components/common/IconButton';
import { useState } from 'react';
import { CalendarRange, ChevronDown, RefreshCw } from 'lucide-react';
import { rangePreset } from '@/features/finance/finance-period';

export default function PeriodFilter({ range, setRange, loading, onRefresh }) {
  const [preset, setPreset] = useState('month');
  return (
    <div className="finance-period-filter flex flex-wrap items-center gap-2" aria-label="Período financeiro">
      <select
        className="field mt-0 min-w-40 flex-1 sm:w-auto sm:flex-none"
        aria-label="Período rápido"
        value={preset}
        onChange={(event) => {
          const value = event.target.value;
          setPreset(value);
          if (value !== 'custom') setRange(rangePreset(value));
        }}
      >
        <option value="today">Hoje</option>
        <option value="yesterday">Ontem</option>
        <option value="7days">Últimos 7 dias</option>
        <option value="month">Este mês</option>
        <option value="previous">Mês anterior</option>
        <option value="custom">Período personalizado</option>
      </select>
      <details className="group relative">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold marker:hidden hover:bg-muted">
          <CalendarRange className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:hidden">Escolher datas</span>
          <span className="hidden sm:inline">Escolher datas</span>
          <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-[min(330px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-xl">
          <p className="text-xs font-bold">Período personalizado</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-muted-foreground">
              De
              <input
                type="date"
                className="field mt-1"
                value={range.from}
                onChange={(event) => {
                  setPreset('custom');
                  const selectedDate = event.target.value;
                  setRange((value) => ({
                    ...value,
                    from: selectedDate,
                    to: selectedDate,
                  }));
                }}
              />
            </label>
            <label className="text-[11px] font-semibold text-muted-foreground">
              Até
              <input
                type="date"
                className="field mt-1"
                value={range.to}
                min={range.from}
                onChange={(event) => {
                  setPreset('custom');
                  setRange((value) => ({
                    ...value,
                    to: event.target.value,
                  }));
                }}
              />
            </label>
          </div>
        </div>
      </details>
      <IconButton label="Atualizar" onClick={onRefresh} disabled={loading} aria-busy={loading}>
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </IconButton>
      <span className="finance-period-caption" aria-live="polite">{range.from?.split('-').reverse().join('/')} — {range.to?.split('-').reverse().join('/')}</span>
    </div>
  );
}
