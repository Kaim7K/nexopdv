import { formatCurrency, formatDateTime, getPaymentLabel } from '@/lib/helpers';

const pdfCurrency = (value) => formatCurrency(value).replace(/[\u00a0\u202f]/g, ' ');
const safeFilePart = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Logo inválida'));
    image.src = source;
  });
}

async function loadLogoForPdf(source) {
  if (!source) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let objectUrl;
  try {
    let image;
    if (/^(data:image\/|blob:)/i.test(source)) {
      image = await loadImageElement(source);
    } else {
      const response = await fetch(source, { signal: controller.signal, credentials: 'include' });
      if (!response.ok) throw new Error('Logo indisponível');
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      image = await loadImageElement(objectUrl);
    }

    const maxPixels = 900;
    const scale = Math.min(1, maxPixels / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL('image/png'), width, height };
  } finally {
    clearTimeout(timeout);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function calculateSaleTotals(sale) {
  const subtotal = Number(sale.subtotal ?? (sale.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
  const rawDiscount = Math.max(0, Number(sale.discount_value || 0));
  const discount = sale.discount_type === 'percentual'
    ? subtotal * Math.min(100, Math.max(0, Number(sale.discount_value || 0))) / 100
    : Math.min(rawDiscount, subtotal);
  return { subtotal, discount, total: Number(sale.total ?? Math.max(0, subtotal - discount)) };
}

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

/** @param {any} sale @param {Record<string, any>} config @param {{onLogoError?: (error: unknown) => void}} options */
export async function downloadSaleReceiptPdf(sale, config = {}, { onLogoError } = {}) {
  const { jsPDF } = await import('jspdf');
  const totals = calculateSaleTotals(sale);
  const items = Array.isArray(sale.items) ? sale.items : [];
  const payments = Array.isArray(sale.payments) ? sale.payments : [];
  const estimatedHeight = Math.max(180, 106 + items.length * 11 + payments.length * 6);
  const doc = new jsPDF({ unit: 'mm', format: [80, estimatedHeight] });
  const marginX = 6;
  const width = 68;
  let y = 6;

  const setText = (size = 9, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
  };

  const divider = (space = 4.5) => {
    doc.setDrawColor(205);
    doc.line(marginX, y, 74, y);
    y += space;
  };

  const centerText = (value, size = 9, bold = false, gap = 4) => {
    const lines = doc.splitTextToSize(String(value ?? ''), width);
    setText(size, bold);
    doc.text(lines, 40, y, { align: 'center' });
    y += Math.max(gap, lines.length * (size >= 11 ? 3.6 : 3.2));
  };

  const rightValue = (label, value, bold = false) => {
    setText(7.8, false);
    doc.text(label, marginX, y);
    setText(bold ? 8.6 : 8, bold);
    doc.text(String(value ?? ''), 72, y, { align: 'right' });
    y += 4;
  };

  if (config.logo_url) {
    try {
      const logo = await loadLogoForPdf(config.logo_url);
      if (logo) {
        const ratio = Math.min(22 / logo.width, 12 / logo.height);
        const logoWidth = logo.width * ratio;
        const logoHeight = logo.height * ratio;
        doc.addImage(logo.dataUrl, 'PNG', 40 - logoWidth / 2, y, logoWidth, logoHeight, undefined, 'FAST');
        y += logoHeight + 2;
      }
    } catch (error) {
      onLogoError?.(error);
    }
  }

  doc.setFillColor(240, 248, 242);
  doc.setDrawColor(224, 234, 227);
  doc.roundedRect(marginX, y, width, 8, 2, 2, 'FD');
  setText(8.2, true);
  doc.setTextColor(46, 109, 74);
  doc.text('RECIBO', 40, y + 5.2, { align: 'center' });
  doc.setTextColor(17, 17, 17);
  y += 9;

  centerText(config.nome_mercado || config.market_name || 'Nexo PDV', 11, true, 4);
  if (config.cnpj) centerText(`CNPJ: ${config.cnpj}`, 7.8, false, 3);
  if (config.endereco) centerText(config.endereco, 7.8, false, 3.2);

  divider(4);
  rightValue('Data', formatDateTime(sale.created_date || new Date()));
  rightValue('Venda', `#${sale.sale_number}`, true);
  rightValue('Atendente', sale.seller_name || 'Não informado');
  rightValue('Tipo', sale.sale_type === 'fiado' ? 'Fiado' : 'Normal');
  divider(4);

  setText(8.7, true);
  doc.setTextColor(46, 109, 74);
  doc.text('PRODUTOS', marginX, y);
  doc.setTextColor(17, 17, 17);
  y += 4;

  if (!items.length) {
    setText(7.9, false);
    doc.text('Nenhum item nesta venda.', marginX, y);
    y += 4.2;
  } else {
    for (const item of items) {
      const amount = item.unit === 'peso'
        ? `${Number(item.weight || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
        : `${Number(item.quantity || 0)}x`;
      const nameLines = doc.splitTextToSize(String(item.product_name || 'Produto'), 34);
      const blockHeight = Math.max(10, nameLines.length * 3.4 + 2.4);
      doc.setDrawColor(232);
      doc.roundedRect(marginX, y, width, blockHeight, 2, 2, 'S');
      doc.setFillColor(239, 246, 241);
      doc.roundedRect(marginX + 1.2, y + 1.8, 9, 5.8, 2, 2, 'F');
      setText(7.6, true);
      doc.setTextColor(46, 109, 74);
      doc.text(amount, marginX + 5.7, y + 5.7, { align: 'center' });
      doc.setTextColor(17, 17, 17);
      setText(8, true);
      doc.text(nameLines, marginX + 11.8, y + 4.3);
      setText(7.2, false);
      doc.setTextColor(95, 107, 102);
      doc.text(`Unitário: ${pdfCurrency(item.unit_price)}`, 72, y + 3.9, { align: 'right' });
      setText(8.2, true);
      doc.setTextColor(17, 17, 17);
      doc.text(pdfCurrency(item.subtotal), 72, y + 7.3, { align: 'right' });
      doc.setTextColor(17, 17, 17);
      y += blockHeight + 1.5;
    }
  }

  divider(4);
  setText(8.7, true);
  doc.setTextColor(46, 109, 74);
  doc.text('RESUMO', marginX, y);
  doc.setTextColor(17, 17, 17);
  y += 4;
  rightValue('Subtotal', pdfCurrency(totals.subtotal));
  if (totals.discount > 0) rightValue('Desconto', pdfCurrency(totals.discount));
  doc.setFillColor(240, 248, 242);
  doc.setDrawColor(208, 228, 216);
  doc.roundedRect(marginX, y + 0.4, width, 8.5, 2, 2, 'FD');
  setText(8.8, true);
  doc.text('TOTAL', marginX + 2.4, y + 5.8);
  setText(10.8, true);
  doc.text(pdfCurrency(totals.total), 72 - 2.2, y + 5.8, { align: 'right' });
  y += 11.5;

  divider(4);
  setText(8.7, true);
  doc.setTextColor(46, 109, 74);
  doc.text('PAGAMENTOS', marginX, y);
  doc.setTextColor(17, 17, 17);
  y += 4;

  if (!payments.length) {
    setText(7.9, false);
    doc.text('Sem pagamento informado.', marginX, y);
    y += 4.2;
  } else {
    for (const payment of payments) {
      doc.setDrawColor(236);
      doc.line(marginX, y + 3.9, 74, y + 3.9);
      setText(8.1, true);
      doc.text(getPaymentLabel(payment.method), marginX, y + 2.9);
      setText(8.1, false);
      doc.text(pdfCurrency(payment.amount), 72, y + 2.9, { align: 'right' });
      y += 5.3;
    }
  }

  if (Number(sale.change_amount || 0) > 0) {
    rightValue('Troco', pdfCurrency(sale.change_amount));
  }
  if (sale.observation) {
    setText(7.7, false);
    doc.setTextColor(95, 107, 102);
    const observationLines = doc.splitTextToSize(`Observação: ${sale.observation}`, width);
    doc.text(observationLines, marginX, y);
    y += Math.max(4.2, observationLines.length * 3.2);
    doc.setTextColor(17, 17, 17);
  }

  divider(3.5);
  setText(8.1, true);
  doc.setTextColor(95, 107, 102);
  doc.text('Obrigado pela preferência!', 40, y, { align: 'center' });
  y += 3.6;
  doc.text('Volte sempre!', 40, y, { align: 'center' });

  const marketPart = safeFilePart(config.nome_mercado || config.market_name || 'nexo-pdv');
  doc.save(`recibo-${marketPart}-venda-${sale.sale_number}.pdf`);
}

const receiptPrintStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color: #000 !important;
    text-shadow: none !important;
    box-shadow: none !important;
    filter: none !important;
    opacity: 1 !important;
  }
  html, body { background: #fff !important; color: #000 !important; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; padding: 6px; width: 300px; color: #000 !important; }
  .receipt { display: flex; flex-direction: column; gap: 6px; }
  .r-header { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 5px; }
  .r-badge { display: inline-flex; align-items: center; justify-content: center; padding: 2px 6px; border-radius: 999px; border: 1px solid #000; background: #fff; color: #000; font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .r-logo { display: flex; align-items: center; justify-content: center; min-height: 42px; }
  .r-logo img { max-height: 42px; max-width: 160px; object-fit: contain; display: block; }
  .r-store { font-weight: 900; font-size: 13px; line-height: 1.08; }
  .r-subtitle { font-size: 8px; line-height: 1.25; color: #000 !important; }
  .r-card { border: 1px solid #000; border-radius: 10px; padding: 7px 8px; background: #fff; }
  .r-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px; }
  .r-meta { display: flex; flex-direction: column; gap: 1px; }
  .r-label { font-size: 9px; color: #000 !important; text-transform: uppercase; letter-spacing: .06em; font-weight: 800; }
  .r-value { font-size: 10px; font-weight: 800; line-height: 1.25; color: #000 !important; }
  .r-section-title { display: flex; align-items: center; gap: 5px; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #000; margin-bottom: 5px; }
  .r-icon { display: inline-flex; width: 14px; height: 14px; border-radius: 999px; align-items: center; justify-content: center; background: #fff; color: #000; font-size: 9px; font-weight: 900; border: 1px solid #000; }
  .r-item { display: grid; grid-template-columns: auto 1fr auto; gap: 6px; align-items: start; padding: 5px 0; border-bottom: 1px solid #000; }
  .r-item:last-child { border-bottom: 0; padding-bottom: 0; }
  .r-qty { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; padding: 3px 6px; border-radius: 999px; background: #fff; color: #000 !important; font-size: 8px; font-weight: 900; border: 1px solid #000; }
  .r-name { font-size: 10px; font-weight: 800; line-height: 1.22; color: #000 !important; }
  .r-prices { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; white-space: nowrap; }
  .r-prices span:first-child { font-size: 8px; color: #000 !important; }
  .r-prices span:last-child { font-size: 10px; font-weight: 900; color: #000 !important; }
  .r-summary { display: flex; flex-direction: column; gap: 4px; }
  .r-row { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; line-height: 1.25; }
  .r-row span:first-child { color: #000 !important; font-weight: 700; }
  .r-total { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding-top: 4px; border-top: 1px solid #000; font-size: 12px; font-weight: 900; }
  .r-total span:last-child { font-size: 14px; color: #000 !important; }
  .r-payment { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid #000; }
  .r-payment:last-child { border-bottom: 0; padding-bottom: 0; }
  .r-payment strong { font-size: 10px; font-weight: 800; color: #000 !important; }
  .r-footer { text-align: center; margin-top: 1px; font-size: 9px; line-height: 1.3; color: #000 !important; }
  .r-footer, .r-footer * { color: #000 !important; }
`;

function buildSaleReceiptHtml(sale, config = {}) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const payments = Array.isArray(sale.payments) ? sale.payments : [];
  const totals = calculateSaleTotals(sale);
  const itemHtml = items.length
    ? items.map((item) => {
      const quantityLabel = item.unit === 'peso'
        ? `${Number(item.weight || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
        : `${Number(item.quantity || 0).toLocaleString('pt-BR')} un`;
      return `
        <div class="r-item">
          <span class="r-qty">${escapeHtml(quantityLabel)}</span>
          <div class="min-w-0">
            <div class="r-name">${escapeHtml(item.product_name || 'Produto')}</div>
          </div>
          <div class="r-prices">
            <span>Unitário ${escapeHtml(pdfCurrency(item.unit_price))}</span>
            <span>${escapeHtml(pdfCurrency(item.subtotal))}</span>
          </div>
        </div>
      `;
    }).join('')
    : '<p class="text-sm text-muted-foreground">Nenhum item nesta venda.</p>';

  const paymentHtml = payments.length
    ? payments.map((payment) => `
        <div class="r-payment">
          <strong>${escapeHtml(getPaymentLabel(payment.method))}</strong>
          <span>${escapeHtml(pdfCurrency(payment.amount))}</span>
        </div>
      `).join('')
    : '<p class="text-sm text-muted-foreground">Sem pagamento informado.</p>';

  return `
    <div class="receipt mx-auto w-full max-w-[360px]">
      <div class="r-header">
        <div class="r-badge">Mercado</div>
        <div class="r-logo">
          ${config.logo_url ? `<img src="${escapeHtml(config.logo_url)}" alt="Logo de ${escapeHtml(config.nome_mercado || 'mercado')}" />` : ''}
        </div>
        <div>
          <div class="r-store">${escapeHtml(config.nome_mercado || config.market_name || 'Nexo PDV')}</div>
          ${config.cnpj ? `<div class="r-subtitle">CNPJ: ${escapeHtml(config.cnpj)}</div>` : ''}
          ${config.endereco ? `<div class="r-subtitle">${escapeHtml(config.endereco)}</div>` : ''}
        </div>
      </div>

      <div class="r-card">
        <div class="r-grid">
          <div class="r-meta"><span class="r-label">Data</span><span class="r-value">${escapeHtml(formatDateTime(sale.created_date || new Date()))}</span></div>
          <div class="r-meta"><span class="r-label">Venda</span><span class="r-value">#${escapeHtml(sale.sale_number)}</span></div>
          <div class="r-meta"><span class="r-label">Atendente</span><span class="r-value">${escapeHtml(sale.seller_name || 'Não informado')}</span></div>
          <div class="r-meta"><span class="r-label">Tipo</span><span class="r-value">${escapeHtml(sale.sale_type === 'fiado' ? 'Fiado' : 'Normal')}</span></div>
        </div>
      </div>

      <div class="r-card">
        <div class="r-section-title"><span class="r-icon">1</span>Produtos</div>
        <div class="space-y-0.5">${itemHtml}</div>
      </div>

      <div class="r-card">
        <div class="r-section-title"><span class="r-icon">2</span>Resumo</div>
        <div class="r-summary">
          <div class="r-row"><span>Subtotal</span><strong>${escapeHtml(pdfCurrency(totals.subtotal))}</strong></div>
          ${totals.discount > 0 ? `<div class="r-row"><span>Desconto</span><strong>${escapeHtml(pdfCurrency(totals.discount))}</strong></div>` : ''}
          <div class="r-total"><span>TOTAL</span><span>${escapeHtml(pdfCurrency(totals.total))}</span></div>
        </div>
      </div>

      <div class="r-card">
        <div class="r-section-title"><span class="r-icon">3</span>Pagamentos</div>
        <div class="space-y-0.5">${paymentHtml}</div>
        ${Number(sale.change_amount || 0) > 0 ? `<div class="r-payment"><strong>Troco</strong><span>${escapeHtml(pdfCurrency(sale.change_amount))}</span></div>` : ''}
        ${sale.observation ? `<p class="pt-1 text-xs text-muted-foreground">Obs: ${escapeHtml(sale.observation)}</p>` : ''}
      </div>

      <div class="r-footer">
        <p>Obrigado pela preferência!</p>
        <p>Volte sempre!</p>
      </div>
    </div>
  `;
}

/** @param {any} sale @param {Record<string, any>} config */
export async function printSaleReceipt(sale, config = {}) {
  const html = buildSaleReceiptHtml(sale, config);
  const win = window.open('', '', 'width=360,height=580');
  if (!win) throw new Error('O navegador bloqueou a janela de impressão.');
  const closePrintWindow = () => {
    try {
      if (!win.closed) win.close();
    } catch {
      // janela já pode ter sido fechada
    }
  };
  win.addEventListener('afterprint', closePrintWindow, { once: true });
  win.document.write(`<html><head><title>Recibo #${sale.sale_number}</title><style>${receiptPrintStyles}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    try {
      win.print();
    } finally {
      window.setTimeout(closePrintWindow, 900);
    }
  }, 120);
}

function safeDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

/** @param {{sales: any[], summary: any, filters: any, config?: Record<string, any>, sellerName?: string, paymentLabel?: string, title?: string}} options */
export async function downloadDailySalesReportPdf({ sales, summary, filters, config = {}, sellerName = '', paymentLabel = '', title = 'Relatório de vendas' }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const ensureSpace = (height) => {
    if (y + height <= pageHeight - 14) return;
    doc.addPage();
    y = 14;
  };

  if (config.logo_url) {
    try {
      const logo = await loadLogoForPdf(config.logo_url);
      if (logo) {
        const ratio = Math.min(32 / logo.width, 16 / logo.height);
        doc.addImage(logo.dataUrl, 'PNG', margin, y, logo.width * ratio, logo.height * ratio, undefined, 'FAST');
      }
    } catch {
      // O relatório continua sem a logo caso ela esteja indisponível.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(config.nome_mercado || config.market_name || 'Nexo PDV', pageWidth - margin, y + 5, { align: 'right' });
  doc.setFontSize(12);
  doc.text(title, pageWidth - margin, y + 12, { align: 'right' });
  y += 25;

  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const from = safeDate(filters?.from);
  const to = safeDate(filters?.to);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Período: ${formatDateTime(from)} até ${formatDateTime(to)}`, margin, y);
  y += 5;
  doc.text(`Vendedor: ${sellerName || 'Todos permitidos'}`, margin, y);
  y += 5;
  doc.text(`Pagamento: ${paymentLabel || 'Todos'}`, margin, y);
  y += 10;

  const metrics = [
    ['Faturamento', pdfCurrency(summary.total)],
    ['Vendas', String(summary.sales_count || 0)],
    ['Ticket médio', pdfCurrency(summary.average_ticket)],
    ['Canceladas', String(summary.cancelled_count || 0)],
  ];
  const boxWidth = 43;
  metrics.forEach(([label, value], index) => {
    const x = margin + index * (boxWidth + 3);
    doc.setFillColor(246, 249, 247);
    doc.roundedRect(x, y, boxWidth, 19, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(label, x + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(value, x + 3, y + 14);
  });
  y += 27;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Resumo por forma de pagamento', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const paymentEntries = Object.entries(summary.payments || {});
  if (!paymentEntries.length) {
    doc.text('Nenhum pagamento no período.', margin, y);
    y += 7;
  } else {
    for (const [method, amount] of paymentEntries) {
      doc.text(`${getPaymentLabel(method)}: ${pdfCurrency(amount)}`, margin, y);
      y += 5;
    }
    y += 3;
  }

  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Vendas do período', margin, y);
  y += 7;

  if (!(sales || []).length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Nenhuma venda encontrada para os filtros informados.', margin, y);
  }

  for (const sale of sales || []) {
    const totals = calculateSaleTotals(sale);
    const itemCount = Array.isArray(sale.items) ? sale.items.length : 0;
    const estimatedHeight = 27 + itemCount * 7 + Math.max(1, (sale.payments || []).length) * 5;
    ensureSpace(Math.min(estimatedHeight, 80));

    const isCancelled = sale.status === 'cancelada';
    doc.setFillColor(isCancelled ? 254 : 247, isCancelled ? 242 : 250, isCancelled ? 242 : 248);
    doc.setDrawColor(isCancelled ? 248 : 220, isCancelled ? 180 : 230, isCancelled ? 180 : 225);
    doc.roundedRect(margin, y, contentWidth, 13, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(isCancelled ? 185 : 15, isCancelled ? 28 : 23, isCancelled ? 28 : 42);
    doc.text(`Venda #${sale.sale_number}${isCancelled ? ' · CANCELADA' : ''}`, margin + 3, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(formatDateTime(sale.created_date), margin + 3, y + 10);
    doc.text(String(sale.seller_name || 'Sem vendedor').slice(0, 42), pageWidth - margin - 3, y + 5.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(pdfCurrency(sale.total), pageWidth - margin - 3, y + 10, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    y += 17;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Produtos vendidos', margin + 2, y);
    y += 5;

    if (!(sale.items || []).length) {
      doc.setFont('helvetica', 'normal');
      doc.text('Itens não disponíveis neste registro.', margin + 4, y);
      y += 6;
    } else {
      for (const item of sale.items || []) {
        ensureSpace(8);
        const quantity = item.unit === 'peso'
          ? `${Number(item.weight || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
          : `${Number(item.quantity || 0).toLocaleString('pt-BR')}x`;
        const nameLines = doc.splitTextToSize(`${quantity}  ${item.product_name || 'Produto'}`, 118);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(nameLines, margin + 4, y);
        doc.text(`Unitário: ${pdfCurrency(item.unit_price)}`, pageWidth - margin - 44, y, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(`Total ${pdfCurrency(item.subtotal)}`, pageWidth - margin - 3, y, { align: 'right' });
        y += Math.max(6, nameLines.length * 4);
      }
    }

    ensureSpace(22);
    doc.setDrawColor(235);
    doc.line(margin + 3, y, pageWidth - margin - 3, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Subtotal: ${pdfCurrency(totals.subtotal)}`, margin + 4, y);
    if (totals.discount > 0) doc.text(`Desconto: ${pdfCurrency(totals.discount)}`, margin + 60, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${pdfCurrency(totals.total)}`, pageWidth - margin - 3, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    const paymentText = (sale.payments || []).map((payment) => `${getPaymentLabel(payment.method)} ${pdfCurrency(payment.amount)}`).join(' · ') || 'Sem pagamento informado';
    const paymentLines = doc.splitTextToSize(`Pagamento: ${paymentText}`, contentWidth - 8);
    doc.text(paymentLines, margin + 4, y);
    y += Math.max(6, paymentLines.length * 4);
    if (sale.observation) {
      const observationLines = doc.splitTextToSize(`Observação: ${sale.observation}`, contentWidth - 8);
      doc.text(observationLines, margin + 4, y);
      y += observationLines.length * 4 + 2;
    }
    y += 5;
  }

  const dateLabel = from.toISOString().slice(0, 10);
  const marketPart = safeFilePart(config.nome_mercado || config.market_name || 'nexo-pdv');
  doc.save(`relatorio-${marketPart}-vendas-${dateLabel}.pdf`);
}
