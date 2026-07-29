import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { Ban, Check, Clock, HandCoins, Phone, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/helpers';
import { usePagination } from '@/hooks/use-pagination';
import PaginationControls from '@/components/common/PaginationControls';
import { useModalBehavior } from '@/hooks/use-modal-behavior';
import { ErrorState } from '@/components/common/PageState';
import {
  FilterPanel,
  MetricCard,
  PageHeader,
} from '@/components/common/AppShell';

const SETTLEMENT_METHODS = [
  ['dinheiro', 'Dinheiro'],
  ['pix', 'Pix'],
  ['debito', 'Débito'],
  ['credito', 'Crédito'],
];

export default function Fiados() {
  const { user } = /** @type {any} */ (useOutletContext());
  const isGerente = user.role === 'gerente' || user.role === 'admin';
  const [fiados, setFiados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filterStatus, setFilterStatus] = useState('');
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
      const data = await nexoApi.entities.FiadoRecord.list('-created_date', 300);
      setFiados(data);
    } catch (error) {
      setLoadError(error.message || 'Não foi possível carregar os fiados.');
      toast.error(error.message || 'Erro ao carregar fiados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiados(); }, []);

  useEffect(() => {
    if (!settleFiado && !cancelFiado) return undefined;
    const closeOnEscape = event => {
      if (event.key !== 'Escape' || processing) return;
      setSettleFiado(null);
      setCancelFiado(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [settleFiado, cancelFiado, processing]);

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

  const filtered = useMemo(() => fiados.filter(item => {
    const query = deferredSearch.trim().toLowerCase();
    const matchSearch = !query
      || String(item.responsible_name || '').toLowerCase().includes(query)
      || String(item.phone || '').toLowerCase().includes(query)
      || String(item.sale_number || '').includes(query);
    return matchSearch && (!filterStatus || item.status === filterStatus);
  }), [fiados, deferredSearch, filterStatus]);

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
      await nexoApi.entities.GeneralAudit.create({
        action_type: 'fiado_quitado',
        entity_type: 'fiado',
        entity_id: settleFiado.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        description: `Fiado #${settleFiado.sale_number} (${settleFiado.responsible_name}) quitado - ${formatCurrency(settleFiado.total_amount)}`,
        details: { method },
      });
      toast.success('Fiado quitado.');
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
      await nexoApi.entities.GeneralAudit.create({
        action_type: 'fiado_cancelado',
        entity_type: 'fiado',
        entity_id: cancelFiado.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        description: `Fiado #${cancelFiado.sale_number} (${cancelFiado.responsible_name}) cancelado`,
        details: '',
      });
      toast.success('Fiado cancelado.');
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
    const confirmed = window.confirm(
      `Desfazer a quitação do fiado #${item.sale_number} de ${item.responsible_name}?`,
    );
    if (!confirmed) return;
    setProcessing(true);
    try {
      await nexoApi.entities.FiadoRecord.update(item.id, {
        status: 'pendente',
      });
      await nexoApi.entities.GeneralAudit.create({
        action_type: 'fiado_quitacao_desfeita',
        entity_type: 'fiado',
        entity_id: item.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        description: `Quitação do fiado #${item.sale_number} (${item.responsible_name}) desfeita`,
        details: '',
      });
      toast.success('Quitação desfeita.');
      await loadFiados();
    } catch (error) {
      toast.error(error.message || 'Erro ao desfazer quitação.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (item) => {
    if (!isGerente || processing) return;
    const confirmed = window.confirm(
      `Excluir definitivamente o fiado #${item.sale_number} de ${item.responsible_name}?`,
    );
    if (!confirmed) return;
    setProcessing(true);
    try {
      await nexoApi.entities.FiadoRecord.delete(item.id);
      toast.success('Fiado excluído.');
      await loadFiados();
    } catch (error) {
      toast.error(error.message || 'Erro ao excluir fiado.');
    } finally {
      setProcessing(false);
    }
  };

  const hasFilters = Boolean(search || filterStatus);
  const clearFilters = () => { setSearch(''); setFilterStatus(''); };

  return (
    <div className="page-shell !max-w-6xl">
      <PageHeader
        icon={HandCoins}
        eyebrow="Contas a receber"
        title="Vendas fiado"
        description="Acompanhe pendências e registre os recebimentos."
        tone="orange"
      />

      <div className="mb-3 grid grid-cols-3 gap-2 sm:mb-4 sm:grid-cols-3 sm:gap-3">
        <MetricCard label="Total pendente" value={formatCurrency(totals.pending)} tone="orange" />
        <MetricCard label="Pendências" value={totals.pendingCount} />
        <MetricCard label="Total quitado" value={formatCurrency(totals.settled)} tone="green" />
      </div>

      <FilterPanel aria-label="Filtros de fiados">
        <div className="grid gap-2 sm:grid-cols-[1fr_190px_auto]">
          <label className="relative">
            <span className="sr-only">Buscar fiados</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Responsável, telefone ou número da venda" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-11 sm:rounded-xl sm:pl-10 sm:pr-4" />
          </label>
          <select aria-label="Filtrar por status" value={filterStatus} onChange={event => setFilterStatus(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-11 sm:rounded-xl">
            <option value="">Todos status</option>
            <option value="pendente">Pendentes</option>
            <option value="quitado">Quitados</option>
            <option value="cancelado">Cancelados</option>
          </select>
          {hasFilters && <button type="button" onClick={clearFilters} className="min-h-10 rounded-lg border border-border px-3 text-sm font-bold hover:bg-muted sm:min-h-11 sm:rounded-xl">Limpar</button>}
        </div>
      </FilterPanel>

      {loading ? (
        <div role="status" aria-live="polite" aria-busy="true" className="rounded-xl border border-border bg-card py-8 text-center text-muted-foreground sm:rounded-2xl sm:py-12"><div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-4 border-muted border-t-accent" /><p className="text-sm">Carregando fiados...</p></div>
      ) : loadError && !fiados.length ? (
        <ErrorState description={loadError} onRetry={loadFiados} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center sm:rounded-2xl sm:py-10"><HandCoins className="mx-auto h-9 w-9 text-muted-foreground/25" /><h2 className="mt-3 font-bold">Nenhum fiado encontrado</h2><p className="mt-1 text-sm text-muted-foreground">Não há registros para os filtros selecionados.</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">Limpar filtros</button>}</div>
      ) : (
        <div className="grid gap-3">
          {visibleFiados.map(item => {
            const pending = item.status === 'pendente';
            const settled = item.status === 'quitado';
            return (
              <article key={item.id} className="rounded-xl border border-border bg-card p-2.5 shadow-sm sm:rounded-2xl sm:p-4">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className={`grid h-8 w-8 flex-none place-items-center rounded-lg sm:h-11 sm:w-11 sm:rounded-2xl ${pending ? 'bg-orange-500/10 text-orange-600' : settled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
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
                    {item.observation && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.observation}</p>}
                    {settled && item.settlement_date && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">Quitado em {formatDateTime(item.settlement_date)} · {item.settlement_method || 'forma não informada'}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <strong className="text-lg font-black tabular-nums sm:text-xl">{formatCurrency(item.total_amount)}</strong>
                    <div className="flex gap-2">
                      {pending && canManage(item) && (
                        <>
                          <button type="button" onClick={() => setSettleFiado(item)} className="min-h-10 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">Quitar</button>
                          <button type="button" onClick={() => setCancelFiado(item)} className="grid h-10 w-10 place-items-center rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10" aria-label={`Cancelar fiado de ${item.responsible_name}`}><Ban className="h-4 w-4" /></button>
                        </>
                      )}
                      {settled && isGerente && (
                        <>
                          <button type="button" disabled={processing} onClick={() => handleReopen(item)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-accent/30 px-3 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-50" aria-label={`Desfazer quitação de ${item.responsible_name}`}>
                            <RotateCcw className="h-4 w-4" />
                            Desfazer quitação
                          </button>
                          <button type="button" disabled={processing} onClick={() => handleDelete(item)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-destructive/30 px-3 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50" aria-label={`Excluir fiado de ${item.responsible_name}`}>
                            <Trash2 className="h-4 w-4" />
                            Excluir
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && !processing && setSettleFiado(null)} role="presentation">
          <div ref={debtModalRef} tabIndex={-1} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="settle-title">
            <ModalHeader id="settle-title" title="Quitar fiado" subtitle={`${settleFiado.responsible_name} · ${formatCurrency(settleFiado.total_amount)}`} onClose={() => setSettleFiado(null)} disabled={processing} />
            <section className="mt-4 rounded-2xl border border-border bg-background p-4">
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
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {settlementSale.items.map((item, index) => (
                    <div key={`${item.product_id || item.product_name || index}-${index}`} className="grid grid-cols-[auto_1fr_auto] gap-2 rounded-xl border border-border px-3 py-2.5 text-sm">
                      <span className="font-bold tabular-nums text-muted-foreground">
                        {item.unit === 'peso'
                          ? `${Number(item.weight || 0).toFixed(3)}kg`
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
            <p className="mt-5 text-sm font-semibold">Selecione a forma de recebimento:</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {SETTLEMENT_METHODS.map(([method, label]) => <button key={method} type="button" disabled={processing} onClick={() => handleSettle(method)} className="min-h-12 rounded-xl border border-border bg-background text-sm font-bold transition hover:border-accent hover:bg-accent/5 disabled:opacity-50">{label}</button>)}
            </div>
          </div>
        </div>
      )}

      {cancelFiado && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && !processing && setCancelFiado(null)} role="presentation">
          <div ref={debtModalRef} tabIndex={-1} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="cancel-fiado-title">
            <ModalHeader id="cancel-fiado-title" title="Cancelar fiado" subtitle={`${cancelFiado.responsible_name} · ${formatCurrency(cancelFiado.total_amount)}`} onClose={() => setCancelFiado(null)} disabled={processing} />
            <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">O registro deixará de aparecer como pendente. Esta ação ficará registrada na auditoria.</div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={processing} onClick={() => setCancelFiado(null)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50">Voltar</button><button type="button" disabled={processing} onClick={handleCancel} className="min-h-11 rounded-xl bg-destructive px-5 text-sm font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">{processing ? 'Cancelando...' : 'Confirmar cancelamento'}</button></div>
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
  return <div className="flex items-start justify-between gap-4"><div><h2 id={id} className="text-xl font-black">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div><button type="button" disabled={disabled} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label="Fechar"><X className="h-5 w-5" /></button></div>;
}
