import React, { useEffect, useState } from "react";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { nexoApi } from "@/api/nexoApi";
import { ErrorState, LoadingState } from "@/components/common/PageState";
import { formatCurrency } from "@/lib/helpers";

const today = () => new Date().toISOString().slice(0, 10);
const yearAgo = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
};
export default function AdminRelatorios() {
  const [filters, setFilters] = useState({ from: yearAgo(), to: today() }),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await nexoApi.admin.reports({
          from: `${filters.from}T00:00:00`,
          to: `${filters.to}T23:59:59`,
        }),
      );
    } catch (cause) {
      setError(cause.message || "Não foi possível gerar os relatórios.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const exportCsv = () => {
    const rows = [
      ["Mercadinho", "Vendas", "Volume", "Produtos", "Usuários ativos"],
      ...(data?.usage || []).map((item) => [
        item.name,
        item.sales,
        item.sales_volume,
        item.products,
        item.active_users,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(";"),
      )
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relatorio-plataforma-${filters.from}-${filters.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="page-shell space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <BarChart3 className="h-3.5 w-3.5" /> Inteligência da plataforma
          </div>
          <h1 className="text-2xl font-black sm:text-3xl">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crescimento, receita, cancelamentos e adoção do sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!data?.usage?.length}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </header>
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs font-bold text-muted-foreground">
          De
          <input
            type="date"
            className="field"
            value={filters.from}
            onChange={(e) =>
              setFilters((v) => ({ ...v, from: e.target.value }))
            }
          />
        </label>
        <label className="text-xs font-bold text-muted-foreground">
          Até
          <input
            type="date"
            className="field"
            value={filters.to}
            onChange={(e) => setFilters((v) => ({ ...v, to: e.target.value }))}
          />
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{" "}
          Atualizar
        </button>
      </section>
      {loading ? (
        <LoadingState label="Processando indicadores..." />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <ReportCard
              title="Novos mercadinhos por período"
              columns={["Período", "Cadastros"]}
              rows={(data.growth || []).map((item) => [
                item.period,
                item.new_markets,
              ])}
            />
            <ReportCard
              title="Cancelamentos"
              columns={["Período", "Cancelamentos"]}
              rows={(data.cancellations || []).map((item) => [
                item.period,
                item.cancellations,
              ])}
            />
          </section>
          <ReportCard
            title="Receita recorrente por plano"
            columns={["Plano", "Assinaturas", "Receita estimada"]}
            rows={(data.revenue || []).map((item) => [
              item.plan,
              item.subscriptions,
              formatCurrency(item.revenue),
            ])}
          />
          <ReportCard
            title="Uso por mercadinho"
            columns={[
              "Mercadinho",
              "Vendas",
              "Volume processado",
              "Produtos",
              "Usuários ativos",
            ]}
            rows={(data.usage || []).map((item) => [
              item.name,
              item.sales,
              formatCurrency(item.sales_volume),
              item.products,
              item.active_users,
            ])}
          />
        </>
      )}
    </div>
  );
}
function ReportCard({ title, columns, rows }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <h2 className="border-b border-border p-4 font-black">{title}</h2>
      {rows.length ? (
        <>
        <div className="grid gap-2 p-3 lg:hidden">
          {rows.map((row, index) => (
            <article key={index} className="rounded-xl border border-border bg-muted/15 p-3">
              <strong className="block break-words text-sm">{row[0]}</strong>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                {row.slice(1).map((value, cell) => (
                  <div key={columns[cell + 1]} className="min-w-0">
                    <dt className="text-muted-foreground">{columns[cell + 1]}</dt>
                    <dd className="mt-1 break-words font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, index) => (
                <tr key={index}>
                  {row.map((value, cell) => (
                    <td
                      key={cell}
                      className={`px-4 py-3 ${cell ? "font-semibold tabular-nums" : ""}`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nenhum dado no período selecionado.
        </p>
      )}
    </section>
  );
}
