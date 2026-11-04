export function rangePreset(key, now = new Date()) {
  const end = new Date(now),
    start = new Date(end);
  if (key === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }
  if (key === '7days') start.setDate(start.getDate() - 6);
  if (key === 'month') start.setDate(1);
  if (key === 'previous') {
    start.setMonth(start.getMonth() - 1, 1);
    end.setDate(0);
  }
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}
