import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { hasMarketFeature } from '@/lib/market-modules';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import PaginationControls from '@/components/common/PaginationControls';
import {
  CalendarDays,
  Clock3,
  Download,
  FileText,
  History,
  Loader2,
  Search,
} from 'lucide-react';
import {
  formatCurrency,
  formatDateTime,
  PAYMENT_METHODS,
} from '@/lib/helpers';
import { ErrorState } from '@/components/common/PageState';
import {
  ConfirmSaleAction,
  SaleActions,
  SaleCard,
  SaleDetailModal,
  SaleStatus,
  SaleType,
  paymentNames,
} from '@/components/sales/SaleHistory';

const PAGE_SIZE = 20;
const todayKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export default function Vendas() {
  const { user, config } = /** @type {any} */ (useOutletContext());
  const canExportReports = hasMarketFeature(user, 'report_export');
  const canSeeTeam = ['gerente', 'admin'].includes(user.role);
  const [sales, setSales] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSeller, setFilterSeller] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detailSale, setDetailSale] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState(null);
  const [printingSaleId, setPrintingSaleId] = useState(null);
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

  const receiptConfig = useMemo(
    () => ({
      ...config,
      logo_url: config.logo_url || user.logo_url,
      nome_mercado: config.nome_mercado || user.market_name,
      market_name: user.market_name,
    }),
    [config, user.logo_url, user.market_name],
  );

  const reportRange = useMemo(() => {
    const from = new Date(`${reportDate}T${reportStart || '00:00'}:00`);
    const to = new Date(`${reportDate}T${reportEnd || '23:59'}:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
      return { from: '', to: '' };
    to.setMinutes(to.getMinutes() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [reportDate, reportStart, reportEnd]);

  const loadSales = async ({ immediateSearch = search } = {}) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError('');
    try {
      const effectiveSeller = canSeeTeam
        ? reportSeller || filterSeller
        : '';
      const effectivePayment = reportPayment || filterPayment;
      const data = await nexoApi.sales.list({
        page,
        pageSize: PAGE_SIZE,
        search: immediateSearch.trim(),
        sellerId: effectiveSeller,
        payment: effectivePayment,
        status: filterStatus,
        from: reportRange.from,
        to: reportRange.to,
        includeSellers: sellers.length === 0,
      });
      if (sequence !== requestSequence.current) return;
      setSales(data.items || []);
      setTotal(Number(data.total || 0));
      setPageCount(Math.max(1, Number(data.page_count || 1)));
      if (Array.isArray(data.sellers) && data.sellers.length)
        setSellers(data.sellers);
      if (page > Number(data.page_count || 1))
        setPage(Math.max(1, Number(data.page_count || 1)));
    } catch (error) {
      if (sequence === requestSequence.current) {
        setLoadError(error.message || 'Não foi possível carregar as vendas.');
        toast.error(error.message || 'Erro ao carregar vendas.');
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => loadSales(), search ? 280 : 0);
    return () => window.clearTimeout(timeout);
  }, [
    page,
    search,
    filterPayment,
    filterSeller,
    filterStatus,
    reportRange.from,
    reportRange.to,
    reportSeller,
    reportPayment,
  ]);

  useEffect(() => {
    if (!pendingAction && !detailSale) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || processing || detailLoading) return;
      setPendingAction(null);
      setDetailSale(null);
      setCancelReason('');
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [pendingAction, detailSale, processing, detailLoading]);

  const canCancel = (sale) => canSeeTeam || sale.seller_id === user.id;
  const hasFilters = Boolean(
    search || filterPayment || filterSeller || filterStatus,
  );
  const clearFilters = () => {
    setSearch('');
    setFilterPayment('');
    setFilterSeller('');
    setFilterStatus('');
    setPage(1);
  };

  const openDetails = async (sale) => {
    setDetailLoading(true);
    setDetailSale({ ...sale, _loading: true });
    try {
      const fullSale = await nexoApi.entities.Sale.get(sale.id);
      setDetailSale(fullSale);
    } catch (error) {
      setDetailSale(null);
      toast.error(
        error.message || 'Não foi possível abrir os detalhes da venda.',
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadReceipt = async (sale) => {
    setReceiptLoadingId(sale.id);
    try {
      const fullSale = sale.items
        ? sale
        : await nexoApi.entities.Sale.get(sale.id);
      const { downloadSaleReceiptPdf } = await import('@/lib/sales-pdf');
      await downloadSaleReceiptPdf(fullSale, receiptConfig, {
        onLogoError: () =>
          toast('A logo não respondeu, mas o recibo foi gerado normalmente.'),
      });
      toast.success(`Recibo da venda #${fullSale.sale_number} baixado.`);
    } catch (error) {
      toast.error(error.message || 'Não foi possível baixar o recibo.');
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const printReceipt = async (sale) => {
    setPrintingSaleId(sale.id);
    try {
      const fullSale = sale.items
        ? sale
        : await nexoApi.entities.Sale.get(sale.id);
      const { printSaleReceipt } = await import('@/lib/sales-pdf');
      await printSaleReceipt(fullSale, receiptConfig);
      toast.success(`Impressão da venda #${fullSale.sale_number} enviada.`);
    } catch (error) {
      toast.error(error.message || 'Não foi possível imprimir a venda.');
    } finally {
      setPrintingSaleId(null);
    }
  };

  const requestCancel = (sale) => {
    setCancelReason('');
    setPendingAction({ type: 'cancel', sale });
  };
  const requestDelete = (sale) => setPendingAction({ type: 'delete', sale });

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
      toast.error(
        error.message ||
          `Erro ao ${currentAction.type === 'cancel' ? 'cancelar' : 'excluir'} venda.`,
      );
    } finally {
      setProcessing(false);
    }
  };

  const downloadReport = async () => {
    const from = new Date(`${reportDate}T${reportStart || '00:00'}:00`);
    const to = new Date(`${reportDate}T${reportEnd || '23:59'}:00`);
    to.setMinutes(to.getMinutes() + 1);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to <= from
    ) {
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
        ? sellers.find((item) => item.id === reportSeller)?.name || ''
        : user.full_name || user.email;
      const paymentLabel =
        PAYMENT_METHODS.find((item) => item.method === reportPayment)?.label ||
        '';
      const { downloadDailySalesReportPdf } = await import('@/lib/sales-pdf');
      await downloadDailySalesReportPdf({
        sales: result.sales || [],
        summary: result.summary || {},
        filters: result.filters || {
          from: from.toISOString(),
          to: to.toISOString(),
        },
        config: receiptConfig,
        sellerName,
        paymentLabel,
      });
      toast.success('Relatório diário baixado em PDF.');
    } catch (error) {
      toast.error(
        error.message || 'Não foi possível gerar o relatório diário.',
      );
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <History className="h-3.5 w-3.5" /> Histórico e acompanhamento
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Histórico de vendas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canSeeTeam ? 'Vendas de toda a equipe' : 'Somente suas vendas'} ·{' '}
            {total} registro{total === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {canExportReports && (
        <DailyReportCard
          canSeeTeam={canSeeTeam}
          sellers={sellers}
          date={reportDate}
          start={reportStart}
          end={reportEnd}
          seller={reportSeller}
          payment={reportPayment}
          reporting={reporting}
          onDate={(value) => {
            setReportDate(value);
            setPage(1);
          }}
          onStart={(value) => {
            setReportStart(value);
            setPage(1);
          }}
          onEnd={(value) => {
            setReportEnd(value);
            setPage(1);
          }}
          onSeller={(value) => {
            setReportSeller(value);
            setPage(1);
          }}
          onPayment={(value) => {
            setReportPayment(value);
            setPage(1);
          }}
          onDownload={downloadReport}
        />
      )}

      <section
        className="mb-3 rounded-xl border border-border bg-card p-2.5 shadow-sm sm:mb-4 sm:rounded-2xl sm:p-3"
        aria-label="Filtros de vendas"
      >
        <div
          className={`grid gap-2 sm:grid-cols-2 ${canSeeTeam ? 'lg:grid-cols-[minmax(260px,1fr)_190px_180px_170px_auto]' : 'lg:grid-cols-[minmax(260px,1fr)_190px_170px_auto]'}`}
        >
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Buscar vendas</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Número, vendedor ou pagamento"
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          {canSeeTeam && (
            <select
              aria-label="Filtrar por vendedor"
              value={filterSeller}
              onChange={(event) => {
                setFilterSeller(event.target.value);
                setPage(1);
              }}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Todos os vendedores</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filtrar por pagamento"
            value={filterPayment}
            onChange={(event) => {
              setFilterPayment(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Todos os pagamentos</option>
            {PAYMENT_METHODS.map((payment) => (
              <option key={payment.method} value={payment.method}>
                {payment.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por status"
            value={filterStatus}
            onChange={(event) => {
              setFilterStatus(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Todos os status</option>
            <option value="concluida">Concluídas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 rounded-xl border border-border px-3 text-sm font-bold transition hover:bg-muted"
            >
              Limpar
            </button>
          )}
        </div>
      </section>

      {loading && sales.length > 0 && (
        <div
          role="status"
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando vendas...
        </div>
      )}
      {loadError && sales.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {loadError}
        </div>
      )}
      {loading && !sales.length ? (
        <LoadingState />
      ) : loadError && !sales.length ? (
        <ErrorState description={loadError} onRetry={() => loadSales()} />
      ) : sales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <History className="mx-auto h-11 w-11 text-muted-foreground/25" />
          <h2 className="mt-3 font-bold">Nenhuma venda encontrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Altere os filtros para procurar outros registros.
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {sales.map((sale) => (
              <SaleCard
                key={sale.id}
                sale={sale}
                canSeeTeam={canSeeTeam}
                canCancel={canCancel(sale)}
                canDelete={sale.status === 'cancelada' && user.role === 'admin'}
                receiptLoading={receiptLoadingId === sale.id}
                printing={printingSaleId === sale.id}
                onDetails={() => openDetails(sale)}
                onReceipt={() => downloadReceipt(sale)}
                onPrint={() => printReceipt(sale)}
                onCancel={() => requestCancel(sale)}
                onDelete={() => requestDelete(sale)}
              />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-secondary text-xs font-bold text-secondary-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Venda</th>
                    <th className="px-4 py-3 text-left">Data e hora</th>
                    {canSeeTeam && (
                      <th className="px-4 py-3 text-left">Vendedor</th>
                    )}
                    <th className="px-4 py-3 text-left">Pagamento</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="transition hover:bg-muted/25">
                      <td className="px-4 py-3 font-black">
                        #{sale.sale_number}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(sale.created_date)}
                      </td>
                      {canSeeTeam && (
                        <td className="px-4 py-3 font-semibold">
                          {sale.seller_name || '-'}
                        </td>
                      )}
                      <td className="max-w-[240px] px-4 py-3 text-muted-foreground">
                        {paymentNames(sale)}
                      </td>
                      <td className="px-4 py-3">
                        <SaleType sale={sale} />
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <SaleStatus sale={sale} />
                      </td>
                      <td className="px-4 py-3">
                        <SaleActions
                          sale={sale}
                          receiptLoading={receiptLoadingId === sale.id}
                          printing={printingSaleId === sale.id}
                          canCancel={canCancel(sale)}
                          canDelete={
                            sale.status === 'cancelada' && user.role === 'admin'
                          }
                          onDetails={() => openDetails(sale)}
                          onReceipt={() => downloadReceipt(sale)}
                          onPrint={() => printReceipt(sale)}
                          onCancel={() => requestCancel(sale)}
                          onDelete={() => requestDelete(sale)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <PaginationControls
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {detailSale && (
        <SaleDetailModal
          sale={detailSale}
          loading={detailLoading}
          receiptLoading={receiptLoadingId === detailSale.id}
          printing={printingSaleId === detailSale.id}
          onReceipt={() => downloadReceipt(detailSale)}
          onPrint={() => printReceipt(detailSale)}
          onClose={() => setDetailSale(null)}
        />
      )}
      {pendingAction && (
        <ConfirmSaleAction
          action={pendingAction}
          reason={cancelReason}
          processing={processing}
          onReason={setCancelReason}
          onClose={() => !processing && setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}
    </div>
  );
}

function DailyReportCard(props) {
  return (
    <section
      className="mb-4 overflow-hidden rounded-2xl border border-accent/20 bg-card shadow-sm"
      aria-labelledby="daily-report-title"
    >
      <div className="flex items-start gap-3 border-b border-border bg-accent/5 p-4 sm:p-5">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-accent text-accent-foreground">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h2 id="daily-report-title" className="font-black">
            Relatório de vendas do dia
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Baixe um PDF com resumo, pagamentos e todas as vendas do período
            selecionado.
          </p>
        </div>
      </div>
      <div
        className={`grid gap-3 p-4 sm:grid-cols-2 lg:p-5 ${props.canSeeTeam ? 'lg:grid-cols-[180px_140px_140px_1fr_190px_auto]' : 'lg:grid-cols-[180px_140px_140px_1fr_auto]'}`}
      >
        <label className="text-xs font-bold text-muted-foreground">
          <span className="mb-1.5 flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Data
          </span>
          <input
            type="date"
            value={props.date}
            onChange={(event) => props.onDate(event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="text-xs font-bold text-muted-foreground">
          <span className="mb-1.5 flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" /> Início
          </span>
          <input
            type="time"
            value={props.start}
            onChange={(event) => props.onStart(event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="text-xs font-bold text-muted-foreground">
          <span className="mb-1.5 flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" /> Fim
          </span>
          <input
            type="time"
            value={props.end}
            onChange={(event) => props.onEnd(event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        {props.canSeeTeam && (
          <label className="text-xs font-bold text-muted-foreground">
            Vendedor
            <select
              value={props.seller}
              onChange={(event) => props.onSeller(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Todos os vendedores</option>
              {props.sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-bold text-muted-foreground">
          Pagamento
          <select
            value={props.payment}
            onChange={(event) => props.onPayment(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Todos os pagamentos</option>
            {PAYMENT_METHODS.map((payment) => (
              <option key={payment.method} value={payment.method}>
                {payment.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={props.reporting}
          onClick={props.onDownload}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-60"
        >
          {props.reporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}{' '}
          {props.reporting ? 'Gerando...' : 'Baixar relatório'}
        </button>
      </div>
      {!props.canSeeTeam && (
        <p className="px-4 pb-4 text-xs font-medium text-muted-foreground lg:px-5">
          O relatório de vendedor inclui exclusivamente as vendas vinculadas à
          sua conta.
        </p>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground"
    >
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
      <p className="text-sm">Carregando vendas...</p>
    </div>
  );
}
