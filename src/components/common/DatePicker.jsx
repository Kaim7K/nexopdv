import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return dateKey(date) === value ? date : null;
};
const fullDate = (date) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(date);
const clampDate = (date, min, max) => {
  const key = dateKey(date);
  return (min && key < min ? parseDate(min) : max && key > max ? parseDate(max) : date) || date;
};

export default function DatePicker({ value = '', onChange, id = undefined, min = '', max = '', disabled = false, 'aria-label': ariaLabel = undefined }) {
  const generatedId = useId();
  const triggerId = id || generatedId;
  const dialogId = `${triggerId}-calendar`;
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const focusDayRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseDate(value) || new Date());
  const [focusedDay, setFocusedDay] = useState(value);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 304 });
  const today = dateKey(new Date());
  const selectedDate = parseDate(value);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstYear = Math.min(parseDate(min)?.getFullYear() ?? new Date().getFullYear() - 100, year);
  const lastYear = Math.max(parseDate(max)?.getFullYear() ?? new Date().getFullYear() + 100, year);
  const start = new Date(year, monthIndex, 1, 12);
  const weekCount = Math.ceil((start.getDay() + new Date(year, monthIndex + 1, 0).getDate()) / 7);
  start.setDate(1 - start.getDay());
  const days = Array.from({ length: weekCount * 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12));
  const isDisabled = (key) => Boolean((min && key < min) || (max && key > max));
  const monthAllowed = (candidate) => {
    const first = dateKey(new Date(candidate.getFullYear(), candidate.getMonth(), 1, 12));
    const last = dateKey(new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0, 12));
    return (!min || last >= min) && (!max || first <= max);
  };
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const selectDate = (key) => {
    if (key && isDisabled(key)) return;
    onChange({ target: { value: key } });
    close();
  };
  const viewMonth = (date) => {
    const bounded = clampDate(date, min, max);
    setMonth(bounded);
    setFocusedDay(dateKey(bounded));
  };
  const show = () => {
    if (open) { close(); return; }
    const initial = clampDate(parseDate(value) || new Date(), min, max);
    setMonth(initial);
    setFocusedDay(dateKey(initial));
    focusDayRef.current = true;
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = Math.min(304, window.innerWidth - 24);
      const height = popupRef.current?.getBoundingClientRect().height || 370;
      const below = rect.bottom + 8;
      const top = below + height <= window.innerHeight - 12 ? below : rect.top - height - 8;
      setPosition({
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: Math.max(12, Math.min(top, window.innerHeight - height - 12)),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, year, monthIndex]);

  useLayoutEffect(() => {
    if (open && focusDayRef.current) {
      popupRef.current?.querySelector(`[data-date="${focusedDay}"]`)?.focus();
      focusDayRef.current = false;
    }
  }, [focusedDay, open, month]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (!popupRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  const moveDay = (event, date) => {
    const next = new Date(date);
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -date.getDay(), End: 6 - date.getDay() };
    if (event.key in offsets) next.setDate(date.getDate() + offsets[event.key]);
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const nextMonth = date.getMonth() + (event.key === 'PageUp' ? -1 : 1);
      next.setDate(1);
      next.setMonth(nextMonth);
      next.setDate(Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    } else return;
    event.preventDefault();
    const bounded = clampDate(next, min, max);
    focusDayRef.current = true;
    setFocusedDay(dateKey(bounded));
    setMonth(bounded);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="app-date-trigger"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-describedby={`${triggerId}-value`}
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        disabled={disabled}
        onClick={show}
        onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); if (!open) show(); } }}
      >
        <span id={`${triggerId}-value`}>{selectedDate ? new Intl.DateTimeFormat('pt-BR').format(selectedDate) : 'Selecionar data'}</span>
        <CalendarDays aria-hidden="true" className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={popupRef} id={dialogId} role="dialog" aria-label={ariaLabel ? `Calendário: ${ariaLabel}` : 'Selecionar data'} className="app-date-popover" style={position}>
          <div className="app-date-header">
            <CalendarDays aria-hidden="true" className="h-4 w-4" />
            <span>Selecionar data</span>
            <button type="button" aria-label="Fechar calendário" onClick={close}><X aria-hidden="true" className="h-4 w-4" /></button>
          </div>
          <div className="app-date-navigation">
            <button type="button" aria-label="Mês anterior" disabled={!monthAllowed(new Date(year, monthIndex - 1, 1, 12))} onClick={() => viewMonth(new Date(year, monthIndex - 1, 1, 12))}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
            <label className="app-date-month"><span className="sr-only">Mês</span><select aria-label="Mês" value={monthIndex} onChange={(event) => viewMonth(new Date(year, Number(event.target.value), 1, 12))}>{MONTHS.map((name, index) => <option key={name} value={index} disabled={!monthAllowed(new Date(year, index, 1, 12))}>{name}</option>)}</select><ChevronDown aria-hidden="true" /></label>
            <label className="app-date-year"><span className="sr-only">Ano</span><select aria-label="Ano" value={year} onChange={(event) => {
              const nextYear = Number(event.target.value);
              const bounded = clampDate(new Date(nextYear, monthIndex, 1, 12), min, max);
              viewMonth(bounded);
            }}>{Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index).map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown aria-hidden="true" /></label>
            <button type="button" aria-label="Próximo mês" disabled={!monthAllowed(new Date(year, monthIndex + 1, 1, 12))} onClick={() => viewMonth(new Date(year, monthIndex + 1, 1, 12))}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
          </div>
          <div role="grid" aria-label={`${MONTHS[monthIndex]} de ${year}`} className="app-date-grid">
            <div role="row" className="app-date-weekdays">{WEEKDAYS.map((day) => <span key={day} role="columnheader">{day}</span>)}</div>
            {Array.from({ length: weekCount }, (_, week) => <div role="row" className="app-date-week" key={week}>
              {days.slice(week * 7, week * 7 + 7).map((date) => {
                const key = dateKey(date);
                return <div role="gridcell" aria-selected={key === value} key={key}><button
                  type="button"
                  data-date={key}
                  data-outside={date.getMonth() !== monthIndex || undefined}
                  data-today={key === today || undefined}
                  aria-label={fullDate(date)}
                  aria-current={key === today ? 'date' : undefined}
                  tabIndex={key === focusedDay ? 0 : -1}
                  disabled={isDisabled(key)}
                  onFocus={() => setFocusedDay(key)}
                  onKeyDown={(event) => moveDay(event, date)}
                  onClick={() => selectDate(key)}
                >{date.getDate()}</button></div>;
              })}
            </div>)}
          </div>
          <div className="app-date-footer">
            <button type="button" onClick={() => selectDate('')}><X aria-hidden="true" className="h-3.5 w-3.5" /> Limpar</button>
            <button type="button" className="app-date-today" disabled={isDisabled(today)} onClick={() => selectDate(today)}><RotateCcw aria-hidden="true" className="h-3.5 w-3.5" /> Hoje</button>
          </div>
        </div>, document.body,
      )}
    </>
  );
}
