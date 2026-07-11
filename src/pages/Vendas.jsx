import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import PaginationControls from '@/components/common/PaginationControls';
import {
  Ban,
  CalendarDays,
  Clock3,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  ReceiptText,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  calculateSaleTotals,
  formatCurrency,
  formatDateTime,
  formatDiscount,
  getPaymentLabel,
  PAYMENT_METHODS,
} from '@/lib/helpers';
import { downloadDailySalesReportPdf, downloadSaleReceiptPdf } from '@/lib/sales-pdf';

const PAGE_SIZE = 20;
const todayKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export default function Vendas() {
  const { user, config } = /** @type {any} */ (useOutletContext());
  const canSeeTeam = ['gerente', 'admin'].includes(user.role);
  const [sales, setSales] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSeller, setFilterSeller] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detailSale, setDetailSale] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportDate, setReportDate] = useState(todayKey);
  const [reportStart, setReportStart] = useState('00:00');
  const [reportEnd, setReportEnd] = useState('23:59');
  const [reportSeller, setReportSeller] = useState('');
  const [reportPayment, setReportPayment] = useState('');
  const requestSequence = useRef(0);

  const receiptConfig = useMemo(() => ({
    ...config,
    logo_url: config.logo_url || user.logo_url,
    nome_mercado: config.nome_mercado || user.market_name,
    market_name: user.market_name,
  }), [config, user.logo_url, user.market_name]);

  const loadSales = async ({ immediateSearch = search } = {}) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const data = await nexoApi.sales.list({
        page,
        pageSize: PAGE_SIZE,
        search: immediateSearch.trim(),
        sellerId: canSeeTeam ? filterSeller : '',
        payment: filterPayment,
        status: filterStatus,
        includeSellers: sellers.length === 0,
      });
      if (sequence !== requestSequence.current) return;
      setSales(data.items || []);
      setTotal(Number(data.total || 0));
      setPageCount(Math.max(1, Number(data.page_count || 1)));
      if (Array.isArray(data.sellers) && data.sellers.length) setSellers(data.sellers);
      if (page > Number(data.page_count || 1)) setPage(Math.max(1, Number(data.page_count || 1)));
    } catch (error) {
      if (sequence === requestSequence.current) toast.error(error.message || 'Erro ao carregar vendas.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => loadSales(), search ? 280 : 0);
    return () => window.clearTimeout(timeout);
  }, [page, search, filterPayment, filterSeller, filterStatus]);

  useEffect(() => {
    if (!pendingAction && !detailSale) return undefined;
    const closeOnEscape = event => {
      if (event.key !== 'Escape' || processing || detailLoading) return;
      setPendingAction(null);
      setDetailSale(null);
      setCancelReason('');
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [pendingAction, detailSale, processing, detailLoading]);

  const canCancel = sale => canSeeTeam || sale.seller_id === user.id;
  const hasFilters = Boolean(search || filterPayment || filterSeller || filterStatus);
  const clearFilters = () => {
    setSearch('');
    setFilterPayment('');
    setFilterSeller('');
    setFilterStatus('');
    setPage(1);
  };

  const openDetails = async sale => {
    setDetailLoading(true);
    setDetailSale({ ...sale, _loading: true });
    try {
      const fullSale = await nexoApi.entities.Sale.get(sale.id);
      setDetailSale(fullSale);
    } catch (error) {
      setDetailSale(null);
      toast.error(error.message || 'Não foi possível abrir os detalhes da venda.');
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadReceipt = async sale => {
    setReceiptLoadingId(sale.id);
    try {
      const fullSale = sale.items ? sale : await nexoApi.entities.Sale.get(sale.id);
      await downloadSaleReceiptPdf(fullSale, receiptConfig, {
        onLogoError: () => toast('A logo não respondeu, mas o recibo foi gerado normalmente.'),
      });
      toast.success(`Recibo da venda #${fullSale.sale_number} baixado.`);
    } catch (error) {
      toast.error(error.message || 'Não foi possível baixar o recibo.');
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const requestCancel = sale => {
    setCancelReason('');
    setPendingAction({ type: 'cancel', sale });
  };
  const requestDelete = sale => setPendingAction({ type: 'delete', sale });

  const confirmAction = async () => {
    if (!pendingAction || processing) return;
    const currentAction = pendingAction;
    setProcessing(true);
    try {
      if (currentAction.type === 'cancel') {
        await nexoApi.sales.cancel(currentAction.sale.id, cancelReason.trim());
        toast.success('Venda cancelada e estoque restaurado.');
      } else {
        await nexoApi.sales.delete(currentAction.sale.id);
        toast.success('Venda excluída definitivamente.');
      }
      setPendingAction(null);
      setCancelReason('');
      if (detailSale?.id === currentAction.sale.id) setDetailSale(null);
      await loadSales({ immediateSearch: search });
    } catch (error) {
      toast.error(error.message || `Erro ao ${currentAction.type === 'cancel' ? 'cancelar' : 'excluir'} venda.`);
    } finally {
      setProcessing(false);
    }
  };

  const downloadReport = async () => {
    const from = new Date(`${reportDate}T${reportStart || '00:00'}:00`);
    const to = new Date(`${reportDate}T${reportEnd || '23:59'}:00`);
    to.setMinutes(to.getMinutes() + 1);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      toast.error('Informe uma data e um intervalo de horário válido.');
      return;
    }
    setReporting(true);
    try {
      const result = await nexoApi.sales.report({
        from: from.toISOString(),
        to: to.toISOString(),
        sellerId: canSeeTeam ? reportSeller : '',
        payment: reportPayment,
      });
      const sellerName = canSeeTeam
        ? sellers.find(item => item.id === reportSeller)?.name || ''
        : user.full_name || user.email;
      const paymentLabel = PAYMENT_METHODS.find(item => item.method === reportPayment)?.label || '';
      await downloadDailySalesReportPdf({
        sales: result.sales || [],
        summary: result.summary || {},
        filters: result.filters || { from: from.toISOString(), to: to.toISOString() },
        config: receiptConfig,
        sellerName,
        paymentLabel,
      });
      toast.success('Relatório diário baixado em PDF.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível gerar o relatório diário.');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent"><History className="h-3.5 w-3.5" /> Histórico e acompanhamento</div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Histórico de vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">{canSeeTeam ? 'Vendas de toda a equipe' : 'Somente suas vendas'} · {total} registro{total === 1 ? '' : 's'}</p>
        </div>
      </div>

      <DailyReportCard
        canSeeTeam={canSeeTeam}
        sellers={sellers}
        date={reportDate}
        start={reportStart}
        end={reportEnd}
        seller={reportSeller}
        payment={reportPayment}
        reporting={reporting}
        onDate={setReportDate}
        onStart={setReportStart}
        onEnd={setReportEnd}
        onSeller={setReportSeller}
        onPayment={setReportPayment}
        onDownload={downloadReport}
      />

      <section className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm" aria-label="Filtros de vendas">
        <div className={`grid gap-2 sm:grid-cols-2 ${canSeeTeam ? 'lg:grid-cols-[minmax(260px,1fr)_190px_180px_170px_auto]' : 'lg:grid-cols-[minmax(260px,1fr)_190px_170px_auto]'}`}>
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Buscar vendas</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Número, vendedor ou pagamento" className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </label>
          {canSeeTeam && (
            <select aria-label="Filtrar por vendedor" value={filterSeller} onChange={event => { setFilterSeller(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="">Todos os vendedores</option>
              {sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
            </select>
          )}
          <select aria-label="Filtrar por pagamento" value={filterPayment} onChange={event => { setFilterPayment(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
            <option value="">Todos os pagamentos</option>
            {PAYMENT_METHODS.map(payment => <option key={payment.method} value={payment.method}>{payment.label}</option>)}
          </select>
          <select aria-label="Filtrar por status" value={filterStatus} onChange={event => { setFilterStatus(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
            <option value="">Todos os status</option>
            <option value="concluida">Concluídas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          {hasFilters && <button type="button" onClick={clearFilters} className="min-h-11 rounded-xl border border-border px-3 text-sm font-bold transition hover:bg-muted">Limpar</button>}
        </div>
      </section>

      {loading ? (
        <LoadingState />
      ) : sales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center"><History className="mx-auto h-11 w-11 text-muted-foreground/25" /><h2 className="mt-3 font-bold">Nenhuma venda encontrada</h2><p className="mt-1 text-sm text-muted-foreground">Altere os filtros para procurar outros registros.</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">Limpar filtros</button>}</div>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {sales.map(sale => <SaleCard key={sale.id} sale={sale} canSeeTeam={canSeeTeam} canCancel={canCancel(sale)} canDelete={sale.status === 'cancelada' && user.role === 'admin'} receiptLoading={receiptLoadingId === sale.id} onDetails={() => openDetails(sale)} onReceipt={() => downloadReceipt(sale)} onCancel={() => requestCancel(sale)} onDelete={() => requestDelete(sale)} />)}
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-secondary text-xs font-bold text-secondary-foreground"><tr><th className="px-4 py-3 text-left">Venda</th><th className="px-4 py-3 text-left">Data e hora</th>{canSeeTeam && <th className="px-4 py-3 text-left">Vendedor</th>}<th className="px-4 py-3 text-left">Pagamento</th><th className="px-4 py-3 text-left">Tipo</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Ações</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {sales.map(sale => (
                    <tr key={sale.id} className="transition hover:bg-muted/25">
                      <td className="px-4 py-3 font-black">#{sale.sale_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(sale.created_date)}</td>
                      {canSeeTeam && <td className="px-4 py-3 font-semibold">{sale.seller_name || '—'}</td>}
                      <td className="max-w-[240px] px-4 py-3 text-muted-foreground">{paymentNames(sale)}</td>
                      <td className="px-4 py-3"><SaleType sale={sale} /></td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{formatCurrency(sale.total)}</td>
                      <td className="px-4 py-3 text-center"><SaleStatus sale={sale} /></td>
                      <td className="px-4 py-3"><SaleActions sale={sale} receiptLoading={receiptLoadingId === sale.id} canCancel={canCancel(sale)} canDelete={sale.status === 'cancelada' && user.role === 'admin'} onDetails={() => openDetails(sale)} onReceipt={() => downloadReceipt(sale)} onCancel={() => requestCancel(sale)} onDelete={() => requestDelete(sale)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <PaginationControls page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}

      {detailSale && <SaleDetailModal sale={detailSale} loading={detailLoading} receiptLoading={receiptLoadingId === detailSale.id} onReceipt={() => downloadReceipt(detailSale)} onClose={() => setDetailSale(null)} />}
      {pendingAction && <ConfirmSaleAction action={pendingAction} reason={cancelReason} processing={processing} onReason={setCancelReason} onClose={() => !processing && setPendingAction(null)} onConfirm={confirmAction} />}
    </div>
  );
}

function DailyReportCard(props) {
  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-accent/20 bg-card shadow-sm" aria-labelledby="daily-report-title">
      <div className="flex items-start gap-3 border-b border-border bg-accent/5 p-4 sm:p-5">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-accent text-accent-foreground"><FileText className="h-5 w-5" /></span>
        <div><h2 id="daily-report-title" className="font-black">Relatório de vendas do dia</h2><p className="mt-1 text-sm text-muted-foreground">Baixe um PDF com resumo, pagamentos e todas as vendas do período selecionado.</p></div>
      </div>
      <div className={`grid gap-3 p-4 sm:grid-cols-2 lg:p-5 ${props.canSeeTeam ? 'lg:grid-cols-[180px_140px_140px_1fr_190px_auto]' : 'lg:grid-cols-[180px_140px_140px_1fr_auto]'}`}>
        <label className="text-xs font-bold text-muted-foreground"><span className="mb-1.5 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Data</span><input type="date" value={props.date} onChange={event => props.onDate(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
        <label className="text-xs font-bold text-muted-foreground"><span className="mb-1.5 flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Início</span><input type="time" value={props.start} onChange={event => props.onStart(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
        <label className="text-xs font-bold text-muted-foreground"><span className="mb-1.5 flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Fim</span><input type="time" value={props.end} onChange={event => props.onEnd(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
        {props.canSeeTeam && <label className="text-xs font-bold text-muted-foreground">Vendedor<select value={props.seller} onChange={event => props.onSeller(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"><option value="">Todos os vendedores</option>{props.sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>}
        <label className="text-xs font-bold text-muted-foreground">Pagamento<select value={props.payment} onChange={event => props.onPayment(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"><option value="">Todos os pagamentos</option>{PAYMENT_METHODS.map(payment => <option key={payment.method} value={payment.method}>{payment.label}</option>)}</select></label>
        <button type="button" disabled={props.reporting} onClick={props.onDownload} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-60">{props.reporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {props.reporting ? 'Gerando...' : 'Baixar relatório'}</button>
      </div>
      {!props.canSeeTeam && <p className="px-4 pb-4 text-xs font-medium text-muted-foreground lg:px-5">O relatório de vendedor inclui exclusivamente as vendas vinculadas à sua conta.</p>}
    </section>
  );
}

function SaleCard({ sale, canSeeTeam, canCancel, canDelete, receiptLoading, onDetails, onReceipt, onCancel, onDelete }) {
  return <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">Venda #{sale.sale_number}</h2><p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(sale.created_date)}</p></div><SaleStatus sale={sale} /></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/35 p-3 text-sm"><div><span className="block text-xs text-muted-foreground">Total</span><strong className="mt-0.5 block text-base">{formatCurrency(sale.total)}</strong></div><div><span className="block text-xs text-muted-foreground">Tipo</span><strong className="mt-0.5 block">{sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'}</strong></div>{canSeeTeam && <div className="col-span-2"><span className="block text-xs text-muted-foreground">Vendedor</span><strong className="mt-0.5 block">{sale.seller_name || '—'}</strong></div>}<div className="col-span-2"><span className="block text-xs text-muted-foreground">Pagamento</span><strong className="mt-0.5 block">{paymentNames(sale)}</strong></div></div><SaleActions sale={sale} receiptLoading={receiptLoading} canCancel={canCancel} canDelete={canDelete} onDetails={onDetails} onReceipt={onReceipt} onCancel={onCancel} onDelete={onDelete} mobile /></article>;
}

function SaleActions({ sale, receiptLoading, canCancel, canDelete, onDetails, onReceipt, onCancel, onDelete, mobile = false }) {
  return <div className={`flex items-center ${mobile ? 'mt-3 grid grid-cols-2 gap-2' : 'justify-center gap-1'}`}><button type="button" onClick={onDetails} className={mobile ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold hover:bg-muted' : 'grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground'} title="Ver detalhes"><Eye className="h-4 w-4" />{mobile && 'Detalhes'}</button><button type="button" disabled={receiptLoading} onClick={onReceipt} className={mobile ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-accent/25 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-50' : 'grid h-9 w-9 place-items-center rounded-lg text-accent hover:bg-accent/10 disabled:opacity-50'} title="Baixar recibo">{receiptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}{mobile && 'Recibo PDF'}</button>{sale.status === 'concluida' && canCancel && <button type="button" onClick={onCancel} className={mobile ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-300 text-sm font-bold text-amber-700 hover:bg-amber-50 dark:text-amber-300' : 'grid h-9 w-9 place-items-center rounded-lg text-amber-600 hover:bg-amber-50 dark:text-amber-300'} title="Cancelar"><Ban className="h-4 w-4" />{mobile && 'Cancelar'}</button>}{sale.status === 'cancelada' && canDelete && <button type="button" onClick={onDelete} className={mobile ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-destructive/25 text-sm font-bold text-destructive hover:bg-destructive/10' : 'grid h-9 w-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10'} title="Excluir definitivamente"><Trash2 className="h-4 w-4" />{mobile && 'Excluir'}</button>}</div>;
}

function SaleStatus({ sale }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${sale.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}>{sale.status === 'concluida' ? 'Concluída' : 'Cancelada'}</span>;
}
function SaleType({ sale }) { return <span className={`rounded-full px-2 py-1 text-xs font-bold ${sale.sale_type === 'fiado' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'bg-muted text-muted-foreground'}`}>{sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'}</span>; }
function paymentNames(sale) { return (sale.payments || []).map(payment => getPaymentLabel(payment.method)).join(', ') || '—'; }
function LoadingState() { return <div className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" /><p className="text-sm">Carregando vendas...</p></div>; }

function SaleDetailModal({ sale, loading, receiptLoading, onReceipt, onClose }) {
  if (loading || sale._loading) return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="presentation"><div className="rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl"><Loader2 className="mx-auto h-7 w-7 animate-spin text-accent" /><p className="mt-3 text-sm font-semibold">Carregando detalhes...</p></div></div>;
  const totals = calculateSaleTotals(sale);
  const discountLabel = sale.discount_type === 'percentual' ? `${formatDiscount(sale)} (${formatCurrency(totals.discount)})` : formatCurrency(totals.discount);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose} role="presentation"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card text-card-foreground shadow-2xl" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sale-detail-title"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4"><div><h2 id="sale-detail-title" className="text-lg font-black">Venda #{sale.sale_number}</h2><p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(sale.created_date)}</p></div><div className="flex items-center gap-1"><button type="button" disabled={receiptLoading} onClick={onReceipt} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/25 px-3 text-xs font-bold text-accent hover:bg-accent/10 disabled:opacity-50">{receiptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Recibo</button><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar detalhes"><X className="h-5 w-5" /></button></div></div><div className="space-y-4 p-5 text-sm"><div className="grid gap-3 rounded-xl bg-muted/30 p-3 sm:grid-cols-2"><Info label="Vendedor" value={sale.seller_name || 'Não informado'} /><Info label="Tipo" value={sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'} /><Info label="Status" value={sale.status === 'concluida' ? 'Concluída' : 'Cancelada'} /><Info label="Pagamento" value={paymentNames(sale)} /></div>{sale.observation && <Info label="Observação" value={sale.observation} />}{sale.cancellation_reason && <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3"><span className="block text-xs font-bold uppercase tracking-wide text-destructive">Motivo do cancelamento</span><p className="mt-1 text-sm">{sale.cancellation_reason}</p></div>}<section><h3 className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">Produtos</h3><div className="divide-y divide-border overflow-hidden rounded-xl border border-border">{(sale.items || []).map((item, index) => { const amount = item.unit === 'peso' ? `${Number(item.weight || 0).toLocaleString('pt-BR')} kg` : `${item.quantity || 0} un.`; return <div key={`${item.product_id || item.product_name}-${index}`} className="flex items-center justify-between gap-4 px-3 py-3"><div className="min-w-0"><p className="truncate font-semibold">{item.product_name}</p><p className="mt-0.5 text-xs text-muted-foreground">{amount}</p></div><span className="flex-none font-bold tabular-nums">{formatCurrency(item.subtotal)}</span></div>; })}</div></section><div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totals.subtotal)}</span></div><div className="flex justify-between text-muted-foreground"><span>Desconto</span><span className="tabular-nums">{discountLabel}</span></div><div className="flex justify-between border-t border-border pt-3 text-lg font-black"><span>Total</span><span className="text-accent tabular-nums">{formatCurrency(sale.total ?? totals.total)}</span></div></div></div></div></div>;
}

function ConfirmSaleAction({ action, reason, processing, onReason, onClose, onConfirm }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && onClose()} role="presentation"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="sale-action-title"><div className="flex items-start justify-between gap-4"><div><h2 id="sale-action-title" className="text-xl font-black">{action.type === 'cancel' ? 'Cancelar venda' : 'Excluir venda'}</h2><p className="mt-1 text-sm text-muted-foreground">Venda #{action.sale.sale_number} · {formatCurrency(action.sale.total)}</p></div><button type="button" disabled={processing} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label="Fechar"><X className="h-5 w-5" /></button></div>{action.type === 'cancel' ? <><div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">Os produtos serão devolvidos ao estoque. Se a venda for fiado, o registro pendente também será cancelado.</div><label className="mt-4 block text-sm font-semibold">Motivo do cancelamento <span className="font-normal text-muted-foreground">(opcional)</span><textarea autoFocus rows={3} value={reason} onChange={event => onReason(event.target.value)} maxLength={300} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Ex.: cliente desistiu da compra" /></label></> : <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Esta ação é definitiva. O histórico desta venda será removido, mas a auditoria da exclusão será mantida.</div>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={processing} onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50">Voltar</button><button type="button" disabled={processing} onClick={onConfirm} className={`min-h-11 rounded-xl px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${action.type === 'cancel' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-destructive hover:bg-destructive/90'}`}>{processing ? 'Processando...' : action.type === 'cancel' ? 'Confirmar cancelamento' : 'Excluir definitivamente'}</button></div></div></div>;
}

function Info({ label, value }) { return <div><span className="block text-xs font-semibold text-muted-foreground">{label}</span><span className="mt-0.5 block font-semibold">{value}</span></div>; }
