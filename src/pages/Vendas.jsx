import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { hasMarketFeature } from '@/lib/market-modules';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import PaginationControls from '@/components/common/PaginationControls';
import {
  ChevronDown,
  Download,
  History,
  Loader2,
  Search,
  SlidersHorizontal,
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
import { PageHeader } from '@/components/common/AppShell';

const PAGE_SIZE = 20;
const todayKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};
const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const isoDate = (date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const monthStartKey = () => {
  const now = new Date();
  return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
};
const weekStartKey = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  return isoDate(addDays(now, 1 - day));
};

export default function Vendas() {
  const { user, config } = /** @type {any} */ (useOutletContext());
  const canExportReports =
    user.role !== 'vendedor' && hasMarketFeature(user, 'report_export');
  const canSeeTeam = ['gerente', 'admin'].includes(user.role);
  const [sales, setSales] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [salesSummary, setSalesSummary] = useState(null);
  const [detailSale, setDetailSale] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState(null);
  const [printingSaleId, setPrintingSaleId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportFrom, setReportFrom] = useState(todayKey);
  const [reportTo, setReportTo] = useState(todayKey);
  const [reportStart, setReportStart] = useState('00:00');
  const [reportEnd, setReportEnd] = useState('23:59');
  const [reportSeller, setReportSeller] = useState('');
  const [reportPayment, setReportPayment] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
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
    const from = new Date(`${reportFrom}T${reportStart || '00:00'}:00`);
    const to = new Date(`${reportTo}T${reportEnd || '23:59'}:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
      return { from: '', to: '' };
    to.setMinutes(to.getMinutes() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [reportFrom, reportTo, reportStart, reportEnd]);

  const loadSales = async ({ immediateSearch = search } = {}) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError('');
    try {
      const data = await nexoApi.sales.list({
        page,
        pageSize: PAGE_SIZE,
        search: immediateSearch.trim(),
        sellerId: canSeeTeam ? reportSeller : '',
        payment: reportPayment,
        status: filterStatus,
        from: reportRange.from,
        to: reportRange.to,
        includeSellers: sellers.length === 0,
      });
      if (sequence !== requestSequence.current) return;
      setSales(data.items || []);
      setTotal(Number(data.total || 0));
      setSalesSummary(data.summary || null);
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
    search || reportPayment || reportSeller || filterStatus,
  );
  const activeFilterCount = [
    search,
    reportPayment,
    reportSeller,
    filterStatus,
  ].filter(Boolean).length;
  const clearFilters = () => {
    setSearch('');
    setReportPayment('');
    setReportSeller('');
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
        toast.success('Venda arquivada. Histórico financeiro preservado.');
      }
      setPendingAction(null);
      setCancelReason('');
      if (detailSale?.id === currentAction.sale.id) setDetailSale(null);
      await loadSales({ immediateSearch: search });
    } catch (error) {
      toast.error(
        error.message ||
          `Erro ao ${currentAction.type === 'cancel' ? 'cancelar' : 'arquivar'} venda.`,
      );
    } finally {
      setProcessing(false);
    }
  };

  const downloadReport = async () => {
    const from = new Date(`${reportFrom}T${reportStart || '00:00'}:00`);
    const to = new Date(`${reportTo}T${reportEnd || '23:59'}:00`);
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

  const applyQuickRange = (range) => {
    const now = new Date();
    if (range === 'ontem') {
      const yesterday = isoDate(addDays(now, -1));
      setReportFrom(yesterday);
      setReportTo(yesterday);
    } else if (range === 'semana') {
      setReportFrom(weekStartKey());
      setReportTo(todayKey());
    } else if (range === 'mes') {
      setReportFrom(monthStartKey());
      setReportTo(todayKey());
    } else {
      const today = todayKey();
      setReportFrom(today);
      setReportTo(today);
    }
    setReportStart('00:00');
    setReportEnd('23:59');
    setPage(1);
  };

  const metrics = salesSummary || {
    total: 0,
    sales_count: 0,
    average_ticket: 0,
    cancelled_count: 0,
  };

  return (
    <div className="page-shell">
      <PageHeader
        icon={History}
        eyebrow="Histórico"
        title="Vendas"
        description={`${total} registro${total === 1 ? '' : 's'} no período`}
      />
      <div className="hidden">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <History className="h-3.5 w-3.5" /> Histórico
          </div>
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">
            Vendas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} registro{total === 1 ? '' : 's'} no período
          </p>
        </div>
      </div>

      <section className="filter-surface mb-3 grid gap-2.5" aria-label="Filtros de vendas">
        <div className={`grid gap-1.5 ${user.role === 'vendedor' ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {user.role !== 'vendedor' && (
            <SaleMetric label="Faturamento" value={formatCurrency(metrics.total)} />
          )}
          <SaleMetric label="Quantidade de vendas" value={metrics.sales_count || 0} />
          {user.role !== 'vendedor' && (
            <>
              <SaleMetric label="Ticket" value={formatCurrency(metrics.average_ticket)} />
              <SaleMetric label="Canceladas" value={metrics.cancelled_count || 0} muted />
            </>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[
            ['hoje', 'Hoje'],
            ['ontem', 'Ontem'],
            ['semana', 'Semana'],
            ['mes', 'Mês'],
          ].map(([range, label]) => (
            <button
              key={range}
              type="button"
              onClick={() => applyQuickRange(range)}
              className="min-h-8 rounded-lg border border-border px-1.5 text-xs font-bold transition hover:border-accent hover:bg-accent/5"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 sm:grid-cols-[minmax(220px,1fr)_auto]">
          <label className="relative">
            <span className="sr-only">Buscar vendas</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar venda"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <button
            type="button"
            onClick={() => setAdvancedFiltersOpen((open) => !open)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-bold transition hover:bg-muted lg:hidden"
            aria-expanded={advancedFiltersOpen}
            aria-controls="sales-advanced-filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden min-[380px]:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] text-accent-foreground">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition ${advancedFiltersOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div
          id="sales-advanced-filters"
          className={`${advancedFiltersOpen ? 'grid' : 'hidden lg:grid'} gap-1.5 md:grid-cols-2 xl:grid-cols-[136px_136px_104px_104px_minmax(150px,1fr)_minmax(150px,1fr)_minmax(132px,0.8fr)_auto_auto]`}
        >
          <input
            aria-label="Data inicial"
            type="date"
            value={reportFrom}
            onChange={(event) => {
              const selectedDate = event.target.value;
              setReportFrom(selectedDate);
              setReportTo(selectedDate);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm font-semibold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <input
            aria-label="Data final"
            type="date"
            value={reportTo}
            min={reportFrom || undefined}
            onChange={(event) => {
              setReportTo(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm font-semibold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <input
            aria-label="Horário inicial"
            type="time"
            value={reportStart}
            onChange={(event) => {
              setReportStart(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm font-semibold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <input
            aria-label="Horário final"
            type="time"
            value={reportEnd}
            onChange={(event) => {
              setReportEnd(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm font-semibold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {canSeeTeam && (
            <select
              aria-label="Filtrar por vendedor"
              value={reportSeller}
              onChange={(event) => {
                setReportSeller(event.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Todos os vendedores</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>{seller.name}</option>
              ))}
            </select>
          )}
          <select
            aria-label="Filtrar por pagamento"
            value={reportPayment}
            onChange={(event) => {
              setReportPayment(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Todos os pagamentos</option>
            {PAYMENT_METHODS.map((payment) => (
              <option key={payment.method} value={payment.method}>{payment.label}</option>
            ))}
          </select>
          <select
            aria-label="Filtrar por status"
            value={filterStatus}
            onChange={(event) => {
              setFilterStatus(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Todos os status</option>
            <option value="concluida">Concluídas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="hidden h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-bold transition hover:bg-muted xl:inline-flex"
            >
              Limpar
            </button>
          )}
          {canExportReports && (
            <button
              type="button"
              disabled={reporting}
              onClick={downloadReport}
              className="hidden h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-60 xl:inline-flex"
            >
              {reporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {reporting ? 'Gerando...' : 'Relatório'}
            </button>
          )}
        </div>

        <div className="-mt-1 flex flex-wrap items-center justify-end gap-1.5 xl:hidden">
          <div className="flex flex-wrap gap-1.5">
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-9 rounded-lg border border-border px-3 text-sm font-bold transition hover:bg-muted"
              >
                Limpar
              </button>
            )}
          </div>
          {canExportReports && (
            <button
              type="button"
              disabled={reporting}
              onClick={downloadReport}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-60"
            >
              {reporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {reporting ? 'Gerando...' : 'Relatório'}
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
        <div className="mobile-app-surface border-dashed py-8 text-center sm:py-12">
          <History className="mx-auto h-9 w-9 text-muted-foreground/25 sm:h-11 sm:w-11" />
          <h2 className="mt-3 font-bold">Nenhuma venda encontrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tente outro período ou limpe os filtros.
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
          <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_18px_45px_rgba(15,23,42,0.055)] lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-secondary text-[11px] font-bold uppercase tracking-normal text-secondary-foreground">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Venda</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Data e hora</th>
                    {canSeeTeam && (
                      <th className="whitespace-nowrap px-3 py-2.5 text-left">Vendedor</th>
                    )}
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Pagamento</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Tipo</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right">Total</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-center">Status</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="transition hover:bg-muted/25">
                      <td className="whitespace-nowrap px-3 py-2.5 font-black">
                        #{sale.sale_number}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                        {formatDateTime(sale.created_date)}
                      </td>
                      {canSeeTeam && (
                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold">
                          {sale.seller_name || '-'}
                        </td>
                      )}
                      <td className="max-w-[220px] whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                        {paymentNames(sale)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <SaleType sale={sale} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        <SaleStatus sale={sale} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
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
function SaleMetric({ label, value, muted = false }) {
  return (
    <div className="metric-tile min-w-0 px-2.5 py-1.5 sm:px-3 sm:py-2">
      <p className="truncate text-[10px] font-black uppercase leading-3 text-muted-foreground sm:text-[11px]">
        {label}
      </p>
      <strong className={`mt-0.5 block truncate text-sm font-black tabular-nums sm:text-base ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value}
      </strong>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mobile-app-surface py-8 text-center text-muted-foreground sm:py-12"
    >
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
      <p className="text-sm">Carregando vendas...</p>
    </div>
  );
}
