import { AppError } from './errors.js';

const DAY_MS = 86_400_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[character]);

export function analyzeStockReplenishment(products = [], sales = [], now = new Date()) {
  const from = new Date(now.getTime() - 30 * DAY_MS);
  const activity = new Map();
  for (const sale of sales) {
    if (sale.status !== 'concluida') continue;
    const soldAt = new Date(sale.created_date);
    if (Number.isNaN(soldAt.getTime()) || soldAt < from || soldAt > now) continue;
    const day = soldAt.toISOString().slice(0, 10);
    for (const item of sale.items || []) {
      const productId = String(item.product_id || '');
      if (!productId) continue;
      const quantity = Number(item.unit === 'peso' ? item.weight : item.quantity) || 0;
      const current = activity.get(productId) || { sold: 0, days: new Set() };
      current.sold += Math.max(0, quantity);
      if (quantity > 0) current.days.add(day);
      activity.set(productId, current);
    }
  }

  return products.flatMap(product => {
    if (product.status === 'inativo' || product.track_stock === false) return [];
    const stock = Math.max(0, Number(product.quantity || 0));
    const stats = activity.get(String(product.id)) || { sold: 0, days: new Set() };
    const sold30 = round(stats.sold);
    const averagePerDay = round(sold30 / 30);
    const saleFrequency = stats.days.size;
    const daysRemaining = averagePerDay > 0 ? round(stock / averagePerDay) : null;
    const frequentlySold = saleFrequency >= 8 || sold30 >= 10;
    const baseline = Math.max(1, averagePerDay * 7);

    let priority = '';
    if (stock <= 0) priority = 'Esgotado';
    else if (averagePerDay > 0 && stock < averagePerDay) priority = 'Reposição urgente';
    else if (frequentlySold && daysRemaining !== null && daysRemaining <= 2) priority = 'Crítico';
    else if ((averagePerDay > 0 && daysRemaining !== null && daysRemaining <= 7) || stock < baseline * 0.5) priority = 'Atenção';
    if (!priority) return [];

    return [{
      id: product.id,
      name: product.name || 'Produto sem nome',
      category: product.category || 'Sem categoria',
      currentStock: round(stock),
      averagePerDay,
      sold30,
      saleFrequency,
      daysRemaining,
      priority,
      updatedAt: product.updated_date || product.created_date || null,
    }];
  }).sort((first, second) => {
    const order = { Esgotado: 0, 'Reposição urgente': 1, 'Crítico': 2, 'Atenção': 3 };
    return order[first.priority] - order[second.priority] || (first.daysRemaining ?? Infinity) - (second.daysRemaining ?? Infinity);
  });
}

export function buildStockAlertEmail({ marketName, products, generatedAt }) {
  const priorityStyles = { Esgotado:'background:#fee2e2;color:#b91c1c', 'Reposição urgente':'background:#ffedd5;color:#c2410c', 'Crítico':'background:#fef3c7;color:#a16207', Atenção:'background:#ecfdf5;color:#047857' };
  const counts = products.reduce((result, product) => ({ ...result, [product.priority]:(result[product.priority] || 0) + 1 }), {});
  const rows = products.map(product => `<tr><td style="padding:14px 12px;border-bottom:1px solid #e8eee9"><strong style="display:block;color:#15392d">${escapeHtml(product.name)}</strong><span style="font-size:12px;color:#708078">${escapeHtml(product.category)}</span></td><td style="padding:14px 12px;border-bottom:1px solid #e8eee9;text-align:center;font-weight:700">${product.currentStock}</td><td style="padding:14px 12px;border-bottom:1px solid #e8eee9;text-align:center">${product.averagePerDay}</td><td style="padding:14px 12px;border-bottom:1px solid #e8eee9;text-align:center">${product.sold30}</td><td style="padding:14px 12px;border-bottom:1px solid #e8eee9;text-align:center">${product.daysRemaining === null ? 'Sem previsão' : `${product.daysRemaining} dia(s)`}</td><td style="padding:14px 12px;border-bottom:1px solid #e8eee9;text-align:center"><span style="display:inline-block;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;${priorityStyles[product.priority] || priorityStyles.Atenção}">${escapeHtml(product.priority)}</span></td><td style="padding:14px 12px;border-bottom:1px solid #e8eee9;font-size:12px;color:#708078">${product.updatedAt ? new Date(product.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Bahia' }) : 'Não informada'}</td></tr>`).join('');
  const summary = [['Reposição urgente','#f97316'],['Crítico','#eab308'],['Esgotado','#dc2626'],['Atenção','#16a06a']].map(([label,color]) => `<td style="padding:6px"><div style="border:1px solid #e2e9e4;border-radius:14px;padding:14px;background:#fff"><span style="display:block;font-size:11px;color:#708078">${label}</span><strong style="display:block;margin-top:5px;font-size:22px;color:${color}">${counts[label] || 0}</strong></div></td>`).join('');
  return {
    subject: `Reposição de estoque — ${marketName}`,
    html: `<!doctype html><html><body style="margin:0;background:#f2f6f3;font-family:Arial,sans-serif;color:#17372d"><div style="display:none;max-height:0;overflow:hidden">${products.length} produto(s) precisam de reposição.</div><div style="max-width:920px;margin:0 auto;padding:24px 12px"><div style="overflow:hidden;border:1px solid #dfe8e2;border-radius:22px;background:#fff;box-shadow:0 8px 30px rgba(15,81,50,.08)"><div style="padding:28px;background:#0f5132;color:#fff"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#89dab7">Nexo PDV</div><h1 style="margin:10px 0 4px;font-size:26px">Relatório de reposição</h1><p style="margin:0;color:#d5eee1">${escapeHtml(marketName)} · ${new Date(generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Bahia' })}</p></div><div style="padding:18px 20px;background:#f8fbf9"><table role="presentation" style="width:100%;border-collapse:collapse"><tr>${summary}</tr></table></div><div style="padding:8px 20px 24px;overflow-x:auto"><h2 style="margin:14px 0;font-size:17px">Produtos que precisam de atenção</h2><table style="width:100%;min-width:760px;border-collapse:collapse;font-size:13px"><thead><tr style="background:#edf5f0;color:#466258"><th style="padding:11px 12px;text-align:left">Produto</th><th>Estoque</th><th>Média/dia</th><th>Vendido 30 dias</th><th>Previsão</th><th>Prioridade</th><th>Atualização</th></tr></thead><tbody>${rows}</tbody></table></div><div style="border-top:1px solid #e8eee9;padding:18px 24px;text-align:center;font-size:12px;color:#708078">Relatório automático gerado pelo Nexo PDV com base nas vendas dos últimos 30 dias.</div></div></div></body></html>`,
  };
}

