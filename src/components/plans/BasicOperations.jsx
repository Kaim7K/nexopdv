import { useEffect, useState } from "react";
import { nexoApi } from "@/api/nexoApi";
import { formatCurrency } from "@/lib/helpers";
import { ErrorState, LoadingState } from "@/components/common/PageState";

export function BasicReports() {
  const [period, setPeriod] = useState(
    new Date().toLocaleDateString("en-CA").slice(0, 7),
  );
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const from = `${period}-01`;
    const date = new Date(`${from}T12:00:00`);
    date.setMonth(date.getMonth() + 1);
    setSummary(null);
    setError("");
    nexoApi.sales
      .list({
        from,
        to: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
        pageSize: 10,
      })
      .then((data) => {
        if (active) setSummary(data.summary);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [period]);
  return (
    <div className="page-shell space-y-5">
      <header>
        <h1 className="page-title">Relatórios</h1>
        <p className="page-subtitle">Vendas e faturamento do seu mercado.</p>
      </header>
      <label className="grid max-w-xs gap-2 text-sm font-semibold">
        Mês de referência
        <input
          type="month"
          className="field"
          required
          value={period}
          onChange={(event) => {
            if (event.target.value) setPeriod(event.target.value);
          }}
        />
      </label>
      {error ? (
        <ErrorState description={error} />
      ) : !summary ? (
        <LoadingState label="Carregando resultados..." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Vendas concluídas", summary.sales_count],
            ["Faturamento", formatCurrency(summary.total)],
            ["Ticket médio", formatCurrency(summary.average_ticket)],
          ].map(([label, value]) => (
            <article
              key={label}
              className="rounded-xl border border-border bg-card p-5"
            >
              <h2 className="text-sm text-muted-foreground">{label}</h2>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </article>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        O histórico de vendas e os recibos continuam disponíveis em Vendas.
        Análises por produto e vendedor estão disponíveis a partir do
        Profissional.
      </p>
    </div>
  );
}

export function BasicFinance() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    nexoApi.finance.transactions
      .list({ page: String(page), page_size: "25", status: "paid" })
      .then((data) => {
        if (active) {
          setItems(data.items);
          setPages(data.page_count);
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await nexoApi.finance.transactions.create({
        type: data.get("type"),
        description: data.get("description"),
        amount: Number(data.get("amount")),
        issue_date: data.get("date"),
        due_date: data.get("date"),
        status: "paid",
        payment_method: "dinheiro",
      });
      nexoApi.cache.clear("/finance");
      form.reset();
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-shell space-y-5">
      <header>
        <h1 className="page-title">Financeiro</h1>
        <p className="page-subtitle">
          Registre receitas recebidas e despesas pagas.
        </p>
      </header>
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="grid gap-1 text-sm">
          Tipo
          <select name="type" className="field">
            <option value="revenue">Receita</option>
            <option value="expense">Despesa</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Descrição
          <input
            name="description"
            className="field"
            required
            maxLength={200}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Valor (R$)
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="field"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Data
          <input
            name="date"
            type="date"
            required
            defaultValue={new Date().toLocaleDateString("en-CA")}
            className="field"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded-lg bg-accent p-3 font-bold text-accent-foreground disabled:opacity-50"
        >
          {busy ? "Salvando..." : "Registrar"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-4 p-4"
          >
            <span>
              {item.description}
              <small className="block text-muted-foreground">
                {item.type === "revenue" ? "Receita" : "Despesa"} ·{" "}
                {String(item.issue_date).slice(0, 10)}
              </small>
            </span>
            <strong>{formatCurrency(item.amount)}</strong>
          </li>
        ))}
        {!items.length && (
          <li className="p-4 text-muted-foreground">
            Nenhum lançamento pago encontrado.
          </li>
        )}
      </ul>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
          className="disabled:opacity-40"
        >
          Anterior
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage((value) => value + 1)}
          className="disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
