import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { Mail, Pencil, Search, Shield, Trash2, User, UserPlus, Users, X } from 'lucide-react';
import EditUserModal from '@/components/users/EditUserModal';
import ImageUploadField from '@/components/ImageUploadField';

const EMPTY_FORM = {
  full_name: '',
  email: '',
  password: '',
  role: 'vendedor',
  photo_url: '',
};

const ROLE_LABELS = {
  vendedor: 'Vendedor',
  gerente: 'Gerente',
  admin: 'Administrador',
};

export default function Usuarios() {
  const { user } = /** @type {any} */ (useOutletContext());
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await nexoApi.entities.User.list());
    } catch (error) {
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
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(item => (
      String(item.full_name || '').toLowerCase().includes(query)
      || String(item.email || '').toLowerCase().includes(query)
      || String(ROLE_LABELS[item.role] || item.role).toLowerCase().includes(query)
    ));
  }, [users, search]);

  const removeUser = async item => {
    if (item.id === user.id || deletingId) return;
    const confirmed = window.confirm(`Excluir o usuário "${item.full_name || item.email}"? O acesso será removido e o histórico de vendas será preservado.`);
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
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <Users className="h-3.5 w-3.5" /> Equipe e acessos
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie funcionários, perfis e acesso ao sistema.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground shadow-sm transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UserPlus className="h-4 w-4" /> Novo funcionário
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">Pesquisar usuários</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar por nome, e-mail ou perfil"
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <div className="text-sm font-medium text-muted-foreground">
          {filteredUsers.length} de {users.length} funcionários
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
          Carregando usuários...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h2 className="mt-3 font-bold">Nenhum usuário encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">Revise a pesquisa ou cadastre um novo funcionário.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredUsers.map(item => {
            const isActive = item.active !== false;
            const isManager = ['admin', 'gerente'].includes(item.role);
            const canEdit = user.role === 'admin' || item.role === 'vendedor' || item.id === user.id;
            const canDelete = item.id !== user.id && (user.role === 'admin' || (user.role === 'gerente' && item.role === 'vendedor'));
            return (
              <article key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-2xl bg-secondary text-secondary-foreground">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={`Foto de ${item.full_name || item.email}`} className="h-full w-full object-cover" loading="lazy" />
                    ) : isManager ? <Shield className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-bold">{item.full_name || item.email}</h2>
                        <div className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 flex-none" /> {item.email}
                        </div>
                      </div>
                      <span className={`flex-none rounded-full px-2 py-1 text-[11px] font-bold ${isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                        {isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
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
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={event => event.target === event.currentTarget && !saving && setShowCreate(false)}
          role="presentation"
        >
          <form
            onSubmit={create}
            className="my-auto w-full max-w-lg rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="create-user-title" className="text-xl font-black">Novo funcionário</h2>
                <p className="mt-1 text-sm text-muted-foreground">Crie o acesso e defina o perfil inicial.</p>
              </div>
              <button type="button" disabled={saving} onClick={() => setShowCreate(false)} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold sm:col-span-2">
                Nome completo <span className="text-destructive">*</span>
                <input required autoFocus autoComplete="name" value={form.full_name} onChange={event => setForm(previous => ({ ...previous, full_name: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                E-mail <span className="text-destructive">*</span>
                <input required type="email" autoComplete="email" value={form.email} onChange={event => setForm(previous => ({ ...previous, email: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              </label>
              <label className="text-sm font-semibold">
                Senha inicial <span className="text-destructive">*</span>
                <input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={event => setForm(previous => ({ ...previous, password: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">Mínimo de 8 caracteres.</span>
              </label>
              <label className="text-sm font-semibold">
                Perfil
                <select value={form.role} onChange={event => setForm(previous => ({ ...previous, role: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
                  <option value="vendedor">Vendedor</option>
                  {user.role === 'admin' && <option value="gerente">Gerente</option>}
                  {user.role === 'admin' && <option value="admin">Administrador</option>}
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-muted/25 p-3">
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

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={saving} onClick={() => setShowCreate(false)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold transition hover:bg-muted disabled:opacity-50">Cancelar</button>
              <button disabled={saving} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? 'Criando...' : 'Criar funcionário'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
