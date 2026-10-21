import React, { useId, useRef, useState } from 'react';
import { Archive, Ban, Clock3, Download, Eye, Loader2, MoreHorizontal, Printer, ReceiptText, Users, X } from 'lucide-react';
import { PaymentBadge, StatusBadge } from '@/components/common/visualTokens';
import {
  calculateSaleTotals,
  formatCurrency,
  formatDateTime,
  formatDiscount,
  getPaymentLabel,
} from '@/lib/helpers';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

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
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsId = useId();
  const actionsToggleRef = useRef(null);

  return (
    <article className="history-record-card sale-history-card">
      <div className="history-record-heading">
        <div className="min-w-0">
          <h2 className="history-record-title">
            Venda #{sale.sale_number}
          </h2>
        </div>
        <SaleStatus sale={sale} />
      </div>
      <div className="sale-history-meta">
        <span><Clock3 aria-hidden="true" /> {formatDateTime(sale.created_date)}</span>
        {canSeeTeam && <span title={sale.seller_name || 'Vendedor não informado'}><Users aria-hidden="true" /> {sale.seller_name || 'Vendedor não informado'}</span>}
      </div>
      <dl className="sale-history-values">
        <div className="min-w-0"><dt>Pagamento</dt><dd className="flex flex-wrap gap-1"><SalePayments sale={sale} compact /></dd></div>
        <div className="text-right"><dt>Total</dt><dd className="sale-history-total">{formatCurrency(sale.total)}</dd></div>
      </dl>
      <div className="history-record-footer">
        <SaleType sale={sale} />
        <div className="sale-history-buttons">
        <button
          type="button"
          onClick={onDetails}
          aria-label={`Ver detalhes da venda ${sale.sale_number}`}
          className="history-record-details"
        >
          <Eye aria-hidden="true" className="h-3.5 w-3.5" /> Detalhes
        </button>
        <button
          ref={actionsToggleRef}
          type="button"
          className="history-record-more"
          aria-label={`Mais ações da venda ${sale.sale_number}`}
          aria-expanded={actionsOpen}
          aria-controls={actionsId}
          title="Mais ações"
          onClick={() => setActionsOpen((open) => !open)}
        ><MoreHorizontal aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      </div>
      <div
        id={actionsId}
        hidden={!actionsOpen}
        className="history-record-expanded"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setActionsOpen(false);
            actionsToggleRef.current?.focus();
          }
        }}
      >
          <SaleActions
            sale={sale}
            receiptLoading={receiptLoading}
            printing={printing}
            canCancel={canCancel}
            canDelete={canDelete}
            onDetails={onDetails}
            onReceipt={onReceipt}
            onPrint={onPrint}
            onCancel={onCancel}
            onDelete={onDelete}
            mobile
            showDetails={false}
          />
      </div>
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
  showDetails = true,
}) {
  return (
    <div
      className={`flex items-center ${mobile ? 'mt-3 grid grid-cols-2 gap-2' : 'justify-center gap-1'}`}
    >
      {showDetails && <button
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
      </button>}
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
          title="Arquivar venda"
        >
          <Archive className="h-4 w-4" />
          {mobile && 'Arquivar'}
        </button>
      )}
    </div>
  );
}

function LegacySaleStatus({ sale }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${sale.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}
    >
      {sale.status === 'concluida' ? 'Concluída' : 'Cancelada'}
    </span>
  );
}

