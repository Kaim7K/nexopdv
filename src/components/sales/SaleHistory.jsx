import React from 'react';
import { Ban, Download, Eye, Loader2, Printer, ReceiptText, Trash2, X } from 'lucide-react';
import {
  calculateSaleTotals,
  formatCurrency,
  formatDateTime,
  formatDiscount,
  getPaymentLabel,
} from '@/lib/helpers';

export function SaleCard({
  sale,
  canSeeTeam,
  canCancel,
  canDelete,
  receiptLoading,
  printing,
  onDetails,
  onReceipt,
  onPrint,
  onCancel,
  onDelete,
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-2.5 shadow-sm sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black sm:text-base">
            Venda #{sale.sale_number}
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {formatDateTime(sale.created_date)}
            {canSeeTeam && sale.seller_name ? ` · ${sale.seller_name}` : ''}
          </p>
        </div>
        <SaleStatus sale={sale} />
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2 rounded-lg bg-muted/30 px-2.5 py-2 sm:mt-3 sm:rounded-xl sm:px-3 sm:py-2">
        <div className="min-w-0">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Pagamento
          </span>
          <strong className="mt-0.5 block truncate text-xs sm:text-sm">
            {paymentNames(sale)}
          </strong>
        </div>
        <div className="text-right">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <strong className="block text-base font-black tabular-nums sm:text-base">
            {formatCurrency(sale.total)}
          </strong>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold text-muted-foreground sm:mt-2 sm:gap-2 sm:text-[11px]">
        <span className="rounded-full border border-border bg-background px-2 py-0.5 sm:px-2.5 sm:py-1">
          {sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'}
        </span>
        {canSeeTeam && (
          <span className="rounded-full border border-border bg-background px-2 py-0.5 sm:px-2.5 sm:py-1">
            {sale.seller_name || '—'}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onDetails}
        className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-border text-xs font-bold hover:bg-muted sm:mt-3 sm:min-h-10 sm:rounded-xl sm:text-sm"
      >
        <Eye className="h-4 w-4" /> Ver detalhes
      </button>
    </article>
  );
}
export function SaleActions({
  sale,
  receiptLoading,
  canCancel,
  canDelete,
  onDetails,
  onReceipt,
  onPrint,
  onCancel,
  onDelete,
  printing = false,
  mobile = false,
}) {
  return (
    <div
      className={`flex items-center ${mobile ? 'mt-3 grid grid-cols-2 gap-2' : 'justify-center gap-1'}`}
    >
      <button
        type="button"
        onClick={onDetails}
        className={
          mobile
            ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold hover:bg-muted'
            : 'grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground'
        }
        title="Ver detalhes"
      >
        <Eye className="h-4 w-4" />
        {mobile && 'Detalhes'}
      </button>
      <button
        type="button"
        disabled={receiptLoading}
        onClick={onReceipt}
        className={
          mobile
            ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-accent/25 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-50'
            : 'grid h-9 w-9 place-items-center rounded-lg text-accent hover:bg-accent/10 disabled:opacity-50'
        }
        title="Baixar recibo"
      >
        {receiptLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ReceiptText className="h-4 w-4" />
        )}
        {mobile && 'Recibo PDF'}
      </button>
      <button
        type="button"
        disabled={printing}
        onClick={onPrint}
        className={
          mobile
            ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold hover:bg-muted disabled:opacity-50'
            : 'grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50'
        }
        title="Imprimir recibo"
      >
        {printing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        {mobile && 'Imprimir'}
      </button>
      {sale.status === 'concluida' && canCancel && (
        <button
          type="button"
          onClick={onCancel}
          className={
            mobile
              ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-300 text-sm font-bold text-amber-700 hover:bg-amber-50 dark:text-amber-300'
              : 'grid h-9 w-9 place-items-center rounded-lg text-amber-600 hover:bg-amber-50 dark:text-amber-300'
          }
          title="Cancelar"
        >
          <Ban className="h-4 w-4" />
          {mobile && 'Cancelar'}
        </button>
      )}
      {sale.status === 'cancelada' && canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className={
            mobile
              ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-destructive/25 text-sm font-bold text-destructive hover:bg-destructive/10'
              : 'grid h-9 w-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10'
          }
          title="Excluir definitivamente"
        >
          <Trash2 className="h-4 w-4" />
          {mobile && 'Excluir'}
        </button>
      )}
    </div>
  );
}

export function SaleStatus({ sale }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${sale.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}
    >
      {sale.status === 'concluida' ? 'Concluída' : 'Cancelada'}
    </span>
  );
}
export function SaleType({ sale }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-bold ${sale.sale_type === 'fiado' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'bg-muted text-muted-foreground'}`}
    >
      {sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'}
    </span>
  );
}
export function paymentNames(sale) {
  return (
    (sale.payments || [])
      .map((payment) => getPaymentLabel(payment.method))
      .join(', ') || '-'
  );
}

export function SaleDetailModal({
  sale,
  loading,
  receiptLoading,
  printing,
  onReceipt,
  onPrint,
  onClose,
}) {
  if (loading || sale._loading)
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
        role="presentation"
      >
        <div className="rounded-xl border border-border bg-card px-5 py-4 text-center shadow-2xl">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-accent" />
          <p className="mt-3 text-sm font-semibold">Carregando detalhes...</p>
        </div>
      </div>
    );
  const totals = calculateSaleTotals(sale);
  const discountLabel =
    sale.discount_type === 'percentual'
      ? `${formatDiscount(sale)} (${formatCurrency(totals.discount)})`
      : formatCurrency(totals.discount);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-detail-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div>
            <h2 id="sale-detail-title" className="text-lg font-black">
              Venda #{sale.sale_number}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(sale.created_date)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={receiptLoading}
              onClick={onReceipt}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/25 px-3 text-xs font-bold text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {receiptLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}{' '}
              Recibo
            </button>
            <button
              type="button"
              disabled={printing}
              onClick={onPrint}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              {printing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}{' '}
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar detalhes"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="space-y-4 p-5 text-sm">
          <div className="grid gap-3 rounded-xl bg-muted/30 p-3 sm:grid-cols-2">
            <Info
              label="Vendedor"
              value={sale.seller_name || 'Não informado'}
            />
            <Info
              label="Tipo"
              value={sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'}
            />
            <Info
              label="Status"
              value={sale.status === 'concluida' ? 'Concluída' : 'Cancelada'}
            />
            <Info label="Pagamento" value={paymentNames(sale)} />
          </div>
          {sale.observation && (
            <Info label="Observação" value={sale.observation} />
          )}
          {sale.cancellation_reason && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3">
              <span className="block text-xs font-bold uppercase tracking-wide text-destructive">
                Motivo do cancelamento
              </span>
              <p className="mt-1 text-sm">{sale.cancellation_reason}</p>
            </div>
          )}
          <section>
            <h3 className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
              Produtos
            </h3>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {(sale.items || []).map((item, index) => {
                const amount =
                  item.unit === 'peso'
                    ? `${Number(item.weight || 0).toLocaleString('pt-BR')} kg`
                    : `${item.quantity || 0} un.`;
                return (
                  <div
                    key={`${item.product_id || item.product_name}-${index}`}
                    className="flex items-center justify-between gap-4 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {item.product_name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {amount}
                      </p>
                    </div>
                    <span className="flex-none font-bold tabular-nums">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatCurrency(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Desconto</span>
              <span className="tabular-nums">{discountLabel}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-lg font-black">
              <span>Total</span>
              <span className="text-accent tabular-nums">
                {formatCurrency(sale.total ?? totals.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 block font-semibold">{value}</span>
    </div>
  );
}

export function ConfirmSaleAction({
  action,
  reason,
  processing,
  onReason,
  onClose,
  onConfirm,
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sale-action-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="sale-action-title" className="text-xl font-black">
              {action.type === 'cancel' ? 'Cancelar venda' : 'Excluir venda'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Venda #{action.sale.sale_number} ·{' '}
              {formatCurrency(action.sale.total)}
            </p>
          </div>
          <button
            type="button"
            disabled={processing}
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {action.type === 'cancel' ? (
          <>
            <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              Os produtos serão devolvidos ao estoque. Se a venda for fiado, o
              registro pendente também será cancelado.
            </div>
            <label className="mt-4 block text-sm font-semibold">
              Motivo do cancelamento{' '}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
              <textarea
                autoFocus
                rows={3}
                value={reason}
                onChange={(event) => onReason(event.target.value)}
                maxLength={300}
                className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="Ex.: cliente desistiu da compra"
              />
            </label>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Esta ação é definitiva. O histórico desta venda será removido, mas a
            auditoria da exclusão será mantida.
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={processing}
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={onConfirm}
            className={`min-h-11 rounded-xl px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${action.type === 'cancel' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-destructive hover:bg-destructive/90'}`}
          >
            {processing
              ? 'Processando...'
              : action.type === 'cancel'
                ? 'Confirmar cancelamento'
                : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}

