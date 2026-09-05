import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { Archive, Ban, Banknote, CalendarRange, Check, Clock, CreditCard, HandCoins, Phone, QrCode, RotateCcw, Search, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/helpers';
import { usePagination } from '@/hooks/use-pagination';
import PaginationControls from '@/components/common/PaginationControls';
import { useModalBehavior } from '@/hooks/use-modal-behavior';
import { useConfirm } from '@/components/common/ConfirmProvider';
import { ErrorState } from '@/components/common/PageState';
import { getPaymentVisual } from '@/components/common/visualTokens';
import { matchesFiadoFilters } from '@/lib/fiado-filters';
import {
  FilterPanel,
  MetricCard,
  PageHeader,
} from '@/components/common/AppShell';

/** @type {Array<[string, string, React.ElementType]>} */
const SETTLEMENT_METHODS = [
  ['dinheiro', 'Dinheiro', Banknote],
  ['pix', 'Pix', QrCode],
  ['debito', 'Débito', CreditCard],
  ['credito', 'Crédito', CreditCard],
];

export default function Fiados() {
  const confirm = useConfirm();
  const { user } = /** @type {any} */ (useOutletContext());
  const isGerente = user.role === 'gerente' || user.role === 'admin';
  const [fiados, setFiados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filterStatus, setFilterStatus] = useState('');
  const [settledFrom, setSettledFrom] = useState('');
  const [settledTo, setSettledTo] = useState('');
  const [settleFiado, setSettleFiado] = useState(null);
  const [cancelFiado, setCancelFiado] = useState(null);
  const [settlementSale, setSettlementSale] = useState(null);
  const [settlementSaleLoading, setSettlementSaleLoading] = useState(false);
  const [settlementSaleError, setSettlementSaleError] = useState('');
  const [processing, setProcessing] = useState(false);
  const debtModalRef = useModalBehavior({
    active: Boolean(settleFiado || cancelFiado),
    disabled: processing,
    onClose: () => { setSettleFiado(null); setCancelFiado(null); },
  });

  const loadFiados = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await nexoApi.entities.FiadoRecord.list('-created_date', 1000);
      setFiados(data.filter((item) => item.archived !== true));
    } catch (error) {
      setLoadError(error.message || 'Não foi possível carregar os fiados.');
      toast.error(error.message || 'Erro ao carregar fiados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiados(); }, []);

  useEffect(() => {
    if (!settleFiado?.sale_id) {
      setSettlementSale(null);
      setSettlementSaleError('');
      setSettlementSaleLoading(false);
      return undefined;
    }
    let active = true;
    setSettlementSale(null);
    setSettlementSaleError('');
    setSettlementSaleLoading(true);
    nexoApi.entities.Sale.get(settleFiado.sale_id)
      .then((sale) => {
        if (!active) return;
        setSettlementSale(sale);
      })
      .catch((error) => {
        if (!active) return;
        setSettlementSaleError(error.message || 'Não foi possível carregar os itens da venda.');
      })
      .finally(() => {
        if (active) setSettlementSaleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [settleFiado]);

  const filtered = useMemo(
    () =>
      fiados.filter((item) =>
        matchesFiadoFilters(item, {
          query: deferredSearch,
          status: filterStatus,
          settledFrom,
          settledTo,
        }),
      ),
    [fiados, deferredSearch, filterStatus, settledFrom, settledTo],
  );

  const totals = useMemo(() => ({
    pending: filtered.filter(item => item.status === 'pendente').reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
    settled: filtered.filter(item => item.status === 'quitado').reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
    pendingCount: filtered.filter(item => item.status === 'pendente').length,
  }), [filtered]);

  const { page, setPage, pageCount, visibleItems: visibleFiados, pageSize } = usePagination(filtered, 20);

  const canManage = fiado => isGerente || fiado.seller_id === user.id;

  const handleSettle = async method => {
    if (!settleFiado || processing) return;
    setProcessing(true);
    try {
      await nexoApi.entities.FiadoRecord.update(settleFiado.id, {
        status: 'quitado',
        settlement_date: new Date().toISOString(),
        settlement_method: method,
        settled_by_id: user.id,
        settled_by_name: user.full_name || user.email,
      });
      toast.success(
        method === 'dinheiro'
          ? 'Fiado quitado. O recebimento foi enviado ao caixa aberto.'
          : 'Fiado quitado e recebimento atualizado no Financeiro.',
      );
      setSettleFiado(null);
      await loadFiados();
    } catch (error) {
      toast.error(error.message || 'Erro ao quitar fiado.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelFiado || processing) return;
    setProcessing(true);
    try {
      await nexoApi.entities.FiadoRecord.update(cancelFiado.id, {
        status: 'cancelado',
        settled_by_id: user.id,
        settled_by_name: user.full_name || user.email,
      });
      toast.success('Fiado cancelado. Nenhum recebimento foi lançado.');
      setCancelFiado(null);
      await loadFiados();
    } catch (error) {
      toast.error(error.message || 'Erro ao cancelar fiado.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReopen = async (item) => {
    if (!isGerente || processing) return;
    const confirmed = await confirm({
      title: 'Desfazer quitação?',
      description: `A venda fiada #${item.sale_number}, de ${item.responsible_name}, voltará a aparecer como pendente.`,
      confirmLabel: 'Desfazer quitação',
      cancelLabel: 'Manter quitada',
    });
    if (!confirmed) return;
    setProcessing(true);
    try {
      await nexoApi.entities.FiadoRecord.update(item.id, {
        status: 'pendente',
      });
      toast.success('Quitação desfeita e recebimento anterior estornado.');
      await loadFiados();
    } catch (error) {
      toast.error(error.message || 'Erro ao desfazer quitação.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (item) => {
    if (!isGerente || processing) return;
    const confirmed = await confirm({
      title: 'Arquivar venda fiada?',
      description: `A venda fiada #${item.sale_number}, de ${item.responsible_name}, sairá desta lista. O recebimento, o saldo e a auditoria serão preservados.`,
      confirmLabel: 'Arquivar registro',
      cancelLabel: 'Voltar',
      tone: 'destructive',
    });
    if (!confirmed) return;
    setProcessing(true);
    try {
      await nexoApi.entities.FiadoRecord.delete(item.id);
      toast.success('Fiado arquivado. Os dados financeiros foram preservados.');
      await loadFiados();
    } catch (error) {
      toast.error(error.message || 'Erro ao arquivar fiado.');
    } finally {
      setProcessing(false);
    }
  };

  const hasFilters = Boolean(search || filterStatus || settledFrom || settledTo);
  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setSettledFrom('');
    setSettledTo('');
  };

  return (
    <div className="page-shell !max-w-6xl">
      <PageHeader
        icon={HandCoins}
        eyebrow="Contas a receber"
        title="Vendas fiadas"
        description="Pendências e recebimentos."
        tone="orange"
      />

      <div className="mb-2 grid grid-cols-3 gap-1.5 sm:mb-3 sm:gap-2">
        <MetricCard icon={HandCoins} label="Total pendente" value={formatCurrency(totals.pending)} tone="orange" />
        <MetricCard icon={Clock} label="Pendências" value={totals.pendingCount} />
        <MetricCard icon={Check} label="Total quitado" value={formatCurrency(totals.settled)} tone="green" />
      </div>

      <FilterPanel aria-label="Filtros de fiados">
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-[minmax(15rem,1fr)_170px_160px_160px_auto]">
          <label className="relative">
            <span className="sr-only">Buscar fiados</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente, telefone ou venda" className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-10 sm:pl-10 sm:pr-4" />
          </label>
          <select aria-label="Filtrar por status" value={filterStatus} onChange={event => setFilterStatus(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-10">
            <option value="">Todos status</option>
            <option value="pendente">Pendentes</option>
            <option value="quitado">Quitados</option>
            <option value="cancelado">Cancelados</option>
          </select>
          <label className="relative">
            <span className="pointer-events-none absolute left-9 top-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Quitados de</span>
            <CalendarRange className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              aria-label="Quitados de"
              title="Data inicial da quitação"
              value={settledFrom}
              max={settledTo || undefined}
              onChange={event => setSettledFrom(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background pb-0.5 pl-9 pr-2 pt-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-10"
            />
          </label>
          <label className="relative">
            <span className="pointer-events-none absolute left-9 top-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Quitados até</span>
            <CalendarRange className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              aria-label="Quitados até"
              title="Data final da quitação"
              value={settledTo}
              min={settledFrom || undefined}
              onChange={event => setSettledTo(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background pb-0.5 pl-9 pr-2 pt-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-10"
            />
          </label>
          {hasFilters && <button type="button" onClick={clearFilters} className="min-h-9 rounded-lg border border-border px-3 text-sm font-bold hover:bg-muted sm:min-h-10">Limpar</button>}
        </div>
        {(settledFrom || settledTo) && filterStatus !== 'quitado' && (
          <p className="mt-2 text-xs text-muted-foreground">
            O período filtra apenas os quitados. Fiados pendentes continuam visíveis em qualquer data.
          </p>
        )}
      </FilterPanel>

      {loading ? (
        <div role="status" aria-live="polite" aria-busy="true" className="loading-state"><div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-4 border-muted border-t-accent" /><p className="text-sm">Carregando fiados...</p></div>
      ) : loadError && !fiados.length ? (
        <ErrorState description={loadError} onRetry={loadFiados} />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-4 text-center"><HandCoins className="mx-auto h-7 w-7 text-muted-foreground/25" /><h2 className="mt-2 text-sm font-bold">Nenhum fiado encontrado</h2><p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou registre uma venda fiada no PDV.</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-3 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground">Limpar</button>}</div>
      ) : (
        <div className="grid gap-2">
          {visibleFiados.map(item => {
            const pending = item.status === 'pendente';
            const settled = item.status === 'quitado';
            return (
              <article key={item.id} className="surface-card p-2.5 sm:p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className={`grid h-8 w-8 flex-none place-items-center rounded-lg sm:h-10 sm:w-10 ${pending ? 'bg-orange-500/10 text-orange-600' : settled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                    {pending ? <Clock className="h-5 w-5" /> : settled ? <Check className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-black">{item.responsible_name}</h2>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Venda #{item.sale_number}</span>
                      <span>{formatDateTime(item.created_date)}</span>
                      {isGerente && item.seller_name && <span>Vendedor: {item.seller_name}</span>}
                      {item.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {item.phone}</span>}
                    </div>
                    {item.observation && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.observation}</p>}
                    {settled && item.settlement_date && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">Quitado em {formatDateTime(item.settlement_date)} · {item.settlement_method || 'forma não informada'}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <strong className="text-base font-black tabular-nums sm:text-lg">{formatCurrency(item.total_amount)}</strong>
                    <div className="flex gap-2">
                      {pending && canManage(item) && (
                        <>
                          <button type="button" onClick={() => setSettleFiado(item)} className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700">Quitar</button>
                          <button type="button" onClick={() => setCancelFiado(item)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 text-xs font-bold text-destructive hover:bg-destructive/10" aria-label={`Cancelar fiado de ${item.responsible_name}`}><Ban className="h-3.5 w-3.5" /> Cancelar</button>
                        </>
                      )}
                      {settled && isGerente && (
                        <>
                          <button type="button" disabled={processing} onClick={() => handleReopen(item)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-accent/30 px-2.5 text-xs font-bold text-accent hover:bg-accent/10 disabled:opacity-50" aria-label={`Desfazer quitação de ${item.responsible_name}`}>
                            <RotateCcw className="h-3.5 w-3.5" />
                            Desfazer
                          </button>
                          <button type="button" disabled={processing} onClick={() => handleDelete(item)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label={`Arquivar fiado de ${item.responsible_name}`}>
                            <Archive className="h-3.5 w-3.5" />
                            Arquivar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <PaginationControls page={page} pageCount={pageCount} total={filtered.length} pageSize={pageSize} onPageChange={setPage} />
      )}

      {settleFiado && (
        <div className="modal-overlay" onMouseDown={event => event.target === event.currentTarget && !processing && setSettleFiado(null)} role="presentation">
          <div ref={debtModalRef} tabIndex={-1} className="modal-panel sm:max-w-md" role="dialog" aria-modal="true" aria-labelledby="settle-title">
            <ModalHeader id="settle-title" title="Quitar fiado" subtitle={`${settleFiado.responsible_name} · ${formatCurrency(settleFiado.total_amount)}`} onClose={() => setSettleFiado(null)} disabled={processing} />
            <div className="modal-body space-y-3">
            <section className="rounded-lg border border-border/80 bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">Itens da venda</h3>
                <span className="text-xs font-semibold text-muted-foreground">
                  {settlementSale?.items?.length ?? 0} itens
                </span>
              </div>
              {settlementSaleLoading ? (
                <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  Carregando itens da venda...
                </div>
              ) : settlementSaleError ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {settlementSaleError}
                </div>
              ) : (settlementSale?.items || []).length ? (
                <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1 sm:max-h-56">
                  {settlementSale.items.map((item, index) => (
                    <div key={`${item.product_id || item.product_name || index}-${index}`} className="grid grid-cols-[auto_1fr_auto] gap-2 rounded-xl border border-border px-3 py-2.5 text-sm">
                      <span className="font-bold tabular-nums text-muted-foreground">
                        {item.unit === 'peso'
                          ? `${Number(item.weight || 0).toFixed(2)}kg`
                          : `${Number(item.quantity || 0)}x`}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.product_name || 'Produto sem nome'}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.unit === 'peso'
                            ? 'Venda por peso'
                            : 'Venda por unidade'}
                        </p>
                      </div>
                      <span className="whitespace-nowrap font-bold tabular-nums">
                        {formatCurrency(item.subtotal || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  Nenhum item encontrado para esta venda.
                </div>
              )}
            </section>
            <p className="text-sm font-semibold">Selecione a forma de recebimento:</p>
            <div className="grid grid-cols-2 gap-2">
              {SETTLEMENT_METHODS.map(([method, label, Icon]) => <button key={method} type="button" disabled={processing} onClick={() => handleSettle(method)} className={`modal-button border disabled:opacity-50 ${getPaymentVisual(method).badge}`}><Icon className="h-4 w-4" />{label}</button>)}
            </div>
            </div>
          </div>
        </div>
      )}

      {cancelFiado && (
        <div className="modal-overlay" onMouseDown={event => event.target === event.currentTarget && !processing && setCancelFiado(null)} role="presentation">
          <div ref={debtModalRef} tabIndex={-1} className="modal-panel sm:max-w-md" role="alertdialog" aria-modal="true" aria-labelledby="cancel-fiado-title">
            <ModalHeader id="cancel-fiado-title" title="Cancelar fiado" subtitle={`${cancelFiado.responsible_name} · ${formatCurrency(cancelFiado.total_amount)}`} onClose={() => setCancelFiado(null)} disabled={processing} />
            <div className="modal-body"><div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">O registro deixará de aparecer como pendente. Esta ação ficará registrada na auditoria.</div></div>
            <div className="modal-footer"><div className="modal-actions"><button type="button" disabled={processing} onClick={() => setCancelFiado(null)} className="modal-button border border-border hover:bg-muted disabled:opacity-50">Voltar</button><button type="button" disabled={processing} onClick={handleCancel} className="modal-button modal-actions-primary bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">{processing ? 'Cancelando...' : 'Confirmar'}</button></div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = status === 'pendente' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300' : status === 'quitado' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground';
  const label = status === 'pendente' ? 'Pendente' : status === 'quitado' ? 'Quitado' : 'Cancelado';
  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${styles}`}>{label}</span>;
}

function ModalHeader({ id, title, subtitle, onClose, disabled }) {
  return <div className="modal-header"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><HandCoins className="h-5 w-5" /></span><div className="min-w-0"><h2 id={id} className="modal-title truncate">{title}</h2><p className="modal-subtitle truncate">{subtitle}</p></div></div><button type="button" disabled={disabled} onClick={onClose} className="modal-icon-button" aria-label="Fechar"><X className="h-5 w-5" /></button></div>;
}
