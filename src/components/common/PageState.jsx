import React from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className = '', label = 'Carregando' }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-grid place-items-center', className)}>
      <LoaderCircle className="h-full w-full animate-spin" aria-hidden="true" />
    </span>
  );
}

export function LoadingState({ label = 'Carregando...', className = '', fullScreen = false }) {
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
        <Spinner className="mx-auto mb-3 h-8 w-8 text-accent" label={label} />
        <p>{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = null, title, description = '', action = null, className = '' }) {
  return (
    <div className={cn('empty-state', className)}>
      <div className="max-w-md">
        {Icon && <Icon className="mx-auto h-10 w-10 text-muted-foreground/35" aria-hidden="true" />}
        <h2 className="mt-3 text-base font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ title = 'Não foi possível carregar', description = '', onRetry = null, className = '' }) {
  return (
    <div role="alert" className={cn('empty-state border-destructive/30', className)}>
      <div className="max-w-md">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
        <h2 className="mt-3 text-base font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:bg-accent/90">
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
