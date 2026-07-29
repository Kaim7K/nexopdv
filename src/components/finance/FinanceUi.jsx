import React, { useEffect } from 'react';
import { Loader2, Users, X } from 'lucide-react';
import { EmptyState } from '@/components/common/PageState';

export function ReferenceCards({ items = [], empty, render }) {
  if (!items.length) return <EmptyState icon={Users} title={empty} />;
  return (
    <div className="grid content-start gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.id}
          className={`surface-card p-4 ${!item.active ? 'opacity-60' : ''}`}
        >
          {render(item)}
        </article>
      ))}
    </div>
  );
}
export function Field({ label, children }) {
  return (
    <label className="block text-xs font-bold text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
export function ModalActions({ saving, onClose, label = 'Salvar' }) {
  return (
    <div className="sticky -bottom-5 flex flex-col-reverse gap-2 border-t border-border bg-card pt-4 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </button>
    </div>
  );
}
export function FinanceModal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const close = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = old;
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[80] grid items-end bg-black/55 p-0 sm:place-items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-modal-title"
        className={`max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-2xl sm:rounded-2xl sm:p-5 ${wide ? 'sm:max-w-5xl' : 'sm:max-w-2xl'}`}
      >
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 id="finance-modal-title" className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
