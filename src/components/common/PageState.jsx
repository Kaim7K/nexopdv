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
        'grid place-items-center px-4 py-7 text-center text-sm text-muted-foreground sm:px-5 sm:py-9',
        fullScreen ? 'fixed inset-0 z-[90] bg-background' : 'min-h-44',
        className,
      )}
    >
      <div>
        <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent sm:mb-3 sm:h-10 sm:w-10">
          <Spinner className="h-5 w-5 sm:h-6 sm:w-6" label={label} />
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
      className="page-shell space-y-3 sm:space-y-4"
    >
      <span className="sr-only">{label}</span>
      <div className="space-y-2">
        <div className="h-7 w-48 max-w-[66%] animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-muted/70 motion-reduce:animate-none" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-16 animate-pulse rounded-lg border border-border/80 bg-card motion-reduce:animate-none sm:h-20"
          />
        ))}
      </div>
      <div className="h-44 animate-pulse rounded-lg border border-border/80 bg-card motion-reduce:animate-none sm:h-52" />
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
          <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg border border-border bg-muted/60 text-muted-foreground sm:h-10 sm:w-10">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </span>
        )}
        <h2 className="mt-2.5 text-base font-bold sm:mt-3">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
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
        <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive sm:h-10 sm:w-10">
          <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-2.5 text-base font-bold sm:mt-3">{title}</h2>
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
            className="mt-3 min-h-10 rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground shadow-none transition hover:bg-accent/90 sm:mt-4"
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
