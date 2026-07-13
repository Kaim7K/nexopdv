import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import {
  Eye,
  Loader2,
  LockKeyhole,
  Plus,
  Save,
  Search,
  Store,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ImageUploadField from '@/components/ImageUploadField';
import { useModalBehavior } from '@/hooks/use-modal-behavior';
import { ErrorState } from '@/components/common/PageState';
import { useConfirm } from '@/components/common/ConfirmProvider';
import ModuleSwitch from '@/components/admin/ModuleSwitch';
import {
  MARKET_FEATURE_KEYS,
  MARKET_FEATURES,
  MARKET_MODULE_KEYS,
  MARKET_MODULES,
} from '@/lib/market-modules';

const EMPTY = {
  name: '',
  slug: '',
  logo_url: '',
  admin_name: '',
  admin_email: '',
  admin_password: '',
  primary_color: '#16a06a',
  secondary_color: '#0f5132',
  require_cash_register: false,
  plan_id: '',
  status: 'teste',
};

export default function AdminMercados() {
  const confirm = useConfirm();
  const { user } = /** @type {any} */ (useOutletContext());
  const [markets, setMarkets] = useState([]);
  const [plans, setPlans] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const createModalRef = useModalBehavior({
    active: open,
    disabled: saving,
    onClose: () => setOpen(false),
  });
  const detailModalRef = useModalBehavior({
    active: Boolean(detail),
    onClose: () => setDetail(null),
  });

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [marketRows, planRows] = await Promise.all([
        nexoApi.markets.list(),
        nexoApi.admin.plans.list(),
      ]);
      setMarkets(marketRows);
      setPlans(planRows);
    } catch (error) {
      setLoadError(error.message || 'Não foi possível carregar os mercados.');
      toast.error(error.message || 'Erro ao carregar mercados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !saving) setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, saving]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return markets;
    return markets.filter(
      (market) =>
        String(market.name || '')
          .toLowerCase()
          .includes(query) ||
        String(market.slug || '')
          .toLowerCase()
          .includes(query),
    );
  }, [markets, search]);

  const updateForm = (key, value) => {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === 'name' && !slugTouched) next.slug = slugify(value);
      return next;
    });
  };

  const create = async (event) => {
    event.preventDefault();
    const selectedPlan = plans.find(
      (plan) => plan.id === form.plan_id && plan.active,
    );
    const payload = {
      ...form,
      name: form.name.trim(),
      slug: slugify(form.slug),
      admin_name: form.admin_name.trim(),
      admin_email: form.admin_email.trim().toLowerCase(),
      enabled_modules: selectedPlan?.enabled_modules || MARKET_MODULE_KEYS,
      enabled_features: selectedPlan?.enabled_features || MARKET_FEATURE_KEYS,
    };
    if (
      !payload.name ||
      !payload.slug ||
      !/^\S+@\S+\.\S+$/.test(payload.admin_email) ||
      payload.admin_password.length < 8
    ) {
      toast.error('Revise nome, identificador, e-mail e senha inicial.');
      return;
    }
    setSaving(true);
    try {
      await nexoApi.markets.create(payload);
      setForm(EMPTY);
      setSlugTouched(false);
      setOpen(false);
      await load();
      toast.success('Mercado e administrador criados.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível criar o mercado.');
    } finally {
      setSaving(false);
    }
  };

  const update = async (market, data) => {
    if (updatingIds.has(market.id)) return;
    const previousMarkets = markets;
    setMarkets((current) =>
      current.map((item) =>
        item.id === market.id ? { ...item, ...data } : item,
      ),
    );
    setUpdatingIds((current) => new Set(current).add(market.id));
    try {
      const updated = await nexoApi.markets.update(market.id, data);
      setMarkets((current) =>
        current.map((item) =>
          item.id === market.id ? { ...item, ...updated } : item,
        ),
      );
      toast.success('Mercado atualizado.');
    } catch (error) {
      setMarkets(previousMarkets);
      toast.error(error.message || 'Não foi possível atualizar o mercado.');
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(market.id);
        return next;
      });
    }
  };
  const openDetail = async (market) => {
    setDetail({ market });
    setDetailLoading(true);
    try {
      setDetail(await nexoApi.markets.detail(market.id));
    } catch (error) {
      toast.error(
        error.message || 'Não foi possível carregar os detalhes do mercadinho.',
      );
    } finally {
      setDetailLoading(false);
    }
  };
  const changeMarketStatus = async (market, status) => {
    if (status === 'cancelado') {
      const accepted = await confirm({
        title: 'Encerrar mercadinho?',
        description: `O acesso de ${market.name} será bloqueado, a assinatura será cancelada e o histórico será preservado.`,
        confirmLabel: 'Encerrar acesso',
        tone: 'danger',
      });
      if (!accepted) return;
    }
    await update(market, { status });
  };

  return (
    <div className="page-shell">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <Store className="h-3.5 w-3.5" /> Administração geral
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Mercados
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clientes, identidade visual e módulos habilitados.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground shadow-sm hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" /> Novo mercado
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="relative">
          <span className="sr-only">Pesquisar mercados</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar por nome ou identificador"
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <span className="text-sm font-medium text-muted-foreground">
          {filtered.length} de {markets.length} mercados
        </span>
      </div>

      {loading && markets.length > 0 && (
        <div
          role="status"
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando
          mercados...
        </div>
      )}
      {loading && !markets.length ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground"
        >
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
          Carregando mercados...
        </div>
      ) : loadError && !markets.length ? (
        <ErrorState description={loadError} onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <Store className="mx-auto h-11 w-11 text-muted-foreground/25" />
          <h2 className="mt-3 font-bold">Nenhum mercado encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Altere a pesquisa ou cadastre um novo cliente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((market) => {
            const updating = updatingIds.has(market.id);
            return (
              <article
                className={`rounded-2xl border border-border bg-card p-5 shadow-sm transition ${updating ? 'opacity-75' : 'hover:-translate-y-0.5 hover:shadow-md'}`}
                key={market.id}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-2xl"
                    style={{ background: market.primary_color || '#16a06a' }}
                  >
                    {market.logo_url ? (
                      <img
                        src={market.logo_url}
                        alt={`Logo de ${market.name}`}
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <Store className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black">
                      {market.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      /{market.slug}
                    </p>
                  </div>
                  <select
                    aria-label={`Status de ${market.name}`}
                    disabled={updating || market.status === 'cancelado'}
                    value={
                      market.status || (market.active ? 'ativo' : 'suspenso')
                    }
                    onChange={(event) =>
                      changeMarketStatus(market, event.target.value)
                    }
                    className="h-10 rounded-xl border border-border bg-background px-2 text-xs font-bold disabled:opacity-50"
                  >
                    <option value="teste">Em teste</option>
                    <option value="ativo">Ativo</option>
                    <option value="suspenso">Suspenso</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-black">Módulos habilitados</h3>
                    <span className="text-xs text-muted-foreground">
                      {(market.enabled_modules || []).length}/
                      {MARKET_MODULES.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MARKET_MODULES.map((module) => {
                      const checked = (market.enabled_modules || []).includes(
                        module.key,
                      );
                      return (
                        <ModuleSwitch
                          key={module.key}
                          module={module}
                          compact
                          checked={checked}
                          disabled={updating}
                          onChange={(nextChecked) =>
                            update(market, {
                              enabled_modules: nextChecked
                                ? [
                                    ...new Set([
                                      ...(market.enabled_modules || []),
                                      module.key,
                                    ]),
                                  ]
                                : (market.enabled_modules || []).filter(
                                    (key) => key !== module.key,
                                  ),
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </div>

                <details className="mt-4 rounded-xl border border-border bg-muted/10 p-3">
                  <summary className="cursor-pointer text-sm font-bold">
                    Recursos específicos{' '}
                    <span className="font-normal text-muted-foreground">
                      ({(market.enabled_features || []).length}/
                      {MARKET_FEATURES.length})
                    </span>
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {MARKET_FEATURES.map((feature) => {
                      const checked = (market.enabled_features || []).includes(
                        feature.key,
                      );
                      return (
                        <ModuleSwitch
                          key={feature.key}
                          module={feature}
                          compact
                          checked={checked}
                          disabled={updating}
                          onChange={(nextChecked) =>
                            update(market, {
                              enabled_features: nextChecked
                                ? [
                                    ...new Set([
                                      ...(market.enabled_features || []),
                                      feature.key,
                                    ]),
                                  ]
                                : (market.enabled_features || []).filter(
                                    (key) => key !== feature.key,
                                  ),
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </details>

                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold text-muted-foreground">
                      Plano contratado
                      <select
                        className="field"
                        value={market.plan_id || ''}
                        disabled={updating || market.status === 'cancelado'}
                        onChange={(event) =>
                          update(market, {
                            plan_id: event.target.value || null,
                          })
                        }
                      >
                        <option value="">Sem plano</option>
                        {plans.map((plan) => (
                          <option
                            key={plan.id}
                            value={plan.id}
                            disabled={
                              !plan.active && plan.id !== market.plan_id
                            }
                          >
                            {plan.name}
                            {!plan.active ? ' (inativo)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-xl border border-border bg-muted/25 p-3">
                      <span className="text-xs text-muted-foreground">
                        Uso atual
                      </span>
                      <strong className="mt-1 block text-sm">
                        {market.user_count || 0} usuário(s)
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        {market.subscription_due_date
                          ? `Vence em ${new Date(`${market.subscription_due_date}T12:00:00`).toLocaleDateString('pt-BR')}`
                          : 'Sem vencimento definido'}
                      </span>
                    </div>
                  </div>
                  <label
                    className={`mb-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-muted/25 p-3 ${updating ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-accent/10 text-accent">
                        <LockKeyhole className="h-4 w-4" />
                      </span>
                      <span>
                        <strong className="block text-sm">
                          Abertura de caixa para vendedores
                        </strong>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          Exige valor inicial antes da primeira venda deste
                          mercado.
                        </span>
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(market.require_cash_register)}
                      onChange={(event) =>
                        update(market, {
                          require_cash_register: event.target.checked,
                        })
                      }
                      className="h-5 w-5 flex-none accent-[var(--market-primary)]"
                    />
                  </label>
                  <ImageUploadField
                    value={market.logo_url || ''}
                    onChange={(value) => update(market, { logo_url: value })}
                    kind="market"
                    scopeId={market.id}
                    label="Logo do mercado"
                    name={market.name}
                    previewClassName="h-14 w-24 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => openDetail(market)}
                    className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-xs font-bold hover:bg-muted"
                  >
                    <Eye className="h-4 w-4" /> Ver limites, cobrança e
                    histórico
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !saving && setOpen(false)
          }
          role="presentation"
        >
          <form
            ref={createModalRef}
            onSubmit={create}
            className="my-auto grid max-h-[calc(100dvh-1rem)] w-full max-w-2xl gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:max-h-[92dvh] sm:grid-cols-2 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-market-title"
          >
            <div className="flex items-start justify-between gap-4 sm:col-span-2">
              <div>
                <h2 id="new-market-title" className="text-xl font-black">
                  Novo mercado
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie o cliente e o acesso administrativo inicial.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="text-sm font-semibold">
              Nome do mercado <span className="text-destructive">*</span>
              <input
                required
                autoFocus
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <label className="text-sm font-semibold">
              Identificador <span className="text-destructive">*</span>
              <input
                required
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  updateForm('slug', event.target.value);
                }}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="mercado-exemplo"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Use letras minúsculas, números e hífen.
              </span>
            </label>
            <label className="text-sm font-semibold">
              Nome do administrador <span className="text-destructive">*</span>
              <input
                required
                value={form.admin_name}
                onChange={(event) =>
                  updateForm('admin_name', event.target.value)
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <label className="text-sm font-semibold">
              E-mail do administrador{' '}
              <span className="text-destructive">*</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={form.admin_email}
                onChange={(event) =>
                  updateForm('admin_email', event.target.value)
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Senha inicial <span className="text-destructive">*</span>
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={form.admin_password}
                onChange={(event) =>
                  updateForm('admin_password', event.target.value)
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Mínimo de 8 caracteres.
              </span>
            </label>

            <div className="rounded-xl border border-border bg-muted/25 p-3 sm:col-span-2">
              <ImageUploadField
                value={form.logo_url}
                onChange={(value) => updateForm('logo_url', value)}
                kind="market"
                scopeId={user?.market_id || user?.id}
                label="Logo do mercado"
                name={form.name || 'mercado'}
                previewClassName="h-16 w-28 rounded-xl"
              />
            </div>

            <ColorField
              label="Cor principal"
              value={form.primary_color}
              onChange={(value) => updateForm('primary_color', value)}
            />
            <ColorField
              label="Cor secundária"
              value={form.secondary_color}
              onChange={(value) => updateForm('secondary_color', value)}
            />

            <label className="text-sm font-semibold">
              Plano inicial
              <select
                className="field"
                value={form.plan_id}
                onChange={(event) => updateForm('plan_id', event.target.value)}
              >
                <option value="">Sem plano</option>
                {plans
                  .filter((plan) => plan.active)
                  .map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Status inicial
              <select
                className="field"
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value)}
              >
                <option value="teste">Em período de teste</option>
                <option value="ativo">Ativo</option>
              </select>
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-muted/25 p-3 sm:col-span-2">
              <span className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-accent/10 text-accent">
                  <LockKeyhole className="h-4 w-4" />
                </span>
                <span>
                  <strong className="block text-sm">
                    Exigir abertura de caixa dos vendedores
                  </strong>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    O administrador do mercado ainda poderá vender sem abrir
                    caixa.
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.require_cash_register)}
                onChange={(event) =>
                  updateForm('require_cash_register', event.target.checked)
                }
                className="h-5 w-5 flex-none accent-[var(--market-primary)]"
              />
            </label>

            <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />{' '}
                {saving ? 'Criando...' : 'Criar com todos os módulos'}
              </button>
            </div>
          </form>
        </div>
      )}
      {detail && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-0 sm:p-4">
          <section
            ref={detailModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-detail-title"
            className="flex h-dvh w-full max-w-3xl flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[94dvh] sm:rounded-2xl sm:border sm:border-border"
          >
            <header className="flex items-start justify-between border-b border-border p-5">
              <div>
                <h2 id="market-detail-title" className="text-xl font-black">
                  {detail.market?.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Plano, limites, uso, cobranças e alterações administrativas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Fechar detalhes"
                className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {detailLoading ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Carregando dados completos...
                </p>
              ) : (
                <>
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <DetailValue
                      label="Usuários"
                      value={detail.market?.user_count}
                    />
                    <DetailValue
                      label="Produtos"
                      value={detail.market?.product_count}
                    />
                    <DetailValue
                      label="Vendas"
                      value={detail.market?.sale_count}
                    />
                  </dl>
                  <section>
                    <h3 className="mb-2 font-black">Unidades</h3>
                    {detail.units?.map((unit) => (
                      <div
                        key={unit.id}
                        className="mb-2 rounded-xl border border-border p-3 text-sm"
                      >
                        <strong>{unit.name}</strong>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {unit.code} · {unit.active ? 'ativa' : 'inativa'}
                        </span>
                      </div>
                    ))}
                  </section>
                  <section>
                    <h3 className="mb-2 font-black">Histórico de pagamentos</h3>
                    {detail.payments?.length ? (
                      detail.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="mb-2 flex items-center justify-between rounded-xl border border-border p-3 text-sm"
                        >
                          <div>
                            <strong className="block capitalize">
                              {payment.status}
                            </strong>
                            <span className="text-xs text-muted-foreground">
                              Vencimento{' '}
                              {new Date(
                                `${payment.due_date}T12:00:00`,
                              ).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <strong>
                            R${' '}
                            {Number(payment.amount)
                              .toFixed(2)
                              .replace('.', ',')}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma cobrança registrada.
                      </p>
                    )}
                  </section>
                  <section>
                    <h3 className="mb-2 font-black">Histórico de alterações</h3>
                    {detail.history?.length ? (
                      detail.history.map((item) => (
                        <div
                          key={item.id}
                          className="mb-2 rounded-xl border border-border p-3 text-sm"
                        >
                          <strong className="block capitalize">
                            {String(item.action).replaceAll('_', ' ')}
                          </strong>
                          <span className="text-xs text-muted-foreground">
                            {item.actor_name} ·{' '}
                            {new Date(item.created_date).toLocaleString(
                              'pt-BR',
                            )}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma alteração administrativa registrada.
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(event) =>
            /^#[0-9a-f]{0,6}$/i.test(event.target.value) &&
            onChange(event.target.value)
          }
          maxLength={7}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
          aria-label={`${label} em hexadecimal`}
        />
      </div>
    </label>
  );
}

function DetailValue({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-black">{value || 0}</dd>
    </div>
  );
}
