import React, { useEffect, useState } from 'react';
import { Landmark, Loader2, Users, X } from 'lucide-react';
import { EmptyState } from '@/components/common/PageState';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

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
    <div className="sticky -bottom-4 -mx-4 flex flex-col-reverse gap-2 border-t border-border/80 bg-card/95 px-4 pb-1 pt-3 backdrop-blur sm:-bottom-5 sm:-mx-5 sm:flex-row sm:justify-end sm:px-5">
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
export function FinanceModal({ title, description = '', onClose, children, wide = false, disabled = false }) {
  const modalRef = useModalBehavior({ onClose, disabled });
  return (
    <div
      className="fixed inset-0 z-[80] grid items-end bg-slate-950/70 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && !disabled && onClose()}
    >
      <section
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-modal-title"
        aria-describedby={description ? 'finance-modal-description' : undefined}
        className={`flex max-h-dvh w-full flex-col overflow-hidden rounded-t-[20px] border border-border/80 bg-card shadow-[0_-20px_70px_rgba(0,0,0,0.28)] sm:max-h-[92dvh] sm:rounded-[20px] sm:shadow-[0_28px_90px_rgba(0,0,0,0.35)] ${wide ? 'sm:max-w-5xl' : 'sm:max-w-xl'}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border/80 bg-muted/15 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
            <h2 id="finance-modal-title" className="text-base font-bold sm:text-lg">{title}</h2>
            {description && (
              <p id="finance-modal-description" className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            aria-label="Fechar"
            className="grid h-9 w-9 flex-none place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto bg-muted/10 p-4 sm:p-5">{children}</div>
      </section>
    </div>
  );
}

export function CancellationModal({
  open,
  title,
  description,
  subject,
  saving = false,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open, subject]);
  if (!open) return null;
  const valid = reason.trim().length >= 5;
  return (
    <FinanceModal
      title={title}
      description={description}
      onClose={onClose}
      disabled={saving}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !saving) onConfirm(reason.trim());
        }}
        className="space-y-4"
      >
        {subject && (
          <div className="rounded-xl border border-border bg-muted/25 px-3 py-2.5 text-sm font-semibold">
            {subject}
          </div>
        )}
        <label className="block text-sm font-bold">
          Motivo do cancelamento
          <textarea
            autoFocus
            required
            minLength={5}
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex.: lançamento duplicado ou compra devolvida ao fornecedor"
            className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Escreva pelo menos 5 caracteres para manter uma auditoria clara.
          </span>
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50">
            Voltar
          </button>
          <button type="submit" disabled={!valid || saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-bold text-destructive-foreground disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </form>
    </FinanceModal>
  );
}
