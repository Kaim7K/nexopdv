import React, { useEffect, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  Boxes,
  CircleOff,
  Clock3,
  Gauge,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";
import { nexoApi } from "@/api/nexoApi";
import { ErrorState, LoadingState } from "@/components/common/PageState";
import { formatCurrency } from "@/lib/helpers";

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = async () => {
    setError("");
    try {
      setData(await nexoApi.admin.overview());
    } catch (cause) {
      setError(cause.message || "Não foi possível carregar os indicadores.");
    }
  };
  useEffect(() => {
    load();
  }, []);
  if (!data && !error)
    return (
      <div className="page-shell">
        <LoadingState label="Consolidando indicadores da plataforma..." />
      </div>
    );
  if (error && !data)
    return (
      <div className="page-shell">
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  const m = data.metrics || {};
  const cards = [
    ["Mercadinhos", m.total_markets, Store, "Clientes cadastrados"],
    ["Ativos", m.active_markets, Activity, "Operação liberada"],
    ["Em teste", m.trial_markets, Clock3, "Período de avaliação"],
    ["Suspensos", m.suspended_markets, CircleOff, "Acesso interrompido"],
    [
      "Usuários",
      m.total_users,
      Users,
      `${m.active_users || 0} ativos em 30 dias`,
    ],
    ["Planos ativos", m.active_plans, Boxes, "Catálogo comercial"],
    [
      "Receita estimada",
      formatCurrency(m.estimated_revenue),
      BadgeDollarSign,
      "Mensal recorrente",
    ],
    [
      "Vendas processadas",
      m.processed_sales,
      ShoppingCart,
      formatCurrency(m.processed_volume),
    ],
  ];
  const peak = Math.max(
    1,
    ...(data.market_growth || []).map((item) => Number(item.markets || 0)),
  );
  return (
    <div className="page-shell space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
          <Gauge className="h-3.5 w-3.5" /> Super Admin
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Visão geral da plataforma
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saúde comercial e uso consolidado do Nexo PDV.
        </p>
      </header>
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicadores gerais"
      >
        {cards.map(([label, value, Icon, hint]) => (
          <article
            key={label}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {label}
                </p>
                <strong className="mt-1 block text-2xl font-black tabular-nums">
                  {value ?? 0}
                </strong>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black">Novos mercadinhos</h2>
              <p className="text-xs text-muted-foreground">
                Cadastros nos últimos 12 meses
              </p>
            </div>
            <Activity className="h-5 w-5 text-accent" />
          </div>
          <div
            className="mt-6 flex h-48 items-end gap-2"
            aria-label="Gráfico de novos cadastros"
          >
            {(data.market_growth || []).map((item) => (
              <div
                key={item.month}
                className="flex min-w-0 flex-1 flex-col items-center gap-2"
              >
                <span className="text-xs font-bold tabular-nums">
                  {item.markets}
                </span>
                <div
                  className="w-full rounded-t-lg bg-accent/80"
                  style={{
                    height: `${Math.max(4, (Number(item.markets || 0) / peak) * 135)}px`,
                  }}
                  title={`${item.month}: ${item.markets}`}
                />
                <span className="hidden -rotate-45 whitespace-nowrap text-[10px] text-muted-foreground sm:block">
                  {item.month.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-black">Movimentação recente</h2>
          <dl className="mt-5 space-y-4">
            <Row label="Novos cadastros (30 dias)" value={m.new_markets} />
            <Row label="Cancelamentos (30 dias)" value={m.cancellations} />
            <Row label="Produtos cadastrados" value={m.products} />
            <Row label="Usuários ativos (30 dias)" value={m.active_users} />
          </dl>
        </article>
      </section>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-black tabular-nums">{value || 0}</dd>
    </div>
  );
}
