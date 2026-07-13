import React, { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Loader2, Plus, Save, X } from "lucide-react";
import { nexoApi } from "@/api/nexoApi";
import { toast } from "react-hot-toast";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/PageState";
import { useModalBehavior } from "@/hooks/use-modal-behavior";
import { formatCurrency } from "@/lib/helpers";
import { useConfirm } from "@/components/common/ConfirmProvider";

const MODULES = [
  ["pdv", "PDV"],
  ["estoque", "Estoque"],
  ["vendas", "Vendas"],
  ["fiados", "Fiados"],
  ["relatorios", "Relatórios"],
  ["auditoria", "Auditoria"],
  ["usuarios", "Usuários"],
  ["configuracoes", "Configurações"],
];
const EMPTY = {
  name: "",
  description: "",
  monthly_price: "",
  trial_days: "14",
  user_limit: "",
  product_limit: "",
  unit_limit: "",
  enabled_modules: MODULES.map(([key]) => key),
  active: true,
};
export default function AdminPlanos() {
  const confirm = useConfirm();
  const [plans, setPlans] = useState([]),
    [subscriptions, setSubscriptions] = useState([]),
    [payments, setPayments] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [form, setForm] = useState(EMPTY),
    [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [editing, setEditing] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    subscription_id: "",
    amount: "",
    due_date: "",
    status: "pendente",
    notes: "",
  });
  const modalRef = useModalBehavior({
    active: open,
    onClose: () => setOpen(false),
    disabled: saving,
  });
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [p, s, pay] = await Promise.all([
        nexoApi.admin.plans.list(),
        nexoApi.admin.subscriptions.list(),
        nexoApi.admin.payments.list(),
      ]);
      setPlans(p);
      setSubscriptions(s);
      setPayments(pay);
    } catch (cause) {
      setError(
        cause.message || "Não foi possível carregar planos e assinaturas.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const edit = (plan) => {
    setEditing(plan);
    setForm({
      ...EMPTY,
      ...plan,
      monthly_price: String(plan.monthly_price),
      enabled_modules: plan.enabled_modules || [],
    });
    setOpen(true);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (editing) await nexoApi.admin.plans.update(editing.id, form);
      else await nexoApi.admin.plans.create(form);
      toast.success(editing ? "Plano atualizado." : "Plano criado.");
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (cause) {
      toast.error(cause.message || "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  };
  const changeStatus = async (item, status) => {
    if (["cancelada","suspensa","inadimplente"].includes(status)) {
      const accepted = await confirm({ title:status === "cancelada" ? "Cancelar assinatura?" : "Alterar acesso do mercadinho?",description:`${item.market_name} ficará com a assinatura ${status}. O histórico financeiro será preservado.`,confirmLabel:"Confirmar alteração",tone:status === "cancelada" ? "danger" : "warning" });
      if (!accepted) return;
    }
    try {
      await nexoApi.admin.subscriptions.update(item.id, {
        status,
        cancellation_reason:
          status === "cancelada" ? "Cancelamento administrativo" : "",
      });
      toast.success("Assinatura atualizada.");
      await load();
    } catch (cause) {
      toast.error(cause.message || "Não foi possível atualizar a assinatura.");
    }
  };
  const createPayment = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await nexoApi.admin.payments.create(paymentForm);
      toast.success("Cobrança registrada.");
      setPaymentForm({
        subscription_id: "",
        amount: "",
        due_date: "",
        status: "pendente",
        notes: "",
      });
      await load();
    } catch (cause) {
      toast.error(cause.message || "Não foi possível registrar a cobrança.");
    } finally {
      setSaving(false);
    }
  };
  const paidBySubscription = useMemo(
    () =>
      new Map(
        subscriptions.map((item) => [
          item.id,
          payments.filter((payment) => payment.subscription_id === item.id),
        ]),
      ),
    [subscriptions, payments],
  );
  return (
    <div className="page-shell space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <CreditCard className="h-3.5 w-3.5" /> Comercial
          </div>
          <h1 className="text-2xl font-black sm:text-3xl">
            Planos e assinaturas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preços, limites, funcionalidades, cobranças e ciclo de vida dos
            contratos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setOpen(true);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground"
        >
          <Plus className="h-4 w-4" /> Novo plano
        </button>
      </header>
      {loading ? (
        <LoadingState label="Carregando contratos..." />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-black">Catálogo de planos</h2>
            {plans.length ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {plans.map((plan) => (
                  <article
                    key={plan.id}
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-black">{plan.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {plan.description || "Sem descrição"}
                        </p>
                      </div>
                      <span
                        className={
                          plan.active
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                        }
                      >
                        <Check className="h-5 w-5" />
                      </span>
                    </div>
                    <strong className="mt-5 block text-2xl font-black">
                      {formatCurrency(plan.monthly_price)}
                      <span className="text-xs font-normal text-muted-foreground">
                        /mês
                      </span>
                    </strong>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <Info label="Teste" value={`${plan.trial_days} dias`} />
                      <Info
                        label="Usuários"
                        value={plan.user_limit || "Ilimitado"}
                      />
                      <Info
                        label="Produtos"
                        value={plan.product_limit || "Ilimitado"}
                      />
                      <Info
                        label="Unidades"
                        value={plan.unit_limit || "Ilimitado"}
                      />
                    </dl>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {plan.subscription_count} assinatura(s) ·{" "}
                      {(plan.enabled_modules || []).length} funcionalidades
                    </p>
                    <button
                      type="button"
                      onClick={() => edit(plan)}
                      className="mt-4 min-h-10 w-full rounded-xl border border-border text-sm font-bold hover:bg-muted"
                    >
                      Editar plano
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CreditCard}
                title="Nenhum plano criado"
                description="Crie o primeiro plano para vincular assinaturas."
              />
            )}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-black">Assinaturas</h2>
            {subscriptions.length ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="divide-y divide-border">
                  {subscriptions.map((item) => (
                    <article
                      key={item.id}
                      className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center"
                    >
                      <div>
                        <strong className="block">{item.market_name}</strong>
                        <span className="text-xs text-muted-foreground">
                          {item.plan_name || "Sem plano"} ·{" "}
                          {formatCurrency(item.monthly_price)}/mês
                        </span>
                      </div>
                      <div>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold capitalize">
                          {item.status}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {(paidBySubscription.get(item.id) || []).length}{" "}
                          cobrança(s)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.status !== "ativa" && (
                          <Action onClick={() => changeStatus(item, "ativa")}>
                            Reativar
                          </Action>
                        )}
                        {item.status !== "inadimplente" && (
                          <Action
                            onClick={() => changeStatus(item, "inadimplente")}
                          >
                            Inadimplente
                          </Action>
                        )}
                        {item.status !== "suspensa" && (
                          <Action
                            onClick={() => changeStatus(item, "suspensa")}
                          >
                            Suspender
                          </Action>
                        )}
                        {item.status !== "cancelada" && (
                          <Action
                            onClick={() => changeStatus(item, "cancelada")}
                          >
                            Cancelar
                          </Action>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={CreditCard}
                title="Nenhuma assinatura"
                description="As assinaturas aparecem quando um plano é associado a um mercadinho."
              />
            )}
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-black">Histórico de pagamentos</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Mensalidades, vencimentos, inadimplência, pagamentos e estornos.
            </p>
            <form
              onSubmit={createPayment}
              className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
            >
              <Field label="Assinatura">
                <select
                  required
                  className="field"
                  value={paymentForm.subscription_id}
                  onChange={(event) =>
                    setPaymentForm((value) => ({
                      ...value,
                      subscription_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  {subscriptions
                    .filter((item) => item.status !== "cancelada")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.market_name} · {item.plan_name || "Sem plano"}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Valor">
                <input
                  required
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((value) => ({
                      ...value,
                      amount: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Vencimento">
                <input
                  required
                  className="field"
                  type="date"
                  value={paymentForm.due_date}
                  onChange={(event) =>
                    setPaymentForm((value) => ({
                      ...value,
                      due_date: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Status">
                <select
                  className="field"
                  value={paymentForm.status}
                  onChange={(event) =>
                    setPaymentForm((value) => ({
                      ...value,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="vencido">Vencido</option>
                  <option value="estornado">Estornado</option>
                </select>
              </Field>
              <button
                type="submit"
                disabled={saving}
                className="mt-auto h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50"
              >
                Registrar
              </button>
            </form>
            {payments.length ? (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Mercadinho</th>
                      <th className="px-3 py-2">Plano</th>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-3 py-3 font-bold">
                          {payment.market_name}
                        </td>
                        <td className="px-3 py-3">
                          {payment.plan_name || "Sem plano"}
                        </td>
                        <td className="px-3 py-3">
                          {new Date(
                            `${payment.due_date}T12:00:00`,
                          ).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-3 py-3 capitalize">
                          {payment.status}
                        </td>
                        <td className="px-3 py-3 text-right font-black">
                          {formatCurrency(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                Nenhuma cobrança registrada.
              </p>
            )}
          </section>
        </>
      )}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4">
          <form
            ref={modalRef}
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            className="my-auto grid max-h-[94dvh] w-full max-w-2xl gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <div className="flex items-start justify-between sm:col-span-2">
              <div>
                <h2 className="text-xl font-black">
                  {editing ? "Editar plano" : "Novo plano"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Defina preço, teste, limites e acesso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Field label="Nome">
              <input
                required
                className="field"
                value={form.name}
                onChange={(e) =>
                  setForm((v) => ({ ...v, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Preço mensal">
              <input
                required
                min="0"
                step="0.01"
                type="number"
                className="field"
                value={form.monthly_price}
                onChange={(e) =>
                  setForm((v) => ({ ...v, monthly_price: e.target.value }))
                }
              />
            </Field>
            <Field label="Período de teste (dias)">
              <input
                min="0"
                max="365"
                type="number"
                className="field"
                value={form.trial_days}
                onChange={(e) =>
                  setForm((v) => ({ ...v, trial_days: e.target.value }))
                }
              />
            </Field>
            <Field label="Limite de usuários">
              <input
                min="1"
                type="number"
                className="field"
                placeholder="Ilimitado"
                value={form.user_limit || ""}
                onChange={(e) =>
                  setForm((v) => ({ ...v, user_limit: e.target.value }))
                }
              />
            </Field>
            <Field label="Limite de produtos">
              <input
                min="1"
                type="number"
                className="field"
                placeholder="Ilimitado"
                value={form.product_limit || ""}
                onChange={(e) =>
                  setForm((v) => ({ ...v, product_limit: e.target.value }))
                }
              />
            </Field>
            <Field label="Limite de unidades">
              <input
                min="1"
                type="number"
                className="field"
                placeholder="Ilimitado"
                value={form.unit_limit || ""}
                onChange={(e) =>
                  setForm((v) => ({ ...v, unit_limit: e.target.value }))
                }
              />
            </Field>
            <Field label="Descrição" wide>
              <textarea
                className="mt-1.5 min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm"
                value={form.description}
                onChange={(e) =>
                  setForm((v) => ({ ...v, description: e.target.value }))
                }
              />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="text-xs font-bold text-muted-foreground">
                Funcionalidades
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MODULES.map(([key, label]) => (
                  <label
                    key={key}
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-bold"
                  >
                    <input
                      type="checkbox"
                      checked={form.enabled_modules.includes(key)}
                      onChange={(e) =>
                        setForm((v) => ({
                          ...v,
                          enabled_modules: e.target.checked
                            ? [...v.enabled_modules, key]
                            : v.enabled_modules.filter((x) => x !== key),
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 font-bold text-accent-foreground sm:col-span-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Salvando..." : "Salvar plano"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-black">{value}</dd>
    </div>
  );
}
function Action({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 rounded-lg border border-border px-3 text-xs font-bold hover:bg-muted"
    >
      {children}
    </button>
  );
}
function Field({ label, children, wide = false }) {
  return (
    <label
      className={`text-xs font-bold text-muted-foreground ${wide ? "sm:col-span-2" : ""}`}
    >
      {label}
      {children}
    </label>
  );
}
