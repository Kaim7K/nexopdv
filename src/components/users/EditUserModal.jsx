import React, { useEffect, useState } from 'react';
import { Power, X } from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import ImageUploadField from '@/components/ImageUploadField';

export default function EditUserModal({ user, isCurrentUser = false, actorRole = 'gerente', onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    role: user.role,
    photo_url: user.photo_url || '',
    active: user.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const canChangeRole = actorRole === 'admin';
  const canChangeStatus = actorRole === 'admin' ? !isCurrentUser : user.role === 'vendedor' && !isCurrentUser;

  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, saving]);

  const save = async event => {
    event.preventDefault();
    const fullName = form.full_name.trim();
    if (!fullName) return toast.error('Informe o nome do usuário.');
    if (isCurrentUser && !form.active) return toast.error('Você não pode desativar o próprio acesso.');

    setSaving(true);
    try {
      const payload = { full_name: fullName, photo_url: form.photo_url };
      if (canChangeRole) payload.role = form.role;
      if (canChangeStatus) payload.active = form.active;
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
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()} role="presentation">
      <form onSubmit={save} className="my-auto w-full max-w-lg rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-user-title" className="text-xl font-black">Editar usuário</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <button type="button" disabled={saving} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-xl border border-border bg-muted/25 p-3">
          <ImageUploadField value={form.photo_url} onChange={value => setForm(previous => ({ ...previous, photo_url: value }))} kind="user" scopeId={user.id} label="Foto do usuário" name={form.full_name || user.email} previewClassName="h-20 w-20 rounded-full" objectFit="cover" />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">
            Nome completo <span className="text-destructive">*</span>
            <input required autoFocus value={form.full_name} onChange={event => setForm(previous => ({ ...previous, full_name: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </label>
          <label className="text-sm font-semibold">
            Perfil
            <select value={form.role} disabled={!canChangeRole} onChange={event => setForm(previous => ({ ...previous, role: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60">
              <option value="vendedor">Vendedor</option>
              <option value="gerente">Gerente</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <div>
            <span className="text-sm font-semibold">Status do acesso</span>
            <button type="button" disabled={!canChangeStatus} onClick={() => setForm(previous => ({ ...previous, active: !previous.active }))} className={`mt-1.5 flex h-11 w-full items-center justify-between rounded-xl border px-3 text-sm font-bold transition ${form.active ? 'border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted text-muted-foreground'} disabled:cursor-not-allowed disabled:opacity-60`} aria-pressed={form.active}>
              <span>{form.active ? 'Ativo' : 'Inativo'}</span>
              <Power className="h-4 w-4" />
            </button>
            {!canChangeStatus && <span className="mt-1 block text-xs text-muted-foreground">Este status não pode ser alterado pelo seu perfil.</span>}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold transition hover:bg-muted disabled:opacity-50">Cancelar</button>
          <button disabled={saving} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}
