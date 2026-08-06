import React from 'react';

const toneClasses = {
  accent: 'border-accent/20 bg-accent/10 text-accent',
  orange: 'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  red: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  blue: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  muted: 'border-border bg-muted text-muted-foreground',
};

export function PageHeader({
  icon: Icon = null,
  eyebrow,
  title,
  description,
  actions = null,
  tone = 'accent',
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        {eyebrow && (
          <div
            className={`mb-1 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold text-current sm:mb-1.5 sm:px-3 sm:py-1 sm:text-xs ${toneClasses[tone] || toneClasses.accent}`}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{eyebrow}</span>
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}

export function FilterPanel({ children, className = '', ...props }) {
  return (
    <section
      className={`filter-surface mb-2.5 sm:mb-3 ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint = '',
  icon: Icon,
  tone = 'default',
  active = false,
  onClick = null,
}) {
  const toneMap = {
    default: 'text-foreground',
    accent: 'text-accent',
    orange: 'text-orange-600 dark:text-orange-300',
    green: 'text-emerald-700 dark:text-emerald-300',
    red: 'text-red-600 dark:text-red-300',
  };
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-active={active ? 'true' : 'false'}
      className={`metric-tile ${toneMap[tone] || toneMap.default} ${onClick ? 'hover:border-accent/35 hover:bg-muted/20' : ''} ${active ? 'border-accent/35 bg-accent/5' : ''}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="line-clamp-2 text-[10px] font-bold uppercase leading-3 tracking-wide text-muted-foreground sm:text-[11px] sm:leading-4">
          {label}
        </span>
        {Icon && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground sm:h-7 sm:w-7">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <strong className="mt-1 block truncate text-base font-black tabular-nums sm:text-lg xl:text-xl">
        {value}
      </strong>
      {hint && (
        <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:block sm:text-[11px]">
          {hint}
        </span>
      )}
    </Component>
  );
}

export function StatusBadge({ children, tone = 'muted', className = '' }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-bold sm:px-2.5 sm:py-1 sm:text-xs ${toneClasses[tone] || toneClasses.muted} ${className}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
