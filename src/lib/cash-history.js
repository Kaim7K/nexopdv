// Classify the existing history difference without changing financial values.
export function cashClosingSituation(item) {
  if (item.status !== 'fechado' || item.difference == null || item.difference === '')
    return '';
  const difference = Number(item.difference);
  if (!Number.isFinite(difference)) return '';
  if (Math.abs(difference) < 0.005) return 'conferido';
  return difference > 0 ? 'sobra' : 'falta';
}

export function matchesCashClosingSituation(item, situation) {
  return !situation || cashClosingSituation(item) === situation;
}
