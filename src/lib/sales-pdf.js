import { formatCurrency, formatDateTime, getPaymentLabel } from '@/lib/helpers';

const pdfCurrency = value => formatCurrency(value).replace(/[\u00a0\u202f]/g, ' ');

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
      // Data URLs não devem passar por fetch: alguns navegadores bloqueiam
      // esse acesso pelo connect-src da CSP, mesmo sendo uma imagem válida.
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
  const discount = sale.discount_type === 'percentual'
    ? subtotal * Math.min(100, Math.max(0, Number(sale.discount_value || 0))) / 100
    : Math.max(0, Number(sale.discount_value || 0));
  return { subtotal, discount, total: Number(sale.total ?? Math.max(0, subtotal - discount)) };
}

export async function downloadSaleReceiptPdf(sale, config = {}, { onLogoError } = {}) {
  const { jsPDF } = await import('jspdf');
  const estimatedHeight = Math.max(200, 112 + (sale.items?.length || 0) * 14 + (sale.payments?.length || 0) * 7);
  const doc = new jsPDF({ unit: 'mm', format: [80, estimatedHeight] });
  const totals = calculateSaleTotals(sale);
  let y = 8;

  if (config.logo_url) {
    try {
      const logo = await loadLogoForPdf(config.logo_url);
      if (logo) {
        const ratio = Math.min(28 / logo.width, 15 / logo.height);
        const width = logo.width * ratio;
        const height = logo.height * ratio;
        doc.addImage(logo.dataUrl, 'PNG', 40 - width / 2, y, width, height, undefined, 'FAST');
        y += height + 3;
      }
    } catch (error) {
      onLogoError?.(error);
    }
  }

  const line = (value, { bold = false, center = false, size = 9, gap = 5 } = {}) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(String(value ?? ''), center ? 70 : 72);
    doc.text(lines, center ? 40 : 4, y, { align: center ? 'center' : 'left' });
    y += Math.max(gap, lines.length * 4);
  };

  line(config.nome_mercado || config.market_name || 'Nexo PDV', { bold: true, center: true, size: 11 });
  if (config.cnpj) line(`CNPJ: ${config.cnpj}`, { center: true, gap: 4 });
  if (config.endereco) line(config.endereco, { center: true, gap: 4 });
  line('--------------------------------', { center: true, gap: 4 });
  line(formatDateTime(sale.created_date || new Date()), { center: true, gap: 4 });
  line(`Venda #${sale.sale_number}`, { center: true, gap: 4 });
  line(`Atendente: ${sale.seller_name || 'Não informado'}`, { center: true, gap: 4 });
  line('--------------------------------', { center: true, gap: 4 });

  for (const item of sale.items || []) {
    const amount = item.unit === 'peso'
      ? `${Number(item.weight || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
      : `${Number(item.quantity || 0)}x`;
    line(`${amount} ${item.product_name}`, { gap: 4 });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Unitário: ${pdfCurrency(item.unit_price)}`, 8, y);
    doc.text(`Total: ${pdfCurrency(item.subtotal)}`, 76, y, { align: 'right' });
    y += 4.5;
  }

  line('--------------------------------', { center: true, gap: 4 });
  line(`Subtotal: ${pdfCurrency(totals.subtotal)}`, { gap: 4 });
  if (totals.discount > 0) line(`Desconto: ${pdfCurrency(totals.discount)}`, { gap: 4 });
  line(`TOTAL: ${pdfCurrency(totals.total)}`, { bold: true, size: 11, gap: 6 });
  line('--------------------------------', { center: true, gap: 4 });
  for (const payment of sale.payments || []) line(`${getPaymentLabel(payment.method)}: ${pdfCurrency(payment.amount)}`, { gap: 4 });
  if (Number(sale.change_amount || 0) > 0) line(`Troco: ${pdfCurrency(sale.change_amount)}`, { gap: 4 });
  if (sale.observation) line(`Observação: ${sale.observation}`, { gap: 4 });
  line('', { gap: 3 });
  line('Obrigado pela preferência!', { center: true, gap: 4 });
  line('Volte sempre!', { center: true, gap: 4 });
  doc.save(`recibo-venda-${sale.sale_number}.pdf`);
}

function safeDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export async function downloadDailySalesReportPdf({ sales, summary, filters, config = {}, sellerName = '', paymentLabel = '', title = 'Relatório de vendas' }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const ensureSpace = height => {
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
          ? `${Number(item.weight || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
          : `${Number(item.quantity || 0).toLocaleString('pt-BR')}x`;
        const nameLines = doc.splitTextToSize(`${quantity}  ${item.product_name || 'Produto'}`, 118);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(nameLines, margin + 4, y);
        doc.text(`Unit. ${pdfCurrency(item.unit_price)}`, pageWidth - margin - 44, y, { align: 'right' });
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
    const paymentText = (sale.payments || []).map(payment => `${getPaymentLabel(payment.method)} ${pdfCurrency(payment.amount)}`).join(' · ') || 'Sem pagamento informado';
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
  doc.save(`relatorio-vendas-${dateLabel}.pdf`);
}
