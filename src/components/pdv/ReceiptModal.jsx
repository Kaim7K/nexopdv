import React, { useRef, useEffect } from 'react';
import { X, Printer, FileText, Plus } from 'lucide-react';
import { formatCurrency, formatDateTime, LOGO_URL } from '@/lib/helpers';

export default function ReceiptModal({ sale, config, onClose, onNewSale }) {
  const receiptRef = useRef(null);
  const { subtotal, discount, total } = (() => {
    const sub = (sale.items || []).reduce((s, i) => s + (i.subtotal || 0), 0);
    const disc = sale.discount_value && sale.discount_type === 'percentual' ? sub * (sale.discount_value / 100) : (sale.discount_value || 0);
    return { subtotal: sub, discount: disc, total: Math.max(0, sub - disc) };
  })();

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F8' || e.key === 'Enter') { e.preventDefault(); handlePrint(); }
      else if (e.key === 'Escape') { onClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handlePrint = () => {
    const content = receiptRef.current.innerHTML;
    const win = window.open('', '', 'width=380,height=600');
    win.document.write(`<html><head><title>Recibo #${sale.sale_number}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;font-size:11px;padding:10px;width:280px;color:#000}
      .r-header{text-align:center;margin-bottom:6px}
      .r-header img{max-height:45px;margin:0 auto 4px;display:block}
      .r-store{font-weight:bold;font-size:12px}
      .r-info{font-size:9px;color:#444;margin-top:1px}
      .r-sep{border-top:1px dashed #000;margin:5px 0}
      .r-row{display:flex;justify-content:space-between;font-size:10px;margin:1px 0}
      .r-items{width:100%;margin:3px 0}
      .r-items td{padding:1px 0;font-size:10px;vertical-align:top}
      .r-items .qty{width:28px}
      .r-items .price{text-align:right;white-space:nowrap;padding-left:8px}
      .r-total{display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin:3px 0}
      .r-footer{text-align:center;margin-top:6px;font-size:9px;color:#555}
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  const handlePDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    let y = 8;
    const line = (text, bold = false, center = false, size = 9) => {
      doc.setFontSize(size); doc.setFont(undefined, bold ? 'bold' : 'normal');
      if (center) doc.text(text, 40, y, { align: 'center' }); else doc.text(text, 4, y);
      y += size === 9 ? 5 : 4;
    };
    line(config.nome_mercado || 'MercadoFlow PDV', true, true, 11);
    if (config.cnpj) line(`CNPJ: ${config.cnpj}`, false, true);
    if (config.endereco) line(config.endereco, false, true);
    line('- - - - - - - - - - - - - - -', false, true);
    line(formatDateTime(sale.created_date || new Date()), false, true);
    line(`Venda #${sale.sale_number}`, false, true);
    line(`Atendente: ${sale.seller_name}`, false, true);
    line('- - - - - - - - - - - - - - -', false, true);
    (sale.items || []).forEach(item => {
      line(`${item.quantity || item.weight || 1}x ${item.product_name}`);
      line(`   ${formatCurrency(item.unit_price)} un -> ${formatCurrency(item.subtotal)}`, false, false);
    });
    line('- - - - - - - - - - - - - - -', false, true);
    line(`Subtotal:    ${formatCurrency(subtotal)}`);
    if (discount > 0) line(`Desconto:    ${formatCurrency(discount)}`);
    line(`TOTAL:       ${formatCurrency(total)}`, true, false, 11);
    line('- - - - - - - - - - - - - - -', false, true);
    (sale.payments || []).forEach(p => line(`${p.method}:        ${formatCurrency(p.amount)}`));
    if (sale.change_amount > 0) line(`Troco:       ${formatCurrency(sale.change_amount)}`);
    if (sale.observation) line(`Obs: ${sale.observation}`);
    line('', false, true);
    line('Obrigado pela preferencia!', false, true);
    line('Volte sempre!', false, true);
    doc.save(`recibo-${sale.sale_number}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border no-print">
          <h2 className="text-lg font-bold">Recibo da Venda</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white text-black" ref={receiptRef}>
          <div className="r-header text-center">
            <img src={config.logo_url || LOGO_URL} alt="Logo" className="r-header-img h-14 mx-auto object-contain mb-2" />
            <div className="r-store font-bold text-sm">{config.nome_mercado || 'MercadoFlow PDV'}</div>
            {config.cnpj && <div className="r-info text-[10px] text-gray-600 mt-0.5">CNPJ: {config.cnpj}</div>}
            {config.endereco && <div className="r-info text-[10px] text-gray-600">{config.endereco}</div>}
          </div>
          <div className="r-sep border-t border-dashed border-gray-400 my-1.5" />
          <div className="r-info space-y-0.5 text-[10px]">
            <div className="r-row flex justify-between"><span>{formatDateTime(sale.created_date || new Date())}</span></div>
            <div className="r-row flex justify-between"><span>Venda #{sale.sale_number}</span></div>
            <div className="r-row flex justify-between"><span>Atendente: {sale.seller_name}</span></div>
          </div>
          <div className="r-sep border-t border-dashed border-gray-400 my-1.5" />
          <table className="r-items w-full text-[10px]">
            <tbody>
              {(sale.items || []).map((item, i) => (
                <tr key={i}>
                  <td className="r-qty py-0.5 align-top">{item.quantity || item.weight || 1}x</td>
                  <td className="py-0.5 align-top">{item.product_name}</td>
                  <td className="r-price py-0.5 align-top text-right pl-2 whitespace-nowrap">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="r-sep border-t border-dashed border-gray-400 my-1.5" />
          <div className="r-info space-y-0.5 text-[10px]">
            <div className="r-row flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {discount > 0 && <div className="r-row flex justify-between"><span>Desconto</span><span>{formatCurrency(discount)}</span></div>}
            <div className="r-total flex justify-between font-bold text-[13px] my-1"><span>TOTAL</span><span>{formatCurrency(total)}</span></div>
            <div className="r-sep border-t border-dashed border-gray-400 my-1" />
            {(sale.payments || []).map((p, i) => (
              <div key={i} className="r-row flex justify-between"><span className="capitalize">{p.method}</span><span>{formatCurrency(p.amount)}</span></div>
            ))}
            {sale.change_amount > 0 && <div className="r-row flex justify-between"><span>Troco</span><span>{formatCurrency(sale.change_amount)}</span></div>}
            {sale.observation && <div className="pt-1.5 text-[10px]"><span>Obs: {sale.observation}</span></div>}
          </div>
          <div className="r-sep border-t border-dashed border-gray-400 my-1.5" />
          <div className="r-footer text-center text-[10px] text-gray-600">
            <p>Obrigado pela preferência!</p>
            <p className="mt-0.5">Volte sempre!</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-6 py-4 border-t border-border no-print">
          <button onClick={handlePrint} title="Imprimir (F8)" className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button onClick={handlePDF} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={onNewSale} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 text-sm font-bold transition-colors">
            <Plus className="w-4 h-4" /> Nova Venda
          </button>
        </div>
      </div>
    </div>
  );
}