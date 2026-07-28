import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Plus, Printer, ReceiptText, Store, User, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency, formatDateTime, getPaymentLabel } from '@/lib/helpers';
import { downloadSaleReceiptPdf } from '@/lib/sales-pdf';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

const printStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { background: #fff !important; color: #111 !important; opacity: 1 !important; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; padding: 10px; width: 320px; color: #111 !important; }
  .receipt { display: flex; flex-direction: column; gap: 10px; }
  .r-header { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
  .r-badge { display: inline-flex; align-items: center; justify-content: center; padding: 3px 8px; border-radius: 999px; border: 1px solid #d9e3dd; background: #f5faf7; color: #2e6d4a; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .r-logo { display: flex; align-items: center; justify-content: center; min-height: 54px; }
  .r-logo img { max-height: 54px; max-width: 180px; object-fit: contain; display: block; }
  .r-store { font-weight: 800; font-size: 15px; line-height: 1.1; }
  .r-subtitle { font-size: 9px; line-height: 1.4; color: #5f6b66; }
  .r-card { border: 1px solid #e5ebe7; border-radius: 12px; padding: 10px 11px; background: #fff; }
  .r-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; }
  .r-meta { display: flex; flex-direction: column; gap: 2px; }
  .r-label { font-size: 9px; color: #6b746f; text-transform: uppercase; letter-spacing: .06em; }
  .r-value { font-size: 11px; font-weight: 700; line-height: 1.35; }
  .r-section-title { display: flex; align-items: center; gap: 6px; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #50715d; margin-bottom: 8px; }
  .r-icon { display: inline-flex; width: 16px; height: 16px; border-radius: 999px; align-items: center; justify-content: center; background: #eef6f1; color: #2e6d4a; font-size: 10px; font-weight: 900; }
  .r-item { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: start; padding: 8px 0; border-bottom: 1px solid #edf1ee; }
  .r-item:last-child { border-bottom: 0; padding-bottom: 0; }
  .r-qty { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; padding: 4px 7px; border-radius: 999px; background: #eff6f1; color: #2e6d4a; font-size: 9px; font-weight: 800; }
  .r-name { font-size: 11px; font-weight: 700; line-height: 1.3; }
  .r-prices { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; white-space: nowrap; }
  .r-prices span:first-child { font-size: 9px; color: #6b746f; }
  .r-prices span:last-child { font-size: 11px; font-weight: 800; }
  .r-summary { display: flex; flex-direction: column; gap: 6px; }
  .r-row { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 1.35; }
  .r-row span:first-child { color: #5f6b66; }
  .r-total { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding-top: 6px; border-top: 1px solid #e5ebe7; font-size: 14px; font-weight: 900; }
  .r-total span:last-child { font-size: 16px; }
  .r-payment { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 7px 0; border-bottom: 1px solid #eef2ef; }
  .r-payment:last-child { border-bottom: 0; padding-bottom: 0; }
  .r-payment strong { font-size: 11px; }
  .r-footer { text-align: center; margin-top: 2px; font-size: 10px; line-height: 1.45; color: #5f6b66; }
  .r-footer, .r-footer * { color: #5f6b66 !important; }
  .r-store, .r-value, .r-name, .r-prices span:last-child, .r-total span:last-child, .r-payment strong { color: #111 !important; }
  .r-label, .r-subtitle, .r-prices span:first-child { color: #5f6b66 !important; }
`;

export default function ReceiptModal({ sale, config = /** @type {Record<string, any>} */ ({}), onClose, onNewSale, primaryLabel = 'Nova venda' }) {
  const receiptRef = useRef(null);
  const modalRef = useModalBehavior({ onClose, closeOnEscape: false });
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const totals = useMemo(() => {
    const subtotal = Number(sale.subtotal ?? (sale.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
    const discount = sale.discount_type === 'percentual'
      ? subtotal * Math.min(100, Math.max(0, Number(sale.discount_value || 0))) / 100
      : Math.max(0, Number(sale.discount_value || 0));
    const total = Number(sale.total ?? Math.max(0, subtotal - discount));
    return { subtotal, discount, total };
  }, [sale]);

  const receiptItems = useMemo(() => (sale.items || []).map((item, index) => ({
    key: `${item.product_id || item.product_name || 'item'}-${index}`,
    quantityLabel: item.unit === 'peso'
      ? `${Number(item.weight || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
      : `${Number(item.quantity || 0)} un`,
    name: item.product_name || 'Produto',
    unitPrice: Number(item.unit_price || 0),
    subtotal: Number(item.subtotal || 0),
  })), [sale.items]);

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const win = window.open('', '', 'width=380,height=650');
    if (!win) return toast.error('O navegador bloqueou a janela de impressão.');
    const closePrintWindow = () => {
      try {
        if (!win.closed) win.close();
      } catch {
        // popup may already be gone
      }
    };
    win.addEventListener('afterprint', closePrintWindow, { once: true });
    win.document.write(`<html><head><title>Recibo #${sale.sale_number}</title><style>${printStyles}</style></head><body>${receiptRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    window.setTimeout(() => {
      try {
        win.print();
      } finally {
        window.setTimeout(closePrintWindow, 1200);
      }
    }, 120);
  };

  const handlePDF = async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      await downloadSaleReceiptPdf(sale, config, {
        onLogoError: () => toast.error('A logo do mercado não pôde ser adicionada ao PDF.'),
      });
    } catch (error) {
      toast.error(error.message || 'Não foi possível gerar o recibo em PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'F8' || event.key === 'Enter') {
        event.preventDefault();
        handlePrint();
      } else if (event.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sale, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[90dvh]">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 no-print">
          <div>
            <h2 id="receipt-modal-title" className="text-lg font-bold">Recibo da venda</h2>
            <p className="text-xs text-muted-foreground">Visualização organizada para impressão e PDF</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fechar recibo">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f7f9f8] p-4 text-black sm:p-6" ref={receiptRef}>
          <div className="receipt mx-auto w-full max-w-[420px]">
            <div className="r-header">
              <div className="r-badge">Mercado</div>
              <div className="r-logo">
                {config.logo_url ? (
                  <img src={config.logo_url} alt={`Logo de ${config.nome_mercado || 'mercado'}`} decoding="async" />
                ) : (
                  <Store className="h-10 w-10 text-[#2e6d4a]" />
                )}
              </div>
              <div>
                <div className="r-store">{config.nome_mercado || config.market_name || 'Nexo PDV'}</div>
                {config.cnpj && <div className="r-subtitle">CNPJ: {config.cnpj}</div>}
                {config.endereco && <div className="r-subtitle">{config.endereco}</div>}
              </div>
            </div>

            <div className="r-card">
              <div className="r-grid">
                <Meta label="Data" value={formatDateTime(sale.created_date || new Date())} />
                <Meta label="Venda" value={`#${sale.sale_number}`} />
                <Meta label="Atendente" value={sale.seller_name || 'Não informado'} icon={User} />
                <Meta label="Tipo" value={sale.sale_type === 'fiado' ? 'Fiado' : 'Normal'} icon={ReceiptText} />
              </div>
            </div>

            <div className="r-card">
              <div className="r-section-title"><span className="r-icon">1</span>Produtos</div>
              <div className="space-y-1">
                {receiptItems.map((item) => (
                  <div key={item.key} className="r-item">
                    <span className="r-qty">{item.quantityLabel}</span>
                    <div className="min-w-0">
                      <div className="r-name truncate">{item.name}</div>
                    </div>
                    <div className="r-prices">
                      <span>Unitário {formatCurrency(item.unitPrice)}</span>
                      <span>{formatCurrency(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
                {receiptItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item nesta venda.</p>}
              </div>
            </div>

            <div className="r-card">
              <div className="r-section-title"><span className="r-icon">2</span>Resumo</div>
              <div className="r-summary">
                <div className="r-row"><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></div>
                {totals.discount > 0 && <div className="r-row"><span>Desconto</span><strong>{formatCurrency(totals.discount)}</strong></div>}
                <div className="r-total"><span>TOTAL</span><span>{formatCurrency(totals.total)}</span></div>
              </div>
            </div>

            <div className="r-card">
              <div className="r-section-title"><span className="r-icon">3</span>Pagamentos</div>
              <div className="space-y-1">
                {(sale.payments || []).map((payment, index) => (
                  <div key={`${payment.method}-${index}`} className="r-payment">
                    <strong>{getPaymentLabel(payment.method)}</strong>
                    <span>{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
                {Number(sale.change_amount || 0) > 0 && (
                  <div className="r-payment">
                    <strong>Troco</strong>
                    <span>{formatCurrency(sale.change_amount)}</span>
                  </div>
                )}
                {sale.observation && <p className="pt-1 text-xs text-muted-foreground">Obs: {sale.observation}</p>}
              </div>
            </div>

            <div className="r-footer">
              <p>Obrigado pela preferência!</p>
              <p>Volte sempre!</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-6 py-4 no-print">
          <button type="button" onClick={handlePrint} title="Imprimir (F8)" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-secondary">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button type="button" onClick={handlePDF} disabled={generatingPdf} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50">
            <FileText className="h-4 w-4" /> {generatingPdf ? 'Gerando...' : 'PDF'}
          </button>
          <button type="button" onClick={onNewSale || onClose} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4" /> {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, icon: Icon }) {
  return (
    <div className="r-meta">
      <span className="r-label">{label}</span>
      <div className="flex items-start gap-1.5">
        {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 text-[#2e6d4a]" />}
        <span className="r-value">{value}</span>
      </div>
    </div>
  );
}
