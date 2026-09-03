export const brazilMinutesNow = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  return (
    Number(parts.find((part) => part.type === 'hour')?.value || 0) * 60 +
    Number(parts.find((part) => part.type === 'minute')?.value || 0)
  );
};

export const isCashClosingTimeBlocked = (closingTime, now = new Date()) => {
  if (!closingTime?.enabled) return false;

  const minimumTime = closingTime.minimum_time || '';
  if (!/^\d{2}:\d{2}$/.test(minimumTime)) {
    return closingTime.can_close === false;
  }

  const minimumMinutes =
    Number(minimumTime.slice(0, 2)) * 60 + Number(minimumTime.slice(3, 5));
  return brazilMinutesNow(now) < minimumMinutes;
};

export const cashClosingTimeMessage = (closingTime) =>
  closingTime?.message ||
  `O caixa só pode ser fechado a partir das ${closingTime?.minimum_time || 'horário configurado'} (horário de Brasília).`;
