import { send } from './http.js';
import { managementModules, productInsights, canReadPayables, marginDeclines } from '../src/lib/management-insights.js';
import { financePermissions } from './finance.js';
import { hasPlanFeature } from '../src/lib/plan-catalog.js';

export async function handleManagement({ req, res, sql, user }) {
  if (req.method !== 'GET') return send(res, 405, { message: 'Método não permitido.' });
  if (!user.market_id || !['admin', 'gerente'].includes(user.role))
    return send(res, 403, { message: 'Acesso exclusivo da gestão do mercado.' });
  const modules = managementModules(user);
  const permissions = modules.includes('financeiro') ? await financePermissions(sql, user) : null;
  const readPayables = canReadPayables(user) && Boolean(permissions?.view);
  const readMargins = hasPlanFeature(user, 'advanced_reports') && (!permissions || (permissions.view && permissions.view_profit && permissions.view_costs));
  const [products, sales, fiados, payables, configs, history] = await Promise.all([
    modules.includes('estoque') ? sql`SELECT id, data->>'name' AS name,data->'quantity' AS quantity,data->'active' AS active,data->>'status' AS status,data->'track_stock' AS track_stock,data->>'archived_at' AS archived_at,data->>'last_sale_at' AS last_sale_at,data->'sale_price' AS sale_price,data->'cost_price' AS cost_price,created_date FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' ORDER BY data->>'name',id` : [],
    modules.some(key => ['vendas', 'relatorios'].includes(key)) ? sql`SELECT count(*)::int AS count,EXISTS(SELECT 1 FROM nexo.records historical WHERE historical.market_id=${user.market_id} AND historical.entity='sales' AND historical.data->>'status'='concluida') AS has_sales,COALESCE(sum(CASE WHEN data->>'total' ~ '^[0-9]+([.][0-9]+)?$' THEN (data->>'total')::numeric ELSE 0 END),0) AS total FROM nexo.records WHERE market_id=${user.market_id} AND entity='sales' AND data->>'status'='concluida' AND created_date >= (date_trunc('day',now() AT TIME ZONE 'America/Bahia') AT TIME ZONE 'America/Bahia')` : [],
    modules.includes('fiados') ? sql`SELECT id,data->>'responsible_name' AS name,data->'total_amount' AS amount,count(*) OVER()::int AS count FROM nexo.records WHERE market_id=${user.market_id} AND entity='fiado_records' AND data->>'status'='pendente' ORDER BY created_date,id LIMIT 5` : [],
    readPayables ? sql`SELECT id,description,amount-paid_amount AS amount,to_char(due_date,'YYYY-MM-DD') AS due_date,count(*) OVER()::int AS count FROM nexo.finance_transactions WHERE market_id=${user.market_id} AND type='expense' AND status IN ('pending','partial','overdue') AND due_date <= (now() AT TIME ZONE 'America/Bahia')::date + 7 ORDER BY due_date,id LIMIT 5` : [],
    modules.includes('configuracoes') || modules.includes('estoque') ? sql`SELECT data->>'key' AS key,data->>'value' AS value FROM nexo.records WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key' IN ('nome_mercado','limite_estoque_baixo')` : [],
    readMargins && modules.includes('relatorios') && modules.includes('estoque') ? sql`SELECT data->'items' AS items,data->'total' AS total,data->>'status' AS status,created_date FROM nexo.records WHERE market_id=${user.market_id} AND entity='sales' AND data->>'status'='concluida' AND created_date >= now()-interval '60 days'` : [],
  ]);
  const config = Object.fromEntries(configs.map(row => [row.key, row.value]));
  const insights = modules.includes('estoque') ? productInsights(products, Math.max(1, Number(config.limite_estoque_baixo) || 5)) : null;
  if (insights && (!hasPlanFeature(user, 'advanced_reports') || (permissions && (!permissions.view || !permissions.view_profit || !permissions.view_costs)))) insights.margin = null;
  if (insights && !hasPlanFeature(user, 'advanced_reports')) insights.idle = null;
  const declines = readMargins && modules.includes('relatorios') && insights ? marginDeclines(history) : null;
  return send(res, 200, { generated_at: new Date().toISOString(), modules,
    products: insights, margin_declines: declines,
    sales: sales[0] || null, fiados: modules.includes('fiados') ? { count: fiados[0]?.count || 0, items: fiados } : null,
    payables: readPayables ? { count: payables[0]?.count || 0, items: payables } : null,
    configured: Boolean(config.nome_mercado),
  });
}
