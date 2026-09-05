const CASH_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const CASH_TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function normalizeCashClosingTime(value) {
  const normalized = String(value || '').slice(0, 5);
  return CASH_TIME_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeCashClosingSchedule(value) {
  if (value === undefined || value === null) return null;
  let source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return null;
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source))
    return null;

  const schedule = {};
  for (const [day, time] of Object.entries(source)) {
    if (!/^[0-6]$/.test(day)) return null;
    const normalizedTime = normalizeCashClosingTime(time);
    if (!normalizedTime) return null;
    schedule[day] = normalizedTime;
  }
  return schedule;
}

function timeInZone(date, timeZone = CASH_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date);
  return {
    hour,
    minute,
    day: WEEKDAY_INDEX[weekday],
    value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

export function cashClosingAvailability(user, now = new Date()) {
  const minimumTime = normalizeCashClosingTime(user?.cash_closing_min_time);
  const configuredSchedule = normalizeCashClosingSchedule(
    user?.cash_closing_schedule,
  );
  const canOverrideClosingTime = ['admin', 'gerente'].includes(user?.role);
  if (canOverrideClosingTime)
    return {
      enabled: false,
      minimum_time: minimumTime,
      can_close: true,
      message: '',
    };
  const enabled = Boolean(user?.cash_closing_time_enabled);
  if (!enabled)
    return {
      enabled: false,
      minimum_time: minimumTime,
      can_close: true,
      message: '',
    };

  const current = timeInZone(now);
  const usesWeeklySchedule = user?.cash_closing_schedule !== undefined;
  const scheduledTime = usesWeeklySchedule
    ? configuredSchedule?.[String(current.day)] || null
    : minimumTime;
  if (!scheduledTime)
    return {
      enabled: true,
      minimum_time: null,
      current_time: current.value,
      current_day: current.day,
      time_zone: CASH_TIME_ZONE,
      schedule: configuredSchedule || {},
      can_close: false,
      message: 'O fechamento de caixa não está liberado para hoje.',
    };

  const [minimumHour, minimumMinute] = scheduledTime.split(':').map(Number);
  const canClose = current.hour * 60 + current.minute >= minimumHour * 60 + minimumMinute;
  return {
    enabled: true,
    minimum_time: scheduledTime,
    current_time: current.value,
    current_day: current.day,
    time_zone: CASH_TIME_ZONE,
    schedule: configuredSchedule || null,
    can_close: canClose,
    message: canClose
      ? ''
      : `Este caixa só pode ser fechado a partir das ${scheduledTime} (horário de Brasília).`,
  };
}

export function cashSummaryForUser(user, summary) {
  if (!summary || user?.role !== 'vendedor') return summary;
  return { sales_count: Number(summary.sales_count || 0) };
}

export function cashSessionForUser(user, session) {
  if (!session || user?.role !== 'vendedor') return session;
  const {
    opening_amount: _openingAmount,
    closing_amount: _closingAmount,
    closing_entry: _closingEntry,
    closing_expense: _closingExpense,
    difference: _difference,
    summary: _summary,
    ...safeSession
  } = session;
  return safeSession;
}
