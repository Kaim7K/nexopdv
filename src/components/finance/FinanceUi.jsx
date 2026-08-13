import React, { useEffect, useState } from 'react';
import { Landmark, Loader2, Users, X } from 'lucide-react';
import { EmptyState } from '@/components/common/PageState';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

export function ReferenceCards({ items = [], empty, render }) {
  if (!items.length) return <EmptyState icon={Users} title={empty} />;
  return (
    <div className="grid content-start gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.id}
          className={`surface-card p-3 ${!item.active ? 'opacity-60' : ''}`}
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
    <div className="modal-footer -mx-3 -mb-3 mt-3 sm:-mx-4 sm:-mb-4">
      <div className="modal-actions">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="modal-button border border-border hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="modal-button modal-actions-primary bg-accent text-accent-foreground disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {label}
        </button>
      </div>
    </div>
  );
}
export function FinanceModal({ title, description = '', onClose, children, wide = false, disabled = false }) {
  const modalRef = useModalBehavior({ onClose, disabled });
  return (
    <div
      className="modal-overlay z-[80] bg-slate-950/55"
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
        className={`modal-panel ${wide ? 'sm:max-w-5xl' : 'sm:max-w-xl'}`}
      >
        <header className="modal-header">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="finance-modal-title" className="modal-title">{title}</h2>
              {description && (
                <p id="finance-modal-description" className="modal-subtitle">
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
            className="modal-icon-button border border-transparent hover:border-border"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
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
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving} className="modal-button border border-border hover:bg-muted disabled:opacity-50">
            Voltar
          </button>
          <button type="submit" disabled={!valid || saving} className="modal-button modal-actions-primary bg-destructive text-destructive-foreground disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </form>
    </FinanceModal>
  );
}
