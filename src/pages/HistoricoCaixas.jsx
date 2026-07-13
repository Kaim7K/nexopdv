import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarRange,
  Eye,
  FilterX,
  MinusCircle,
  PlusCircle,
  ReceiptText,
  X,
} from "lucide-react";
import { nexoApi } from "@/api/nexoApi";
import { useOutletContext } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/PageState";
import PaginationControls from "@/components/common/PaginationControls";
import { useModalBehavior } from "@/hooks/use-modal-behavior";
import { formatCurrency } from "@/lib/helpers";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};
const toStart = (value) => (value ? `${value}T00:00:00` : "");
const toExclusiveEnd = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const PAYMENT_LABELS = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
  outros: "Outros",
  fiado: "Fiado",
};

export default function HistoricoCaixas() {
  const { user } = /** @type {any} */ (useOutletContext());
  const [filters, setFilters] = useState({
    from: monthStart(),
    to: today(),
    operatorId: "",
    status: "",
    unitId: "",
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    items: [],
    operators: [],
    units: [],
    total: 0,
    page_count: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await nexoApi.cash.history({
          page,
          pageSize: 20,
          from: toStart(filters.from),
          to: toExclusiveEnd(filters.to),
          operatorId: filters.operatorId,
          status: filters.status,
          unitId: filters.unitId,
        }),
      );
    } catch (cause) {
      setError(
        cause.message || "Não foi possível consultar o histórico de caixas.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);
  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const openDetail = async (item) => {
    setSelected({ session: item, summary: item.summary || {} });
    setDetailLoading(true);
    try {
      setSelected(await nexoApi.cash.detail(item.id));
    } catch (cause) {
      toast.error(
        cause.message || "Não foi possível carregar os detalhes do caixa.",
      );
    } finally {
      setDetailLoading(false);
    }
  };
  const totals = useMemo(
    () =>
      data.items.reduce(
        (sum, item) => ({
          sales: sum.sales + Number(item.total_sales || 0),
          entries: sum.entries + Number(item.entries || 0),
          withdrawals: sum.withdrawals + Number(item.withdrawals || 0),
          differences: sum.differences + Number(item.difference || 0),
        }),
        { sales: 0, entries: 0, withdrawals: 0, differences: 0 },
      ),
    [data.items],
  );

  return (
    <div className="page-shell space-y-5">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
          <Banknote className="h-3.5 w-3.5" /> Operação financeira
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Histórico de caixas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aberturas, vendas, movimentações, conferência e fechamento por
          operador.
        </p>
      </header>

      <section
        aria-label="Filtros do histórico"
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-6"
      >
        <Filter label="De">
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => updateFilter("from", e.target.value)}
            className="field"
          />
        </Filter>
        <Filter label="Até">
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => updateFilter("to", e.target.value)}
            className="field"
          />
        </Filter>
        <Filter label="Operador">
          <select
            value={filters.operatorId}
            onChange={(e) => updateFilter("operatorId", e.target.value)}
            disabled={user.role === "vendedor"}
            className="field"
          >
            <option value="">Todos</option>
            {data.operators.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Status">
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="field"
          >
            <option value="">Todos</option>
            <option value="aberto">Em andamento</option>
            <option value="fechado">Fechado</option>
          </select>
        </Filter>
        <Filter label="Unidade">
          <select
            value={filters.unitId}
            onChange={(e) => updateFilter("unitId", e.target.value)}
            className="field"
          >
            <option value="">Todas</option>
            {data.units.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <button
          type="button"
          onClick={() => {
            setFilters({
              from: monthStart(),
              to: today(),
              operatorId: "",
              status: "",
              unitId: "",
            });
            setPage(1);
          }}
          className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold hover:bg-muted"
        >
          <FilterX className="h-4 w-4" /> Limpar
        </button>
      </section>

      {!loading && !error && data.items.length > 0 && (
        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Resumo do período exibido"
        >
          <Metric
            label="Vendas na página"
            value={formatCurrency(totals.sales)}
            icon={ReceiptText}
          />
          <Metric
            label="Entradas"
            value={formatCurrency(totals.entries)}
            icon={PlusCircle}
            tone="text-emerald-600"
          />
          <Metric
            label="Retiradas"
            value={formatCurrency(totals.withdrawals)}
            icon={MinusCircle}
            tone="text-amber-600"
          />
          <Metric
            label="Diferenças"
            value={formatCurrency(totals.differences)}
            icon={Banknote}
            tone={
              Math.abs(totals.differences) > 0.009
                ? "text-red-600"
                : "text-emerald-600"
            }
          />
        </section>
      )}

      {loading ? (
        <LoadingState label="Consultando caixas..." />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : !data.items.length ? (
        <EmptyState
          icon={CalendarRange}
          title="Nenhum caixa neste período"
          description="Ajuste os filtros ou aguarde a primeira abertura de caixa."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Operador / unidade</th>
                  <th className="px-4 py-3">Abertura</th>
                  <th className="px-4 py-3">Fechamento</th>
                  <th className="px-4 py-3 text-right">Inicial</th>
                  <th className="px-4 py-3 text-right">Vendas</th>
                  <th className="px-4 py-3 text-right">Final</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/25">
                    <td className="px-4 py-3">
                      <strong className="block">{item.seller_name}</strong>
                      <span className="text-xs text-muted-foreground">
                        {item.unit_name || "Unidade principal"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(item.opened_at)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(item.closed_at)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(item.opening_amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {formatCurrency(item.total_sales)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {formatCurrency(item.final_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Status value={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-bold hover:bg-muted"
                      >
                        <Eye className="h-4 w-4" /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 lg:hidden">
            {data.items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black">{item.seller_name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {item.unit_name || "Unidade principal"} ·{" "}
                      {formatDate(item.opened_at)}
                    </p>
                  </div>
                  <Status value={item.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Value
                    label="Valor inicial"
                    value={formatCurrency(item.opening_amount)}
                  />
                  <Value
                    label="Total de vendas"
                    value={formatCurrency(item.total_sales)}
                  />
                  <Value
                    label="Entradas / retiradas"
                    value={`${formatCurrency(item.entries)} / ${formatCurrency(item.withdrawals)}`}
                  />
                  <Value
                    label="Valor final"
                    value={formatCurrency(item.final_amount)}
                  />
                </dl>
                <button
                  type="button"
                  onClick={() => openDetail(item)}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold hover:bg-muted"
                >
                  <Eye className="h-4 w-4" /> Ver resumo completo
                </button>
              </article>
            ))}
          </div>
          <PaginationControls
            page={page}
            pageCount={data.page_count}
            total={data.total}
            pageSize={20}
            onPageChange={setPage}
          />
        </>
      )}
      {selected && (
        <CashDetail
          data={selected}
          loading={detailLoading}
          currentUser={user}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await openDetail(selected.session);
            await load();
          }}
        />
      )}
    </div>
  );
}

function CashDetail({ data, loading, currentUser, onClose, onChanged }) {
  const { session, summary = {} } = data;
  const [movementOpen, setMovementOpen] = useState(false);
  const [movement, setMovement] = useState({
    type: "entrada",
    amount: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const modalRef = useModalBehavior({ onClose, disabled: saving });
  const canMove =
    session.status === "aberto" && session.seller_id === currentUser.id;
  const saveMovement = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await nexoApi.cash.addMovement(session.id, movement);
      toast.success(
        movement.type === "entrada"
          ? "Entrada registrada."
          : "Retirada registrada.",
      );
      setMovement({ type: "entrada", amount: "", note: "" });
      setMovementOpen(false);
      await onChanged();
    } catch (cause) {
      toast.error(
        cause.message || "Não foi possível registrar a movimentação.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-0 backdrop-blur-sm sm:p-4"
      role="presentation"
    >
      <section
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-detail-title"
        className="flex h-dvh w-full max-w-4xl flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[94dvh] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-border p-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="cash-detail-title" className="text-xl font-black">
                Caixa de {session.seller_name}
              </h2>
              <Status value={session.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.unit_name || "Unidade principal"} · aberto em{" "}
              {formatDate(session.opened_at)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar detalhes"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {loading ? (
            <LoadingState label="Carregando movimentação completa..." />
          ) : (
            <>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ValueCard
                  label="Valor inicial"
                  value={formatCurrency(
                    summary.opening_amount ?? session.opening_amount,
                  )}
                />
                <ValueCard
                  label="Total de vendas"
                  value={formatCurrency(summary.total)}
                  hint={`${summary.sales_count || 0} venda(s)`}
                />
                <ValueCard
                  label="Esperado em dinheiro"
                  value={formatCurrency(summary.expected_cash)}
                />
                <ValueCard
                  label="Valor final"
                  value={formatCurrency(
                    session.closing_amount ?? summary.expected_cash,
                  )}
                  hint={
                    session.difference !== null &&
                    session.difference !== undefined
                      ? `Diferença: ${formatCurrency(session.difference)}`
                      : "Em andamento"
                  }
                />
              </dl>
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-black">Formas de pagamento</h3>
                  {canMove && (
                    <button
                      type="button"
                      onClick={() => setMovementOpen((v) => !v)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-xs font-bold text-accent-foreground"
                    >
                      <PlusCircle className="h-4 w-4" /> Movimentar caixa
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Object.entries(summary.payments || {}).length ? (
                    Object.entries(summary.payments || {}).map(
                      ([method, value]) => (
                        <div
                          key={method}
                          className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3 text-sm"
                        >
                          <span>{PAYMENT_LABELS[method] || method}</span>
                          <strong>{formatCurrency(value)}</strong>
                        </div>
                      ),
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum pagamento registrado.
                    </p>
                  )}
                </div>
              </section>
              {movementOpen && (
                <form
                  onSubmit={saveMovement}
                  className="grid gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:grid-cols-3"
                >
                  <Filter label="Tipo">
                    <select
                      className="field"
                      value={movement.type}
                      onChange={(e) =>
                        setMovement((v) => ({ ...v, type: e.target.value }))
                      }
                    >
                      <option value="entrada">Entrada</option>
                      <option value="retirada">Retirada</option>
                    </select>
                  </Filter>
                  <Filter label="Valor">
                    <input
                      className="field"
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={movement.amount}
                      onChange={(e) =>
                        setMovement((v) => ({ ...v, amount: e.target.value }))
                      }
                    />
                  </Filter>
                  <Filter label="Motivo">
                    <input
                      className="field"
                      required
                      maxLength={500}
                      value={movement.note}
                      onChange={(e) =>
                        setMovement((v) => ({ ...v, note: e.target.value }))
                      }
                    />
                  </Filter>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50 sm:col-span-3"
                  >
                    {saving ? "Registrando..." : "Confirmar movimentação"}
                  </button>
                </form>
              )}
              <section>
                <h3 className="mb-3 font-black">Entradas e retiradas</h3>
                {summary.movements?.length ? (
                  <div className="space-y-2">
                    {summary.movements.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-border p-3"
                      >
                        <span
                          className={
                            item.type === "entrada"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }
                        >
                          {item.type === "entrada" ? (
                            <PlusCircle className="h-5 w-5" />
                          ) : (
                            <MinusCircle className="h-5 w-5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <strong className="block text-sm capitalize">
                            {item.type}
                          </strong>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.note || "Sem observação"} ·{" "}
                            {formatDate(item.created_at || item.created_date)}
                          </p>
                        </div>
                        <strong>{formatCurrency(item.amount)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma entrada ou retirada avulsa.
                  </p>
                )}
              </section>
              <section>
                <h3 className="mb-3 font-black">Vendas vinculadas</h3>
                {summary.sales?.length ? (
                  <div className="space-y-2">
                    {summary.sales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
                      >
                        <div>
                          <strong>Venda #{sale.sale_number}</strong>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(sale.created_date)} · {sale.status}
                          </p>
                        </div>
                        <strong>{formatCurrency(sale.total)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma venda vinculada a este caixa.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Filter({ label, children }) {
  return (
    <label className="block text-xs font-bold text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
function Metric({ label, value, icon: Icon, tone = "text-accent" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div
        className={`mb-3 grid h-9 w-9 place-items-center rounded-xl bg-muted ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-xl font-black tabular-nums">
        {value}
      </strong>
    </div>
  );
}
function Status({ value }) {
  const open = value === "aberto";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${open ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}
    >
      {open ? "Em andamento" : "Fechado"}
    </span>
  );
}
function Value({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-bold tabular-nums">{value}</dd>
    </div>
  );
}
function ValueCard({ label, value, hint = null }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-black tabular-nums">{value}</dd>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
