import React from 'react';

const toneClasses = {
  accent: 'bg-accent/10 text-accent',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  red: 'bg-red-500/10 text-red-700 dark:text-red-300',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  muted: 'bg-muted text-muted-foreground',
};

export function PageHeader({
  icon: Icon,
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
            className={`mb-1.5 inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold text-current sm:mb-2 sm:text-xs ${toneClasses[tone] || toneClasses.accent}`}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{eyebrow}</span>
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

export function FilterPanel({ children, className = '', ...props }) {
  return (
    <section
      className={`mb-3 rounded-xl border border-border bg-card p-2.5 shadow-sm sm:mb-4 sm:rounded-2xl sm:p-3 ${className}`}
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
  onClick,
}) {
  const toneMap = {
    default: 'border-border text-foreground',
    accent: 'border-accent/35 text-accent',
    orange: 'border-orange-400/45 text-orange-600 dark:text-orange-300',
    green: 'border-emerald-400/40 text-emerald-700 dark:text-emerald-300',
    red: 'border-red-500/35 text-red-600 dark:text-red-300',
  };
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`min-w-0 rounded-xl border bg-card p-2.5 text-left shadow-sm transition sm:rounded-2xl sm:p-4 ${toneMap[tone] || toneMap.default} ${onClick ? 'hover:-translate-y-0.5 hover:shadow-md' : ''} ${active ? 'ring-2 ring-accent/25' : ''}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="line-clamp-2 text-[10px] font-semibold leading-3 text-muted-foreground sm:text-xs sm:leading-4">
          {label}
        </span>
        {Icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground sm:h-9 sm:w-9 sm:rounded-xl">
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
        )}
      </div>
      <strong className="mt-0.5 block truncate text-base font-black tabular-nums sm:mt-1 sm:text-2xl">
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

export function StatusBadge({ children, tone = 'muted', className = '' }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-bold sm:px-2.5 sm:py-1 sm:text-xs ${toneClasses[tone] || toneClasses.muted} ${className}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
