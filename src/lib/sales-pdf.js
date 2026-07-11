import { formatCurrency, formatDateTime, getPaymentLabel } from '@/lib/helpers';

async function loadLogoForPdf(source) {
  if (!source) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let objectUrl;
  try {
    const response = await fetch(source, { signal: controller.signal });
    if (!response.ok) throw new Error('Logo indisponível');
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Logo inválida'));
      element.src = objectUrl;
    });
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
  const estimatedHeight = Math.max(200, 105 + (sale.items?.length || 0) * 12 + (sale.payments?.length || 0) * 7);
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
    const amount = item.unit === 'peso' ? `${Number(item.weight || 0).toLocaleString('pt-BR')} kg` : `${Number(item.quantity || 0)}x`;
    line(`${amount} ${item.product_name}`, { gap: 4 });
    line(`   ${formatCurrency(item.unit_price)} → ${formatCurrency(item.subtotal)}`, { gap: 4 });
  }

  line('--------------------------------', { center: true, gap: 4 });
  line(`Subtotal: ${formatCurrency(totals.subtotal)}`, { gap: 4 });
  if (totals.discount > 0) line(`Desconto: ${formatCurrency(totals.discount)}`, { gap: 4 });
  line(`TOTAL: ${formatCurrency(totals.total)}`, { bold: true, size: 11, gap: 6 });
  line('--------------------------------', { center: true, gap: 4 });
  for (const payment of sale.payments || []) line(`${getPaymentLabel(payment.method)}: ${formatCurrency(payment.amount)}`, { gap: 4 });
  if (Number(sale.change_amount || 0) > 0) line(`Troco: ${formatCurrency(sale.change_amount)}`, { gap: 4 });
  if (sale.observation) line(`Observação: ${sale.observation}`, { gap: 4 });
  line('', { gap: 3 });
  line('Obrigado pela preferência!', { center: true, gap: 4 });
  line('Volte sempre!', { center: true, gap: 4 });
  doc.save(`recibo-venda-${sale.sale_number}.pdf`);
}

export async function downloadDailySalesReportPdf({ sales, summary, filters, config = {}, sellerName = '', paymentLabel = '' }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  let y = 14;

  if (config.logo_url) {
    try {
      const logo = await loadLogoForPdf(config.logo_url);
      if (logo) {
        const ratio = Math.min(32 / logo.width, 16 / logo.height);
        const width = logo.width * ratio;
        const height = logo.height * ratio;
        doc.addImage(logo.dataUrl, 'PNG', margin, y, width, height, undefined, 'FAST');
      }
    } catch {
      // O relatório continua mesmo quando a logo externa não responde.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(config.nome_mercado || config.market_name || 'Nexo PDV', pageWidth - margin, y + 5, { align: 'right' });
  doc.setFontSize(12);
  doc.text('Relatório diário de vendas', pageWidth - margin, y + 12, { align: 'right' });
  y += 25;

  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const from = new Date(filters.from);
  const to = new Date(filters.to);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Período: ${from.toLocaleDateString('pt-BR')} ${from.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até ${to.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin, y);
  y += 5;
  doc.text(`Vendedor: ${sellerName || 'Todos permitidos'}`, margin, y);
  y += 5;
  doc.text(`Pagamento: ${paymentLabel || 'Todos'}`, margin, y);
  y += 10;

  const metrics = [
    ['Faturamento', formatCurrency(summary.total)],
    ['Vendas', String(summary.sales_count)],
    ['Ticket médio', formatCurrency(summary.average_ticket)],
    ['Canceladas', String(summary.cancelled_count)],
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
      doc.text(`${getPaymentLabel(method)}: ${formatCurrency(amount)}`, margin, y);
      y += 5;
    }
    y += 3;
  }

  const drawHeader = () => {
    doc.setFillColor(22, 160, 106);
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Venda', margin + 2, y + 5.5);
    doc.text('Horário', margin + 24, y + 5.5);
    doc.text('Vendedor', margin + 50, y + 5.5);
    doc.text('Pagamento', margin + 105, y + 5.5);
    doc.text('Total', pageWidth - margin - 2, y + 5.5, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    y += 8;
  };

  drawHeader();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const sale of sales) {
    if (y > 280) {
      doc.addPage();
      y = 14;
      drawHeader();
    }
    const rowHeight = 8;
    if (sale.status === 'cancelada') doc.setFillColor(254, 242, 242);
    else doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
    doc.text(`#${sale.sale_number}`, margin + 2, y + 5.5);
    doc.text(new Date(sale.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), margin + 24, y + 5.5);
    doc.text(String(sale.seller_name || '—').slice(0, 28), margin + 50, y + 5.5);
    doc.text((sale.payments || []).map(payment => getPaymentLabel(payment.method)).join(', ').slice(0, 28) || '—', margin + 105, y + 5.5);
    doc.text(sale.status === 'cancelada' ? 'CANCELADA' : formatCurrency(sale.total), pageWidth - margin - 2, y + 5.5, { align: 'right' });
    doc.setDrawColor(235);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    y += rowHeight;
  }

  const dateLabel = from.toISOString().slice(0, 10);
  doc.save(`relatorio-vendas-${dateLabel}.pdf`);
}
