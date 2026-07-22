import React from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function normalizeError(value) {
  if (!value) return { message: '', requestId: '' };
  if (typeof value === 'string') return { message: value, requestId: '' };
  return {
    message:
      value.message ||
      value.data?.message ||
      'Algo saiu do esperado. Tente novamente em instantes.',
    requestId: value.requestId || value.data?.requestId || '',
  };
}

export function Spinner({ className = '', label = 'Carregando' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-grid place-items-center', className)}
    >
      <LoaderCircle className="h-full w-full animate-spin" aria-hidden="true" />
    </span>
  );
}

export function LoadingState({
  label = 'Carregando...',
  className = '',
  fullScreen = false,
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'grid place-items-center px-5 py-12 text-center text-sm text-muted-foreground',
        fullScreen ? 'fixed inset-0 z-[90] bg-background' : 'min-h-56',
        className,
      )}
    >
      <div>
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-accent/10 text-accent">
          <Spinner className="h-6 w-6" label={label} />
        </span>
        <p className="font-semibold">{label}</p>
      </div>
    </div>
  );
}

export function PageSkeleton({ label = 'Abrindo a página...' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className="page-shell space-y-5"
    >
      <span className="sr-only">{label}</span>
      <div className="space-y-2">
        <div className="h-7 w-48 max-w-[66%] animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-muted/70 motion-reduce:animate-none" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-lg border border-border/80 bg-card shadow-sm motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-border/80 bg-card shadow-sm motion-reduce:animate-none" />
    </div>
  );
}

export function EmptyState({
  icon: Icon = null,
  title,
  description = '',
  action = null,
  className = '',
}) {
  return (
    <div className={cn('empty-state', className)}>
      <div className="max-w-md">
        {Icon && (
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
        <h2 className="mt-4 text-base font-bold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({
  title = 'Não foi possível carregar',
  description = '',
  onRetry = null,
  className = '',
}) {
  const error = normalizeError(description);
  return (
    <div
      role="alert"
      className={cn('empty-state border-destructive/30', className)}
    >
      <div className="max-w-md">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-bold">{title}</h2>
        {error.message && (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {error.message}
          </p>
        )}
        {error.requestId && (
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            Código de suporte: {error.requestId}
          </p>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 min-h-11 rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground shadow-sm transition hover:-translate-y-px hover:bg-accent/90 active:translate-y-0"
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
