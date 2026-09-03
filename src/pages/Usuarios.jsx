import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { Mail, Pencil, Search, Shield, Trash2, User, UserPlus, Users, X } from 'lucide-react';
import EditUserModal from '@/components/users/EditUserModal';
import ImageUploadField from '@/components/ImageUploadField';
import { useConfirm } from '@/components/common/ConfirmProvider';
import { useModalBehavior } from '@/hooks/use-modal-behavior';
import { ErrorState } from '@/components/common/PageState';
import { PageHeader } from '@/components/common/AppShell';

const EMPTY_FORM = {
  full_name: '',
  email: '',
  password: '',
  role: 'vendedor',
  photo_url: '',
  cash_closing_time_enabled: false,
  cash_closing_min_time: '19:00',
};

const ROLE_LABELS = {
  vendedor: 'Vendedor',
  gerente: 'Gerente',
  admin: 'Administrador',
};

export default function Usuarios() {
  const confirm = useConfirm();
  const { user } = /** @type {any} */ (useOutletContext());
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [form, setForm] = useState(EMPTY_FORM);
  const createModalRef = useModalBehavior({ active: showCreate, disabled: saving, onClose: () => setShowCreate(false) });

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      setUsers(await nexoApi.entities.User.list());
    } catch (error) {
      setLoadError(error.message || 'Não foi possível carregar os usuários.');
      toast.error(error.message || 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showCreate) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape' && !saving) setShowCreate(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showCreate, saving]);

  const filteredUsers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter(item => (
      String(item.full_name || '').toLowerCase().includes(query)
      || String(item.email || '').toLowerCase().includes(query)
      || String(ROLE_LABELS[item.role] || item.role).toLowerCase().includes(query)
    ));
  }, [users, deferredSearch]);

  const removeUser = async item => {
    if (item.id === user.id || deletingId) return;
    const confirmed = await confirm({
      title: `Excluir “${item.full_name || item.email}”?`,
      description: 'O acesso será revogado imediatamente. O histórico de vendas e a auditoria permanecerão preservados.',
      confirmLabel: 'Excluir usuário',
      tone: 'destructive',
    });
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      await nexoApi.entities.User.delete(item.id);
      setUsers(current => current.filter(candidate => candidate.id !== item.id));
      if (edit?.id === item.id) setEdit(null);
      toast.success('Usuário excluído.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível excluir o usuário.');
    } finally {
      setDeletingId(null);
    }
  };

  const create = async event => {
    event.preventDefault();
    const payload = {
      ...form,
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
    };
    if (!payload.full_name) return toast.error('Informe o nome do funcionário.');
    if (payload.password.length < 8) return toast.error('A senha deve ter ao menos 8 caracteres.');

    setSaving(true);
    try {
      const created = await nexoApi.users.create(payload);
      setUsers(current => [...current, { ...created, active: true }].sort((first, second) => String(first.full_name || first.email).localeCompare(String(second.full_name || second.email), 'pt-BR')));
      toast.success('Funcionário criado.');
      setShowCreate(false);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error(error.message || 'Não foi possível criar o funcionário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell !max-w-6xl">
      <PageHeader
        icon={Users}
        eyebrow="Equipe e acessos"
        title="Usuários"
        actions={
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-bold text-accent-foreground shadow-sm transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-10 sm:px-4"
        >
          <UserPlus className="h-4 w-4" /> Novo funcionário
        </button>
        }
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">Pesquisar usuários</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar por nome, e-mail ou perfil"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-10 sm:pl-10 sm:pr-4"
          />
        </label>
        <div className="text-xs font-semibold text-muted-foreground">
          {filteredUsers.length} de {users.length} funcionários
        </div>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" aria-busy="true" className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground sm:p-6">
          <div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-4 border-muted border-t-accent" />
          Carregando usuários...
        </div>
      ) : loadError && !users.length ? (
        <ErrorState description={loadError} onRetry={load} />
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-4 text-center">
          <Users className="mx-auto h-7 w-7 text-muted-foreground/30" />
          <h2 className="mt-2 text-sm font-bold">Nenhum usuário encontrado</h2>
          <p className="mt-1 text-xs text-muted-foreground">Revise a pesquisa ou cadastre um funcionário.</p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredUsers.map(item => {
            const isActive = item.active !== false;
            const isManager = ['admin', 'gerente'].includes(item.role);
            const canEdit = user.role === 'admin' || item.role === 'vendedor' || item.id === user.id;
            const canDelete = item.id !== user.id && (user.role === 'admin' || (user.role === 'gerente' && item.role === 'vendedor'));
            return (
              <article key={item.id} className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-3 shadow-[0_14px_34px_rgba(15,23,42,0.045)] transition hover:border-accent/35 hover:bg-muted/10 sm:p-3.5">
                <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                  <div className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-lg bg-secondary text-secondary-foreground sm:h-11 sm:w-11">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={`Foto de ${item.full_name || item.email}`} className="h-full w-full object-cover" loading="lazy" />
                    ) : isManager ? <Shield className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-bold">{item.full_name || item.email}</h2>
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 flex-none" /> <span className="min-w-0 truncate">{item.email}</span>
                        </div>
                      </div>
                      <span className={`flex-none rounded-full px-2 py-1 text-[11px] font-bold ${isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                        {isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 sm:mt-3">
                      <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold capitalize text-secondary-foreground">
                        {ROLE_LABELS[item.role] || item.role}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setEdit(item)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Editar ${item.full_name || item.email}`}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                        ) : <span className="text-xs text-muted-foreground">Acesso protegido</span>}
                        {canDelete && (
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => removeUser(item)}
                            className="grid h-9 w-9 place-items-center rounded-lg border border-destructive/25 text-destructive transition hover:bg-destructive/10 disabled:cursor-wait disabled:opacity-50"
                            aria-label={`Excluir ${item.full_name || item.email}`}
                            title="Excluir usuário"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {edit && (
        <EditUserModal
          user={edit}
          isCurrentUser={edit.id === user?.id}
          actorRole={user?.role}
          onClose={() => setEdit(null)}
          onSaved={load}
        />
      )}

      {showCreate && (
        <div
          className="modal-overlay"
          onMouseDown={event => event.target === event.currentTarget && !saving && setShowCreate(false)}
          role="presentation"
        >
          <form
            ref={createModalRef}
            onSubmit={create}
            className="modal-panel sm:max-w-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="create-user-title" className="modal-title">Novo funcionário</h2>
              </div>
              <button type="button" disabled={saving} onClick={() => setShowCreate(false)} className="modal-icon-button" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="modal-body grid gap-2.5 sm:grid-cols-2">
              <label className="text-sm font-semibold sm:col-span-2">
                Nome completo <span className="text-destructive">*</span>
                <input required autoFocus autoComplete="name" value={form.full_name} onChange={event => setForm(previous => ({ ...previous, full_name: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                E-mail <span className="text-destructive">*</span>
                <input required type="email" autoComplete="email" value={form.email} onChange={event => setForm(previous => ({ ...previous, email: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              </label>
              <label className="text-sm font-semibold">
                Senha inicial <span className="text-destructive">*</span>
                <input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={event => setForm(previous => ({ ...previous, password: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              </label>
              <label className="text-sm font-semibold">
                Perfil
                <select value={form.role} onChange={event => setForm(previous => ({ ...previous, role: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
                  <option value="vendedor">Vendedor</option>
                  {user.role === 'admin' && <option value="gerente">Gerente</option>}
                  {user.role === 'admin' && <option value="admin">Administrador</option>}
                </select>
              </label>
              <div className="rounded-lg border border-border bg-muted/20 p-2 sm:col-span-2">
              <ImageUploadField
                value={form.photo_url}
                onChange={value => setForm(previous => ({ ...previous, photo_url: value }))}
                kind="user"
                scopeId={user?.market_id || user?.id}
                label="Foto do usuário"
                name={form.full_name || form.email || 'usuario'}
                previewClassName="h-16 w-16 rounded-full"
                objectFit="cover"
              />
              </div>
              <fieldset className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                <label className="flex cursor-pointer items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-bold">Horário mínimo para fechar o caixa</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Use o horário de Brasília para impedir fechamentos antecipados.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.cash_closing_time_enabled}
                    onChange={event => setForm(previous => ({ ...previous, cash_closing_time_enabled: event.target.checked }))}
                    className="mt-1 h-4 w-4 accent-[var(--market-primary)]"
                  />
                </label>
                {form.cash_closing_time_enabled && (
                  <label className="mt-3 block text-sm font-semibold">
                    Liberar fechamento a partir de
                    <input
                      required
                      type="time"
                      value={form.cash_closing_min_time}
                      onChange={event => setForm(previous => ({ ...previous, cash_closing_min_time: event.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                )}
              </fieldset>
            </div>

            <div className="modal-footer">
              <div className="modal-actions">
              <button type="button" disabled={saving} onClick={() => setShowCreate(false)} className="modal-button border border-border hover:bg-muted disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={saving} className="modal-button modal-actions-primary bg-accent text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? 'Criando...' : 'Criar funcionário'}
              </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
