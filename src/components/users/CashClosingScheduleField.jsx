const WEEKDAYS = [
  ['1', 'Segunda-feira'],
  ['2', 'Terça-feira'],
  ['3', 'Quarta-feira'],
  ['4', 'Quinta-feira'],
  ['5', 'Sexta-feira'],
  ['6', 'Sábado'],
  ['0', 'Domingo'],
];

export const defaultCashClosingSchedule = (time = '19:00') =>
  Object.fromEntries(WEEKDAYS.map(([day]) => [day, time]));

export function cashClosingScheduleFromUser(user) {
  const schedule = user?.cash_closing_schedule;
  if (
    schedule &&
    typeof schedule === 'object' &&
    !Array.isArray(schedule) &&
    Object.keys(schedule).length
  )
    return { ...schedule };
  return defaultCashClosingSchedule(user?.cash_closing_min_time || '19:00');
}

export default function CashClosingScheduleField({ value, onChange }) {
  const schedule = value || {};

  const toggleDay = (day, checked) => {
    const next = { ...schedule };
    if (checked) next[day] = next[day] || '19:00';
    else delete next[day];
    onChange(next);
  };

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs text-muted-foreground">
        Selecione os dias permitidos e defina o horário mínimo de cada dia.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {WEEKDAYS.map(([day, label]) => {
          const selected = Object.hasOwn(schedule, day);
          return (
            <div
              key={day}
              className={`grid grid-cols-[1fr_7.5rem] items-center gap-2 rounded-lg border px-2.5 py-2 ${selected ? 'border-accent/35 bg-accent/5' : 'border-border bg-background'}`}
            >
              <label className="flex min-w-0 cursor-pointer items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => toggleDay(day, event.target.checked)}
                  className="h-4 w-4 flex-none accent-[var(--market-primary)]"
                />
                <span className="truncate">{label}</span>
              </label>
              <input
                type="time"
                aria-label={`Horário mínimo de ${label}`}
                required={selected}
                disabled={!selected}
                value={schedule[day] || '19:00'}
                onChange={(event) =>
                  onChange({ ...schedule, [day]: event.target.value })
                }
                className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-45"
              />
            </div>
          );
        })}
      </div>
      {!Object.keys(schedule).length && (
        <p className="text-xs font-semibold text-destructive">
          Selecione pelo menos um dia.
        </p>
      )}
    </div>
  );
}
