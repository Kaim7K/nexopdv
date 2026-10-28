import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { nexoApi } from "@/api/nexoApi";
import { useModalBehavior } from "@/hooks/use-modal-behavior";
import { formatDateTime } from "@/lib/helpers";

export default function ProductTrash({ onClose, onRestored }) {
  const [data, setData] = useState({
    items: [],
    page_count: 1,
    legacy_incidents: [],
  });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const ref = useModalBehavior({
    active: true,
    onClose,
    disabled: Boolean(busy),
  });
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    nexoApi.products
      .trash(page)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);
  const restore = async (product) => {
    if (busy) return;
    setBusy(product.id);
    setError("");
    setMessage("");
    try {
      await nexoApi.products.restore(product.id);
      setMessage(`“${product.name}” restaurado com seus dados originais.`);
      setRevision((value) => value + 1);
      onRestored();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="modal-overlay">
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-trash-title"
        className="modal-panel sm:max-w-3xl"
      >
        <header className="modal-header">
          <div>
            <h2 id="product-trash-title" className="modal-title">
              Lixeira de produtos
            </h2>
            <p className="modal-subtitle">
              Recupere cadastros sem sobrescrever produtos existentes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            className="modal-icon-button"
            aria-label="Fechar lixeira"
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body space-y-4">
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            A limpeza automática de inativos está suspensa. A lixeira protege as
            exclusões feitas após esta atualização. Produtos apagados
            anteriormente sem cópia precisam de recuperação a partir de backup.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="text-sm font-semibold text-emerald-700 dark:text-emerald-300"
            >
              {message}
            </p>
          )}
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando lixeira...
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {data.items.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-bold">
                      {product.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {product.barcode || "Sem código de barras"} · Quantidade
                      original: {product.quantity ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Enviado à lixeira: {formatDateTime(product.deleted_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => restore(product)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50"
                  >
                    <RotateCcw size={15} />
                    {busy === product.id ? "Restaurando..." : "Restaurar"}
                  </button>
                </li>
              ))}
              {!data.items.length && (
                <li className="p-4 text-sm text-muted-foreground">
                  Nenhum produto com cópia recuperável nesta lixeira.
                </li>
              )}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              disabled={page <= 1 || loading || Boolean(busy)}
              onClick={() => setPage((value) => value - 1)}
              className="min-h-10 px-2 disabled:opacity-40"
            >
              Anterior
            </button>
            <span>
              Página {page} de {data.page_count}
            </span>
            <button
              type="button"
              disabled={page >= data.page_count || loading || Boolean(busy)}
              onClick={() => setPage((value) => value + 1)}
              className="min-h-10 px-2 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
          {data.legacy_incidents.length > 0 && (
            <div className="rounded-xl border border-border p-3">
              <h3 className="text-sm font-bold">
                Exclusões antigas que precisam de backup
              </h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {data.legacy_incidents.map((incident) => (
                  <li key={incident.id}>
                    {formatDateTime(incident.created_date)} ·{" "}
                    {Number(incident.deleted || 0)} produto(s) · sem cópia
                    guardada pela função antiga
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