export async function sendStockAlertEmail({ to, marketName, products, generatedAt = new Date().toISOString() }) {
  const from = String(process.env.EMAIL_FROM || '').trim();
  const brevoApiKey = String(process.env.BREVO_API_KEY || '').trim();
  if (!brevoApiKey) throw new AppError(503, 'BREVO_API_KEY_MISSING', 'BREVO_API_KEY não está configurada no ambiente Production da Vercel.');
  if (!from) throw new AppError(503, 'EMAIL_FROM_MISSING', 'EMAIL_FROM não está configurado no ambiente Production da Vercel.');
  if (!brevoApiKey.startsWith('xkeysib-')) throw new AppError(503, 'BREVO_API_KEY_INVALID', 'BREVO_API_KEY não possui o formato esperado do Brevo.');
  const recipients = [...new Set((Array.isArray(to) ? to : [to]).map(value => String(value || '').trim().toLowerCase()).filter(value => EMAIL_PATTERN.test(value)))];
  if (!recipients.length) throw new AppError(400, 'INVALID_RECIPIENT', 'Informe pelo menos um e-mail válido.');
  const content = buildStockAlertEmail({ marketName, products, generatedAt });
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(from);
  const sender = { name:String(match?.[1] || 'Nexo PDV').trim(), email:String(match?.[2] || from).trim().toLowerCase() };
  if (!EMAIL_PATTERN.test(sender.email)) throw new AppError(503, 'EMAIL_FROM_INVALID', 'EMAIL_FROM deve ser um e-mail ou usar o formato Nexo PDV <email@gmail.com>.');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', { method:'POST', headers:{ 'api-key':brevoApiKey, Accept:'application/json', 'Content-Type':'application/json' }, body:JSON.stringify({ sender, to:recipients.map(email => ({ email })), subject:content.subject, htmlContent:content.html }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new AppError(502, 'BREVO_SEND_FAILED', result.message || 'O Brevo recusou o envio. Confirme a chave e o remetente verificado.');
  return { id:result.messageId || null, recipients, provider:'brevo' };
}

export function getStockEmailConfiguration() {
  const apiKey = String(process.env.BREVO_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim();
  return { provider:'brevo', apiKeyConfigured:apiKey.startsWith('xkeysib-'), senderConfigured:Boolean(from), ready:apiKey.startsWith('xkeysib-') && Boolean(from) };
}

export function isValidAlertEmail(value) { return EMAIL_PATTERN.test(String(value || '').trim()); }

export async function loadStockAlertReport(sql, marketId, now = new Date()) {
  const [products, sales] = await Promise.all([
    sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${marketId} AND entity='products'`,
    sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${marketId} AND entity='sales' AND data->>'status'='concluida' AND created_date >= ${new Date(now.getTime() - 30 * DAY_MS).toISOString()}`,
  ]);
  return analyzeStockReplenishment(
    products.map(row => ({ id:row.id, ...(row.data || {}), created_date:row.created_date, updated_date:row.updated_date })),
    sales.map(row => ({ id:row.id, ...(row.data || {}), created_date:row.created_date, updated_date:row.updated_date })),
    now,
  );
}
