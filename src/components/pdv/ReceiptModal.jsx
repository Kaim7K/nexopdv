import React, { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Printer, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency, formatDateTime, getPaymentLabel } from '@/lib/helpers';
import { downloadSaleReceiptPdf } from '@/lib/sales-pdf';

export default function ReceiptModal({ sale, config = /** @type {Record<string, any>} */ ({}), onClose, onNewSale, primaryLabel = 'Nova venda' }) {
  const receiptRef = useRef(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const subtotal = Number(sale.subtotal ?? (sale.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
  const discount = sale.discount_type === 'percentual'
    ? subtotal * Math.min(100, Math.max(0, Number(sale.discount_value || 0))) / 100
    : Math.max(0, Number(sale.discount_value || 0));
  const total = Number(sale.total ?? Math.max(0, subtotal - discount));

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const win = window.open('', '', 'width=380,height=650');
    if (!win) return toast.error('O navegador bloqueou a janela de impressão.');
    win.document.write(`<html><head><title>Recibo #${sale.sale_number}</title><style>
      *{margin:0;padding:0;box-sizing:border-box} body{font-family:'Courier New',monospace;font-size:11px;padding:10px;width:280px;color:#000}
      .r-header{text-align:center;margin-bottom:6px}.r-header img{max-height:45px;margin:0 auto 4px;display:block}.r-store{font-weight:bold;font-size:12px}
      .r-info{font-size:9px;color:#444;margin-top:1px}.r-sep{border-top:1px dashed #000;margin:5px 0}.r-row{display:flex;justify-content:space-between;font-size:10px;margin:1px 0}
      .r-items{width:100%;margin:3px 0}.r-items td{padding:1px 0;font-size:10px;vertical-align:top}.r-items .qty{width:36px}.r-items .price{text-align:right;white-space:nowrap;padding-left:8px}
      .r-total{display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin:3px 0}.r-footer{text-align:center;margin-top:6px;font-size:9px;color:#555}
    </style></head><body>${receiptRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
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
    const handler = event => {
      if (event.key === 'F8' || event.key === 'Enter') { event.preventDefault(); handlePrint(); }
      else if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sale]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 no-print">
          <h2 className="text-lg font-bold">Recibo da venda</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fechar recibo"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white p-6 text-black" ref={receiptRef}>
          <div className="r-header text-center">
            {config.logo_url && <img src={config.logo_url} alt={`Logo de ${config.nome_mercado || 'mercado'}`} className="mx-auto mb-2 h-14 object-contain" />}
            <div className="r-store text-sm font-bold">{config.nome_mercado || config.market_name || 'Nexo PDV'}</div>
            {config.cnpj && <div className="r-info mt-0.5 text-[10px] text-gray-600">CNPJ: {config.cnpj}</div>}
            {config.endereco && <div className="r-info text-[10px] text-gray-600">{config.endereco}</div>}
          </div>
          <div className="r-sep my-1.5 border-t border-dashed border-gray-400" />
          <div className="r-info space-y-0.5 text-[10px]">
            <div className="r-row flex justify-between"><span>{formatDateTime(sale.created_date || new Date())}</span></div>
            <div className="r-row flex justify-between"><span>Venda #{sale.sale_number}</span></div>
            <div className="r-row flex justify-between"><span>Atendente: {sale.seller_name || 'Não informado'}</span></div>
          </div>
          <div className="r-sep my-1.5 border-t border-dashed border-gray-400" />
          <table className="r-items w-full text-[10px]"><tbody>
            {(sale.items || []).map((item, index) => {
              const amount = item.unit === 'peso' ? `${Number(item.weight || 0).toLocaleString('pt-BR')}kg` : `${item.quantity || 0}x`;
              return <tr key={`${item.product_id || item.product_name}-${index}`}><td className="r-qty py-0.5 align-top">{amount}</td><td className="py-0.5 align-top">{item.product_name}</td><td className="r-price whitespace-nowrap py-0.5 pl-2 text-right align-top">{formatCurrency(item.subtotal)}</td></tr>;
            })}
          </tbody></table>
          <div className="r-sep my-1.5 border-t border-dashed border-gray-400" />
          <div className="r-info space-y-0.5 text-[10px]">
            <div className="r-row flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {discount > 0 && <div className="r-row flex justify-between"><span>Desconto</span><span>{formatCurrency(discount)}</span></div>}
            <div className="r-total my-1 flex justify-between text-[13px] font-bold"><span>TOTAL</span><span>{formatCurrency(total)}</span></div>
            <div className="r-sep my-1 border-t border-dashed border-gray-400" />
            {(sale.payments || []).map((payment, index) => <div key={`${payment.method}-${index}`} className="r-row flex justify-between"><span>{getPaymentLabel(payment.method)}</span><span>{formatCurrency(payment.amount)}</span></div>)}
            {Number(sale.change_amount || 0) > 0 && <div className="r-row flex justify-between"><span>Troco</span><span>{formatCurrency(sale.change_amount)}</span></div>}
            {sale.observation && <div className="pt-1.5 text-[10px]">Obs: {sale.observation}</div>}
          </div>
          <div className="r-sep my-1.5 border-t border-dashed border-gray-400" />
          <div className="r-footer text-center text-[10px] text-gray-600"><p>Obrigado pela preferência!</p><p className="mt-0.5">Volte sempre!</p></div>
        </div>

        <div className="flex gap-2 border-t border-border px-6 py-4 no-print">
          <button type="button" onClick={handlePrint} title="Imprimir (F8)" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-secondary"><Printer className="h-4 w-4" /> Imprimir</button>
          <button type="button" onClick={handlePDF} disabled={generatingPdf} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"><FileText className="h-4 w-4" /> {generatingPdf ? 'Gerando...' : 'PDF'}</button>
          <button type="button" onClick={onNewSale || onClose} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4" /> {primaryLabel}</button>
        </div>
      </div>
    </div>
  );
}
