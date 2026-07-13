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
  const rows = products.map(product => `<tr><td>${escapeHtml(product.name)}</td><td>${escapeHtml(product.category)}</td><td>${product.currentStock}</td><td>${product.averagePerDay}</td><td>${product.sold30}</td><td>${product.daysRemaining === null ? 'Sem previsão' : `${product.daysRemaining} dia(s)`}</td><td><strong>${escapeHtml(product.priority)}</strong></td><td>${product.updatedAt ? new Date(product.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Bahia' }) : 'Não informada'}</td></tr>`).join('');
  return {
    subject: `Reposição de estoque — ${marketName}`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17372d"><h2>Produtos que precisam de reposição</h2><p><strong>${escapeHtml(marketName)}</strong> · ${new Date(generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Bahia' })}</p><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Média/dia</th><th>Vendido 30 dias</th><th>Previsão</th><th>Prioridade</th><th>Atualização</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
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
