import React, { useEffect, useState } from "react";
import {
  Bell,
  Blocks,
  Loader2,
  LockKeyhole,
  Mail,
  Save,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { nexoApi } from "@/api/nexoApi";
import { toast } from "react-hot-toast";
import { ErrorState, LoadingState } from "@/components/common/PageState";

const DEFAULTS = {
  email_provider: "brevo",
  email_from_name: "Nexo PDV",
  notification_defaults: { stock_alerts: true, platform_notices: true },
  plan_enforcement: true,
  global_user_limit: "",
  global_product_limit: "",
  global_unit_limit: "",
  security_session_hours: 12,
  security_login_attempts: 5,
  integrations: { webhooks: false },
  maintenance_mode: false,
  maintenance_message: "",
  platform_notice: "",
};
export default function AdminConfiguracoes() {
  const [form, setForm] = useState(DEFAULTS),
    [logs, setLogs] = useState([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [data, logRows] = await Promise.all([
        nexoApi.admin.settings.get(),
        nexoApi.admin.logs(),
      ]);
      setLogs(logRows);
      setForm(
        Object.fromEntries(
          Object.entries(DEFAULTS).map(([key, value]) => [
            key,
            data[key]?.value ?? value,
          ]),
        ),
      );
    } catch (cause) {
      setError(
        cause.message || "Não foi possível carregar as configurações gerais.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await nexoApi.admin.settings.update(form);
      toast.success("Configurações gerais salvas.");
    } catch (cause) {
      toast.error(cause.message || "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <div className="page-shell">
        <LoadingState label="Carregando configurações da plataforma..." />
      </div>
    );
  if (error)
    return (
      <div className="page-shell">
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  return (
    <form onSubmit={save} className="page-shell space-y-5">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
          <Blocks className="h-3.5 w-3.5" /> Governança
        </div>
        <h1 className="text-2xl font-black sm:text-3xl">
          Configurações gerais
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          E-mails, notificações, planos, segurança, integrações e comunicação
          operacional.
        </p>
      </header>
      <Section
        icon={Mail}
        title="E-mails da plataforma"
        description="O conteúdo enviado aos clientes usa a identidade configurada em cada mercadinho."
      >
        <Field label="Provedor">
          <select
            className="field"
            value={form.email_provider}
            onChange={(e) =>
              setForm((v) => ({ ...v, email_provider: e.target.value }))
            }
          >
            <option value="brevo">Brevo</option>
          </select>
        </Field>
        <Field label="Nome padrão do remetente">
          <input
            className="field"
            maxLength={70}
            value={form.email_from_name}
            onChange={(e) =>
              setForm((v) => ({ ...v, email_from_name: e.target.value }))
            }
          />
        </Field>
      </Section>
      <Section
        icon={Bell}
        title="Notificações e avisos"
        description="Modelos globais e comunicados exibidos na plataforma."
      >
        <Field label="Aviso da plataforma" wide>
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm"
            value={form.platform_notice}
            onChange={(e) =>
              setForm((v) => ({ ...v, platform_notice: e.target.value }))
            }
          />
        </Field>
        <Toggle
          label="Alertas de estoque habilitados por padrão"
          checked={form.notification_defaults?.stock_alerts !== false}
          onChange={(checked) =>
            setForm((v) => ({
              ...v,
              notification_defaults: {
                ...v.notification_defaults,
                stock_alerts: checked,
              },
            }))
          }
        />
        <Toggle
          label="Avisos da plataforma habilitados"
          checked={form.notification_defaults?.platform_notices !== false}
          onChange={(checked) =>
            setForm((v) => ({
              ...v,
              notification_defaults: {
                ...v.notification_defaults,
                platform_notices: checked,
              },
            }))
          }
        />
      </Section>
      <Section
        icon={ShieldCheck}
        title="Regras e limites globais"
        description="Limites de contingência; o plano ou o mercadinho pode definir valores menores."
      >
        <Field label="Máximo de usuários">
          <input
            type="number"
            min="1"
            placeholder="Sem limite global"
            className="field"
            value={form.global_user_limit}
            onChange={(e) =>
              setForm((v) => ({ ...v, global_user_limit: e.target.value }))
            }
          />
        </Field>
        <Field label="Máximo de produtos">
          <input
            type="number"
            min="1"
            placeholder="Sem limite global"
            className="field"
            value={form.global_product_limit}
            onChange={(e) =>
              setForm((v) => ({ ...v, global_product_limit: e.target.value }))
            }
          />
        </Field>
        <Field label="Máximo de unidades">
          <input
            type="number"
            min="1"
            placeholder="Sem limite global"
            className="field"
            value={form.global_unit_limit}
            onChange={(e) =>
              setForm((v) => ({ ...v, global_unit_limit: e.target.value }))
            }
          />
        </Field>
        <Toggle
          label="Aplicar regras dos planos"
          checked={Boolean(form.plan_enforcement)}
          onChange={(checked) =>
            setForm((v) => ({ ...v, plan_enforcement: checked }))
          }
        />
      </Section>
      <Section
        icon={LockKeyhole}
        title="Segurança"
        description="Políticas básicas de sessão e autenticação."
      >
        <Field label="Duração da sessão (horas)">
          <input
            type="number"
            min="1"
            max="168"
            className="field"
            value={form.security_session_hours}
            onChange={(e) =>
              setForm((v) => ({
                ...v,
                security_session_hours: Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="Tentativas de login">
          <input
            type="number"
            min="3"
            max="20"
            className="field"
            value={form.security_login_attempts}
            onChange={(e) =>
              setForm((v) => ({
                ...v,
                security_login_attempts: Number(e.target.value),
              }))
            }
          />
        </Field>
      </Section>
      <Section
        icon={ServerCog}
        title="Manutenção e integrações"
        description="Controle operacional da plataforma."
      >
        <Toggle
          label="Modo de manutenção"
          checked={Boolean(form.maintenance_mode)}
          onChange={(checked) =>
            setForm((v) => ({ ...v, maintenance_mode: checked }))
          }
        />
        <Toggle
          label="Webhooks de integrações"
          checked={Boolean(form.integrations?.webhooks)}
          onChange={(checked) =>
            setForm((v) => ({
              ...v,
              integrations: { ...v.integrations, webhooks: checked },
            }))
          }
        />
        <Field label="Mensagem de manutenção" wide>
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm"
            value={form.maintenance_message}
            onChange={(e) =>
              setForm((v) => ({ ...v, maintenance_message: e.target.value }))
            }
          />
        </Field>
      </Section>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
            <ServerCog className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-black">Logs do sistema</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Últimos eventos administrativos e operacionais de todos os
              mercadinhos.
            </p>
          </div>
        </div>
        {logs.length ? (
          <div className="mt-4 max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {logs.map((item) => (
              <div
                key={`${item.source}-${item.id}`}
                className="grid gap-1 p-3 text-sm sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <strong className="block capitalize">
                    {String(item.action || "evento").replaceAll("_", " ")}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {item.market_name} · {item.actor_name} · {item.source}
                  </span>
                </div>
                <time className="text-xs text-muted-foreground">
                  {new Date(item.created_date).toLocaleString("pt-BR")}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum evento registrado.
          </p>
        )}
      </section>
      <div className="sticky bottom-3 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-black text-accent-foreground shadow-lg disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </form>
  );
}
function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2">
      <div className="flex items-start gap-3 sm:col-span-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-black">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
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
function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-3 text-sm font-bold">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-5 w-5 accent-[var(--market-primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
