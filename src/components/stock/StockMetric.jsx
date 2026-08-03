import React from 'react';

export default function StockMetric({
  label,
  value,
  alert = false,
  low = false,
  pending = false,
  active = false,
  hint = '',
  onClick = undefined,
}) {
  const valueClass = alert
    ? 'text-red-600 dark:text-red-300'
    : low || pending
      ? 'text-amber-600 dark:text-amber-300'
      : 'text-foreground';
  const borderClass = alert
    ? 'border-red-500/35'
    : low
      ? 'border-amber-400/45'
      : 'border-border';
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`min-w-0 rounded-xl border bg-card p-2 text-left shadow-sm shadow-black/[0.025] transition sm:p-2.5 ${borderClass} ${onClick ? 'hover:border-accent/40 hover:bg-muted/20' : ''} ${active ? 'ring-2 ring-accent/25' : ''}`}
    >
      <span className="line-clamp-1 text-[10px] font-semibold leading-3 text-muted-foreground sm:text-[11px] sm:leading-4">
        {label}
      </span>
      <strong
        className={`mt-0.5 block truncate text-lg font-bold tabular-nums sm:text-xl ${valueClass}`}
      >
        {value}
      </strong>
      {hint && (
        <span className="mt-0.5 line-clamp-1 text-[10px] leading-3 text-muted-foreground sm:block sm:text-[11px] sm:leading-4">
          {hint}
        </span>
      )}
    </Component>
  );
}
