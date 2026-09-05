import React, { useState } from 'react';
import { Power, X } from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import ImageUploadField from '@/components/ImageUploadField';
import { useModalBehavior } from '@/hooks/use-modal-behavior';
import CashClosingScheduleField, { cashClosingScheduleFromUser } from '@/components/users/CashClosingScheduleField';

export default function EditUserModal({ user, isCurrentUser = false, actorRole = 'gerente', onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    role: user.role,
    photo_url: user.photo_url || '',
    active: user.active !== false,
    cash_closing_time_enabled: Boolean(user.cash_closing_time_enabled),
    cash_closing_schedule: cashClosingScheduleFromUser(user),
  });
  const [saving, setSaving] = useState(false);
  const canChangeRole = actorRole === 'admin';
  const canChangeStatus = actorRole === 'admin' ? !isCurrentUser : user.role === 'vendedor' && !isCurrentUser;
  const modalRef = useModalBehavior({ onClose, disabled: saving });

  const save = async event => {
    event.preventDefault();
    const fullName = form.full_name.trim();
    if (!fullName) return toast.error('Informe o nome do usuário.');
    if (isCurrentUser && !form.active) return toast.error('Você não pode desativar o próprio acesso.');
    if (
      form.cash_closing_time_enabled &&
      !Object.keys(form.cash_closing_schedule || {}).length
    )
      return toast.error('Selecione ao menos um dia para o fechamento.');

    setSaving(true);
    try {
      const payload = { full_name: fullName, photo_url: form.photo_url };
      if (canChangeRole) payload.role = form.role;
      if (canChangeStatus) payload.active = form.active;
      payload.cash_closing_time_enabled = form.cash_closing_time_enabled;
      payload.cash_closing_schedule = form.cash_closing_schedule;
      await nexoApi.entities.User.update(user.id, payload);
      toast.success('Usuário atualizado.');
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Não foi possível atualizar o usuário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()} role="presentation">
      <form ref={modalRef} onSubmit={save} className="modal-panel sm:max-w-lg" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
        <div className="modal-header">
          <div>
            <h2 id="edit-user-title" className="modal-title">Editar usuário</h2>
            <p className="modal-subtitle truncate">{user.email}</p>
          </div>
          <button type="button" disabled={saving} onClick={onClose} className="modal-icon-button" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="modal-body space-y-3">
        <div className="rounded-lg border border-border bg-muted/25 p-2.5 sm:p-3">
          <ImageUploadField value={form.photo_url} onChange={value => setForm(previous => ({ ...previous, photo_url: value }))} kind="user" scopeId={user.id} label="Foto do usuário" name={form.full_name || user.email} previewClassName="h-16 w-16 rounded-full sm:h-20 sm:w-20" objectFit="cover" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">
            Nome completo <span className="text-destructive">*</span>
            <input required autoFocus value={form.full_name} onChange={event => setForm(previous => ({ ...previous, full_name: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-11" />
          </label>
          <label className="text-sm font-semibold">
            Perfil
            <select value={form.role} disabled={!canChangeRole} onChange={event => setForm(previous => ({ ...previous, role: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 sm:h-11">
              <option value="vendedor">Vendedor</option>
              <option value="gerente">Gerente</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <div>
            <span className="text-sm font-semibold">Status do acesso</span>
            <button type="button" disabled={!canChangeStatus} onClick={() => setForm(previous => ({ ...previous, active: !previous.active }))} className={`mt-1.5 flex h-10 w-full items-center justify-between rounded-xl border px-3 text-sm font-bold transition sm:h-11 ${form.active ? 'border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted text-muted-foreground'} disabled:cursor-not-allowed disabled:opacity-60`} aria-pressed={form.active}>
              <span>{form.active ? 'Ativo' : 'Inativo'}</span>
              <Power className="h-4 w-4" />
            </button>
            {!canChangeStatus && <span className="mt-1 block text-xs text-muted-foreground">Este status não pode ser alterado pelo seu perfil.</span>}
          </div>
        </div>
        <fieldset className={`${form.role === 'vendedor' ? '' : 'hidden'} rounded-xl border border-border bg-muted/20 p-3`}>
          <label className="flex cursor-pointer items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-bold">Agenda de fechamento do caixa</span>
              <span className="mt-1 block text-xs text-muted-foreground">Escolha os dias permitidos e os horários mínimos no horário de Brasília.</span>
            </span>
            <input
              type="checkbox"
              checked={form.cash_closing_time_enabled}
              onChange={event => setForm(previous => ({ ...previous, cash_closing_time_enabled: event.target.checked }))}
              className="mt-1 h-4 w-4 accent-[var(--market-primary)]"
            />
          </label>
          {form.cash_closing_time_enabled && (
            <CashClosingScheduleField
              value={form.cash_closing_schedule}
              onChange={cash_closing_schedule => setForm(previous => ({ ...previous, cash_closing_schedule }))}
            />
          )}
        </fieldset>
        </div>

        <div className="modal-footer">
          <div className="modal-actions">
          <button type="button" disabled={saving} onClick={onClose} className="modal-button border border-border hover:bg-muted">Cancelar</button>
          <button type="submit" disabled={saving} className="modal-button modal-actions-primary bg-accent text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
          </div>
        </div>
      </form>
    </div>
  );
}