export function SaleStatus({ sale }) {
  return <StatusBadge status={sale.status} />;
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

export function SalePayments({ sale, compact = false }) {
  const payments = sale.payments || [];
  if (!payments.length)
    return <span className="text-xs text-muted-foreground">Sem pagamento</span>;
  return (
    <>
      {payments.slice(0, 3).map((payment, index) => (
        <PaymentBadge
          key={`${payment.method}-${index}`}
          method={payment.method}
          compact={compact}
        />
      ))}
      {payments.length > 3 && (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
          +{payments.length - 3}
        </span>
      )}
    </>
  );
}

export function SaleDetailModal({
  sale,
  loading,
  receiptLoading = false,
  printing = false,
  onReceipt = null,
  onPrint = null,
  onClose,
}) {
  const modalRef = useModalBehavior({ onClose, disabled: receiptLoading || printing });

  if (loading || sale._loading)
    return (
      <div
        className="modal-overlay"
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
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="modal-panel sm:max-w-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-detail-title"
      >
        <div className="modal-header sticky top-0 z-10">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 sm:h-10 sm:w-10"><ReceiptText className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 id="sale-detail-title" className="truncate text-base font-black sm:text-lg">
              Venda #{sale.sale_number}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
              {formatDateTime(sale.created_date)}
            </p>
          </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onReceipt && (
              <button
                type="button"
                disabled={receiptLoading}
                onClick={onReceipt}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-accent/25 px-2.5 text-xs font-bold text-accent hover:bg-accent/10 disabled:opacity-50 sm:min-h-10 sm:gap-2 sm:px-3"
              >
                {receiptLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}{' '}
                <span className="hidden min-[430px]:inline">Recibo</span>
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                disabled={printing}
                onClick={onPrint}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-50 sm:min-h-10 sm:gap-2 sm:px-3"
              >
                {printing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}{' '}
                <span className="hidden min-[430px]:inline">Imprimir</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground sm:h-10 sm:w-10"
              aria-label="Fechar detalhes"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="modal-body space-y-3 text-sm">
            <div className="grid gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-2">
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
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
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

function visualInfoValue(label, value) {
  if (React.isValidElement(value)) return value;
  const raw = String(value || '');
  if (label === 'Status') {
    const text = raw.toLowerCase();
    const status = text.includes('cancel') ? 'cancelada' : 'concluida';
    return <StatusBadge status={status} />;
  }
  if (label === 'Pagamento') {
    const text = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const method = text.includes('pix')
      ? 'pix'
      : text.includes('debito')
        ? 'debito'
        : text.includes('credito')
          ? 'credito'
          : text.includes('fiado')
            ? 'fiado'
            : text.includes('dinheiro')
              ? 'dinheiro'
              : 'outros';
    return <PaymentBadge method={method} />;
  }
  return value;
}

function Info({ label, value }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 block font-semibold">
        {visualInfoValue(label, value)}
      </span>
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
  const modalRef = useModalBehavior({ onClose, disabled: processing });

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="presentation"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="modal-panel sm:max-w-md"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sale-action-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="sale-action-title" className="modal-title">
              {action.type === 'cancel' ? 'Cancelar venda' : 'Arquivar venda'}
            </h2>
            <p className="modal-subtitle">
              Venda #{action.sale.sale_number} ·{' '}
              {formatCurrency(action.sale.total)}
            </p>
          </div>
          <button
            type="button"
            disabled={processing}
            onClick={onClose}
            className="modal-icon-button disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="modal-body">
        {action.type === 'cancel' ? (
          <>
            <div className="rounded-lg border border-amber-300/60 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              Os produtos serão devolvidos ao estoque. Se a venda for fiado, o
              registro pendente também será cancelado.
            </div>
            <label className="mt-3 block text-sm font-semibold">
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
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            A venda sairá da lista principal, mas seus vínculos financeiros e a
            auditoria serão preservados para conferência.
          </div>
        )}
        </div>
        <div className="modal-footer">
          <div className="modal-actions">
          <button
            type="button"
            disabled={processing}
            onClick={onClose}
            className="modal-button border border-border hover:bg-muted disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={onConfirm}
            className={`modal-button modal-actions-primary text-white disabled:cursor-not-allowed disabled:opacity-50 ${action.type === 'cancel' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-destructive hover:bg-destructive/90'}`}
          >
            {processing
              ? 'Processando...'
              : action.type === 'cancel'
                ? 'Confirmar'
                : 'Arquivar venda'}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
