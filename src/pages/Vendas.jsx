import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { usePagination } from '@/hooks/use-pagination';
import PaginationControls from '@/components/common/PaginationControls';
import { Ban, Eye, History, Search, Trash2, X } from 'lucide-react';
import {
  calculateSaleTotals,
  formatCurrency,
  formatDateTime,
  formatDiscount,
  getPaymentLabel,
  PAYMENT_METHODS,
} from '@/lib/helpers';

export default function Vendas() {
  const { user } = /** @type {any} */ (useOutletContext());
  const isGerente = user.role === 'gerente' || user.role === 'admin';
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSeller, setFilterSeller] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detailSale, setDetailSale] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadSales = async () => {
    setLoading(true);
    try {
      let data = await nexoApi.entities.Sale.list('-created_date', 300);
      data = data.filter(sale => ['concluida', 'cancelada'].includes(sale.status));
      if (!isGerente) data = data.filter(sale => sale.seller_id === user.id);
      setSales(data);
    } catch (error) {
      toast.error(error.message || 'Erro ao carregar vendas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSales(); }, []);

  useEffect(() => {
    if (!pendingAction && !detailSale) return undefined;
    const closeOnEscape = event => {
      if (event.key !== 'Escape' || processing) return;
      setPendingAction(null);
      setDetailSale(null);
      setCancelReason('');
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [pendingAction, detailSale, processing]);

  const sellers = useMemo(() => [...new Set(sales.map(sale => sale.seller_name).filter(Boolean))].sort(), [sales]);

  const filtered = useMemo(() => sales.filter(sale => {
    const query = search.trim().toLowerCase();
    const payments = (sale.payments || []).map(payment => getPaymentLabel(payment.method)).join(' ').toLowerCase();
    const matchSearch = !query
      || String(sale.sale_number).includes(query)
      || String(sale.seller_name || '').toLowerCase().includes(query)
      || payments.includes(query);
    const matchPayment = !filterPayment || (sale.payments || []).some(payment => payment.method === filterPayment);
    const matchSeller = !filterSeller || sale.seller_name === filterSeller;
    const matchStatus = !filterStatus || sale.status === filterStatus;
    return matchSearch && matchPayment && matchSeller && matchStatus;
  }), [sales, search, filterPayment, filterSeller, filterStatus]);

  const { page, setPage, pageCount, visibleItems: visibleSales, pageSize } = usePagination(filtered, 20);

  const canCancel = sale => isGerente || sale.seller_id === user.id;
  const clearFilters = () => {
    setSearch('');
    setFilterPayment('');
    setFilterSeller('');
    setFilterStatus('');
  };
  const hasFilters = Boolean(search || filterPayment || filterSeller || filterStatus);

  const requestCancel = sale => {
    setCancelReason('');
    setPendingAction({ type: 'cancel', sale });
  };

  const requestDelete = sale => setPendingAction({ type: 'delete', sale });

  const confirmAction = async () => {
    if (!pendingAction) return;
    setProcessing(true);
    try {
      if (pendingAction.type === 'cancel') {
        await nexoApi.sales.cancel(pendingAction.sale.id, cancelReason.trim());
        toast.success('Venda cancelada e estoque restaurado.');
      } else {
        await nexoApi.sales.delete(pendingAction.sale.id);
        toast.success('Venda excluída definitivamente.');
      }
      setPendingAction(null);
      setCancelReason('');
      if (detailSale?.id === pendingAction.sale.id) setDetailSale(null);
      await loadSales();
    } catch (error) {
      toast.error(error.message || `Erro ao ${pendingAction.type === 'cancel' ? 'cancelar' : 'excluir'} venda.`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
          <History className="h-3.5 w-3.5" /> Histórico e acompanhamento
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Histórico de vendas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isGerente ? 'Vendas de toda a equipe' : 'Suas vendas'} · {filtered.length} de {sales.length} registros
        </p>
      </div>

      <section className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm" aria-label="Filtros de vendas">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_190px_180px_170px_auto]">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Buscar vendas</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Número, vendedor ou pagamento"
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          {isGerente && (
            <select aria-label="Filtrar por vendedor" value={filterSeller} onChange={event => setFilterSeller(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="">Todos vendedores</option>
              {sellers.map(seller => <option key={seller} value={seller}>{seller}</option>)}
            </select>
          )}
          <select aria-label="Filtrar por pagamento" value={filterPayment} onChange={event => setFilterPayment(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
            <option value="">Todos pagamentos</option>
            {PAYMENT_METHODS.map(payment => <option key={payment.method} value={payment.method}>{payment.label}</option>)}
          </select>
          <select aria-label="Filtrar por status" value={filterStatus} onChange={event => setFilterStatus(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
            <option value="">Todos status</option>
            <option value="concluida">Concluídas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="min-h-11 rounded-xl border border-border px-3 text-sm font-bold transition hover:bg-muted">Limpar</button>
          )}
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
          <p className="text-sm">Carregando vendas...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <History className="mx-auto h-11 w-11 text-muted-foreground/25" />
          <h2 className="mt-3 font-bold">Nenhuma venda encontrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">Altere os filtros para procurar outros registros.</p>
          {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">Limpar filtros</button>}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {visibleSales.map(sale => (
              <article key={sale.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">Venda #{sale.sale_number}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(sale.created_date)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${sale.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}>
                    {sale.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/35 p-3 text-sm">
                  <div><span className="block text-xs text-muted-foreground">Total</span><strong className="mt-0.5 block text-base">{formatCurrency(sale.total)}</strong></div>
                  <div><span className="block text-xs text-muted-foreground">Tipo</span><strong className="mt-0.5 block capitalize">{sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'}</strong></div>
                  <div className="col-span-2"><span className="block text-xs text-muted-foreground">Pagamento</span><strong className="mt-0.5 block">{(sale.payments || []).map(payment => getPaymentLabel(payment.method)).join(', ') || 'Não informado'}</strong></div>
                  {isGerente && <div className="col-span-2"><span className="block text-xs text-muted-foreground">Vendedor</span><strong className="mt-0.5 block">{sale.seller_name || 'Não informado'}</strong></div>}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setDetailSale(sale)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold hover:bg-muted"><Eye className="h-4 w-4" /> Detalhes</button>
                  {sale.status === 'concluida' && canCancel(sale) && <button type="button" onClick={() => requestCancel(sale)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 px-3 text-sm font-bold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"><Ban className="h-4 w-4" /> Cancelar</button>}
                  {sale.status === 'cancelada' && user.role === 'admin' && <button type="button" onClick={() => requestDelete(sale)} className="grid h-10 w-10 place-items-center rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10" aria-label={`Excluir venda ${sale.sale_number}`}><Trash2 className="h-4 w-4" /></button>}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/45 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Venda</th>
                    <th className="px-4 py-3 text-left font-semibold">Data e hora</th>
                    {isGerente && <th className="px-4 py-3 text-left font-semibold">Vendedor</th>}
                    <th className="px-4 py-3 text-left font-semibold">Pagamento</th>
                    <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSales.map(sale => (
                    <tr key={sale.id} className="border-t border-border transition-colors hover:bg-muted/25">
                      <td className="px-4 py-3 font-bold">#{sale.sale_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(sale.created_date)}</td>
                      {isGerente && <td className="px-4 py-3">{sale.seller_name || '—'}</td>}
                      <td className="max-w-[240px] px-4 py-3 text-muted-foreground">{(sale.payments || []).map(payment => getPaymentLabel(payment.method)).join(', ') || '—'}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${sale.sale_type === 'fiado' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'bg-muted text-muted-foreground'}`}>{sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'}</span></td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{formatCurrency(sale.total)}</td>
                      <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs font-bold ${sale.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}>{sale.status === 'concluida' ? 'Concluída' : 'Cancelada'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => setDetailSale(sale)} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={`Ver detalhes da venda ${sale.sale_number}`} title="Ver detalhes"><Eye className="h-4 w-4" /></button>
                          {sale.status === 'concluida' && canCancel(sale) && <button type="button" onClick={() => requestCancel(sale)} className="grid h-9 w-9 place-items-center rounded-lg text-amber-600 transition hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30" aria-label={`Cancelar venda ${sale.sale_number}`} title="Cancelar"><Ban className="h-4 w-4" /></button>}
                          {sale.status === 'cancelada' && user.role === 'admin' && <button type="button" onClick={() => requestDelete(sale)} className="grid h-9 w-9 place-items-center rounded-lg text-destructive transition hover:bg-destructive/10" aria-label={`Excluir venda ${sale.sale_number}`} title="Excluir definitivamente"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}


      {!loading && filtered.length > 0 && (
        <PaginationControls page={page} pageCount={pageCount} total={filtered.length} pageSize={pageSize} onPageChange={setPage} />
      )}

      {detailSale && <SaleDetailModal sale={detailSale} onClose={() => setDetailSale(null)} />}

      {pendingAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && !processing && setPendingAction(null)} role="presentation">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="sale-action-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="sale-action-title" className="text-xl font-black">{pendingAction.type === 'cancel' ? 'Cancelar venda' : 'Excluir venda'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Venda #{pendingAction.sale.sale_number} · {formatCurrency(pendingAction.sale.total)}</p>
              </div>
              <button type="button" disabled={processing} onClick={() => setPendingAction(null)} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>

            {pendingAction.type === 'cancel' ? (
              <>
                <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  Os produtos serão devolvidos ao estoque. Se a venda for fiado, o registro pendente também será cancelado.
                </div>
                <label className="mt-4 block text-sm font-semibold">
                  Motivo do cancelamento <span className="font-normal text-muted-foreground">(opcional)</span>
                  <textarea autoFocus rows={3} value={cancelReason} onChange={event => setCancelReason(event.target.value)} maxLength={300} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Ex.: cliente desistiu da compra" />
                </label>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Esta ação é definitiva. O histórico desta venda será removido, mas a auditoria da exclusão será mantida.
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={processing} onClick={() => setPendingAction(null)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50">Voltar</button>
              <button type="button" disabled={processing} onClick={confirmAction} className={`min-h-11 rounded-xl px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${pendingAction.type === 'cancel' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-destructive hover:bg-destructive/90'}`}>
                {processing ? 'Processando...' : pendingAction.type === 'cancel' ? 'Confirmar cancelamento' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaleDetailModal({ sale, onClose }) {
  const totals = calculateSaleTotals(sale);
  const discountLabel = sale.discount_type === 'percentual'
    ? `${formatDiscount(sale)} (${formatCurrency(totals.discount)})`
    : formatCurrency(totals.discount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card text-card-foreground shadow-2xl" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sale-detail-title">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <h2 id="sale-detail-title" className="text-lg font-black">Venda #{sale.sale_number}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(sale.created_date)}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar detalhes"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5 text-sm">
          <div className="grid gap-3 rounded-xl bg-muted/30 p-3 sm:grid-cols-2">
            <Info label="Vendedor" value={sale.seller_name || 'Não informado'} />
            <Info label="Tipo" value={sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'} />
            <Info label="Status" value={sale.status === 'concluida' ? 'Concluída' : 'Cancelada'} />
            <Info label="Pagamento" value={(sale.payments || []).map(payment => getPaymentLabel(payment.method)).join(', ') || 'Não informado'} />
          </div>
          {sale.observation && <Info label="Observação" value={sale.observation} />}
          {sale.cancellation_reason && <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3"><span className="block text-xs font-bold uppercase tracking-wide text-destructive">Motivo do cancelamento</span><p className="mt-1 text-sm">{sale.cancellation_reason}</p></div>}

          <section>
            <h3 className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">Produtos</h3>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {(sale.items || []).map((item, index) => {
                const amount = item.unit === 'peso' ? `${Number(item.weight || 0).toLocaleString('pt-BR')} kg` : `${item.quantity || 0} un.`;
                return (
                  <div key={`${item.product_id || item.product_name}-${index}`} className="flex items-center justify-between gap-4 px-3 py-3">
                    <div className="min-w-0"><p className="truncate font-semibold">{item.product_name}</p><p className="mt-0.5 text-xs text-muted-foreground">{amount}</p></div>
                    <span className="flex-none font-bold tabular-nums">{formatCurrency(item.subtotal)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totals.subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Desconto</span><span className="tabular-nums">{discountLabel}</span></div>
            <div className="flex justify-between border-t border-border pt-3 text-lg font-black"><span>Total</span><span className="text-accent tabular-nums">{formatCurrency(sale.total ?? totals.total)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return <div><span className="block text-xs font-semibold text-muted-foreground">{label}</span><span className="mt-0.5 block font-semibold">{value}</span></div>;
}
