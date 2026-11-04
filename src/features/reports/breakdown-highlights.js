const NEUTRAL = 'border-border bg-muted/15';
const REGULAR = 'border-border bg-card';
const BEST = 'border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100';
const WORST = 'border-red-500/35 bg-red-500/10 text-red-950 dark:text-red-100';

/** Compute the shared bounds once, retaining the original colors and tie rules. */
export function buildBreakdownHighlights(rows, metric) {
  const values = rows.map(row => Number(row[metric] || 0));
  let best = -Infinity;
  let worst = Infinity;
  for (const value of values) {
    best = Math.max(best, value);
    worst = Math.min(worst, value);
  }
  return new Map(rows.map((row, index) => {
    const value = values[index];
    const tone = best === worst ? NEUTRAL
      : value === best ? BEST : value === worst ? WORST : REGULAR;
    return [row, tone];
  }));
}
