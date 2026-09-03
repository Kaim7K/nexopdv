const CASH_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const CASH_TIME_ZONE = 'America/Sao_Paulo';

export function normalizeCashClosingTime(value) {
  const normalized = String(value || '').slice(0, 5);
  return CASH_TIME_PATTERN.test(normalized) ? normalized : null;
}

function timeInZone(date, timeZone = CASH_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return { hour, minute, value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

export function cashClosingAvailability(user, now = new Date()) {
  const minimumTime = normalizeCashClosingTime(user?.cash_closing_min_time);
  const enabled = Boolean(user?.cash_closing_time_enabled && minimumTime);
  if (!enabled)
    return {
      enabled: false,
      minimum_time: minimumTime,
      can_close: true,
      message: '',
    };

  const current = timeInZone(now);
  const [minimumHour, minimumMinute] = minimumTime.split(':').map(Number);
  const canClose = current.hour * 60 + current.minute >= minimumHour * 60 + minimumMinute;
  return {
    enabled: true,
    minimum_time: minimumTime,
    current_time: current.value,
    time_zone: CASH_TIME_ZONE,
    can_close: canClose,
    message: canClose
      ? ''
      : `Este caixa só pode ser fechado a partir das ${minimumTime} (horário de Brasília).`,
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
