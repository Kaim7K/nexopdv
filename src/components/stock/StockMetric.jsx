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
      className={`rounded-xl border bg-card p-2.5 text-left shadow-sm transition sm:rounded-2xl sm:p-4 ${borderClass} ${onClick ? 'hover:-translate-y-0.5 hover:shadow-md' : ''} ${active ? 'ring-2 ring-accent/25' : ''}`}
    >
      <span className="line-clamp-1 text-[11px] font-semibold text-muted-foreground sm:text-xs">
        {label}
      </span>
      <strong
        className={`mt-0.5 block text-xl font-bold tabular-nums sm:mt-1 sm:text-2xl ${valueClass}`}
      >
        {value}
      </strong>
      {hint && (
        <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:mt-1 sm:block sm:text-[11px]">
          {hint}
        </span>
      )}
    </Component>
  );
}
