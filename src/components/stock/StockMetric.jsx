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
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-active={active ? 'true' : 'false'}
      className={`metric-tile ${onClick ? 'hover:border-accent/35 hover:bg-muted/20' : ''} ${alert ? 'border-red-500/30' : low ? 'border-amber-400/40' : ''} ${active ? 'border-accent/35 bg-accent/5' : ''}`}
    >
      <span className="line-clamp-1 text-[10px] font-bold uppercase leading-3 tracking-wide text-muted-foreground sm:text-[11px] sm:leading-4">
        {label}
      </span>
      <strong
        className={`mt-1 block truncate text-lg font-black tabular-nums sm:text-xl ${valueClass}`}
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
