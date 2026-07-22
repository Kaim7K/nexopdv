import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  assertDatabaseReady,
  CURRENT_SCHEMA_VERSION,
  getDb,
} from '../server/db.js';
import {
  authenticateCredentials,
  clearSession,
  createSession,
  currentUser,
  publicUser,
} from '../server/auth.js';
import {
  assertSameOriginRequest,
  handleError,
  methodNotAllowed,
  readJsonBody,
  send,
} from '../server/http.js';
import { AppError } from '../server/errors.js';
import { lookupBarcode } from '../server/product-catalog.js';
import { searchProductImages } from '../server/product-images.js';
import {
  getStockEmailConfiguration,
  isValidAlertEmail,
  loadMarketEmailBrand,
  loadStockAlertReport,
  sendStockAlertEmail,
} from '../server/stock-alerts.js';
import { handleFinanceRequest } from '../server/finance.js';

const ENTITIES = {
  Product: 'products',
  Sale: 'sales',
  FiadoRecord: 'fiado_records',
  GeneralAudit: 'general_audits',
  ProductAudit: 'product_audits',
  SystemConfig: 'system_configs',
  User: 'users',
  Market: 'markets',
  CashSession: 'cash_sessions',
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MARKET_MODULES = [
  'pdv',
  'estoque',
  'vendas',
  'caixas',
  'fiados',
  'relatorios',
  'financeiro',
  'auditoria',
  'usuarios',
  'configuracoes',
];
const MARKET_FEATURES = [
  'email_sending',
  'email_branding',
  'market_logo',
  'sidebar_customization',
  'automatic_image_search',
  'product_image_upload',
  'stock_email_alerts',
  'quick_product_creation',
  'report_export',
  'recurring_finance',
  'integrated_purchases',
  'financial_email_alerts',
];
const USER_ROLES = ['vendedor', 'gerente', 'admin'];
const PAYMENT_METHODS = new Set([
  'dinheiro',
  'pix',
  'debito',
  'credito',
  'outros',
  'fiado',
]);
const PRODUCT_FIELDS = [
  'name',
  'category',
  'barcode',
  'internal_code',
  'image_url',
  'sale_price',
  'cost_price',
  'quantity',
  'unit',
  'status',
  'allow_pdv_price_edit',
  'track_stock',
];
const PRODUCT_UNITS = new Set(['unidade', 'peso', 'pacote']);
const PRODUCT_STATUSES = new Set(['ativo', 'inativo']);
const STOCK_ALERT_TIMEZONE = 'America/Bahia';
const STOCK_ALERT_FREQUENCIES = {
  daily: 1,
  weekly: 7,
  fortnightly: 15,
  monthly: 30,
};
const CONFIG_FEATURES = {
  logo_url: 'market_logo',
  sidebar_background_color: 'sidebar_customization',
  sidebar_accent_color: 'sidebar_customization',
  contact_email: 'email_branding',
  contact_phone: 'email_branding',
  email_footer: 'email_branding',
};

const text = (value, max = 500) =>
  String(value ?? '')
    .trim()
    .slice(0, max);
const hasFeature = (user, feature) =>
  user.role === 'super_admin' ||
  (user.enabled_features || []).includes(feature);
const productNameKey = (value) =>
  text(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ');
const MAX_INLINE_IMAGE_LENGTH = 1_650_000;

function normalizeImageValue(value) {
  const image = String(value ?? '').trim();
  if (!image) return '';
  if (/^https?:\/\//i.test(image)) {
    if (image.length > 2048)
      throw new AppError(
        400,
        'INVALID_IMAGE',
        'O endereço da imagem é muito longo.',
      );
    return image;
  }
  if (/^www\./i.test(image)) return `https://${image}`;
  if (/^\/\/[^/]+/i.test(image)) return `https:${image}`;
  if (/^data:image\/(jpeg|png|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(image)) {
    if (image.length > MAX_INLINE_IMAGE_LENGTH)
      throw new AppError(
        413,
        'IMAGE_TOO_LARGE',
        'A imagem otimizada ultrapassa o tamanho permitido.',
      );
    return image.replace(/\s+/g, '');
  }
  throw new AppError(400, 'INVALID_IMAGE', 'A imagem informada não é válida.');
}
const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function parseDateQuery(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function recordFromRow(row) {
  return row
    ? {
        id: row.id,
        ...(row.data || {}),
        created_date: row.created_date,
        updated_date: row.updated_date,
      }
    : null;
}

function summarizeSales(sales) {
  const completed = sales.filter((sale) => sale.status === 'concluida');
  const cancelled = sales.filter((sale) => sale.status === 'cancelada');
  const payments = {};
  let total = 0;
  let discounts = 0;
  let items = 0;
  for (const sale of completed) {
    total += Number(sale.total || 0);
    const subtotal = Number(sale.subtotal || sale.total || 0);
    discounts += Math.max(0, subtotal - Number(sale.total || 0));
    items += Array.isArray(sale.items)
      ? sale.items.reduce(
          (sum, item) =>
            sum +
            Number(
              item.unit === 'peso' ? item.weight || 0 : item.quantity || 0,
            ),
          0,
        )
      : 0;
    for (const payment of sale.payments || []) {
      payments[payment.method] = roundMoney(
        Number(payments[payment.method] || 0) + Number(payment.amount || 0),
      );
    }
  }
  return {
    total: roundMoney(total),
    discounts: roundMoney(discounts),
    sales_count: completed.length,
    cancelled_count: cancelled.length,
    average_ticket: completed.length ? roundMoney(total / completed.length) : 0,
    items_count: roundMoney(items),
    payments,
  };
}

function zonedDateParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: STOCK_ALERT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour || 0),
  };
}

async function processScheduledStockAlerts(sql, now = new Date()) {
  const clock = zonedDateParts(now);
  const markets = await sql`
    SELECT market.id, market.name,
      COALESCE((SELECT config.data->>'value' FROM nexo.records config WHERE config.market_id=market.id AND config.entity='system_configs' AND config.data->>'key'='stock_alert_time' LIMIT 1), '20:00') AS alert_time,
      COALESCE((SELECT config.data->>'value' FROM nexo.records config WHERE config.market_id=market.id AND config.entity='system_configs' AND config.data->>'key'='stock_alert_enabled' LIMIT 1), 'true') AS alert_enabled,
      COALESCE((SELECT config.data->>'value' FROM nexo.records config WHERE config.market_id=market.id AND config.entity='system_configs' AND config.data->>'key'='stock_alert_frequency' LIMIT 1), 'daily') AS alert_frequency,
      (SELECT MAX(delivery.created_date) FROM nexo.records delivery WHERE delivery.market_id=market.id AND delivery.entity='stock_alert_deliveries' AND delivery.data->>'status'='enviado') AS last_sent_at
    FROM nexo.markets market
    WHERE market.active=true
      AND market.enabled_features ? 'stock_email_alerts'
      AND market.enabled_features ? 'email_sending'
      AND EXISTS (SELECT 1 FROM nexo.records recipient WHERE recipient.market_id=market.id AND recipient.entity='stock_alert_recipients' AND recipient.data->>'active'='true')
  `;
  const results = [];
  for (const market of markets) {
    if (market.alert_enabled !== 'true') continue;
    const intervalDays = STOCK_ALERT_FREQUENCIES[market.alert_frequency] || 1;
    if (
      market.last_sent_at &&
      now.getTime() - new Date(market.last_sent_at).getTime() <
        intervalDays * 86_400_000
    )
      continue;
    const scheduledHour = Math.max(
      0,
      Math.min(
        23,
        Number(String(market.alert_time || '20:00').split(':')[0]) || 20,
      ),
    );
    if (clock.hour < scheduledHour) continue;
    const deliveryKey = `${market.id}:${clock.date}`;
    const [claim] = await sql`
      WITH retried AS (
        UPDATE nexo.records SET data=data || jsonb_build_object('status','processando','attempts',COALESCE((data->>'attempts')::int,0)+1,'last_attempt_at',now()), updated_date=now()
        WHERE market_id=${market.id} AND entity='stock_alert_deliveries' AND data->>'delivery_key'=${deliveryKey} AND data->>'status'='falhou' AND COALESCE((data->>'attempts')::int,0)<3
        RETURNING id
      ), inserted AS (
        INSERT INTO nexo.records(market_id,entity,data) VALUES(${market.id},'stock_alert_deliveries',${JSON.stringify({ delivery_key: deliveryKey, report_date: clock.date, status: 'processando', attempts: 1 })}::jsonb)
        ON CONFLICT DO NOTHING RETURNING id
      ) SELECT id FROM retried UNION ALL SELECT id FROM inserted LIMIT 1
    `;
    if (!claim) continue;
    try {
      const products = await loadStockAlertReport(sql, market.id, now);
      const recipientRows =
        await sql`SELECT data FROM nexo.records WHERE market_id=${market.id} AND entity='stock_alert_recipients' AND data->>'active'='true'`;
      const recipients = recipientRows
        .map((row) => row.data?.email)
        .filter(Boolean);
      if (!products.length || !recipients.length) {
        await sql`UPDATE nexo.records SET data=data || ${JSON.stringify({ status: 'ignorado', product_count: products.length, recipients, finished_at: now.toISOString() })}::jsonb,updated_date=now() WHERE id=${claim.id}`;
        results.push({
          market_id: market.id,
          status: 'ignorado',
          products: products.length,
        });
        continue;
      }
      const brand = await loadMarketEmailBrand(sql, market.id);
      const sent = await sendStockAlertEmail({
        to: recipients,
        marketName: market.name,
        brand,
        products,
        generatedAt: now.toISOString(),
      });
      await sql`UPDATE nexo.records SET data=data || ${JSON.stringify({ status: 'enviado', product_count: products.length, recipients: sent.recipients, provider_id: sent.id, finished_at: now.toISOString() })}::jsonb,updated_date=now() WHERE id=${claim.id}`;
      results.push({
        market_id: market.id,
        status: 'enviado',
        products: products.length,
      });
    } catch (error) {
      await sql`UPDATE nexo.records SET data=data || ${JSON.stringify({ status: 'falhou', error: text(error?.message, 500), finished_at: now.toISOString() })}::jsonb,updated_date=now() WHERE id=${claim.id}`;
      results.push({ market_id: market.id, status: 'falhou' });
    }
  }
  return results;
}

async function findOpenCashSession(sql, marketId, sellerId) {
  const rows = await sql`
    SELECT id, data, created_date, updated_date
    FROM nexo.records
    WHERE market_id=${marketId}
      AND entity='cash_sessions'
      AND data->>'seller_id'=${sellerId}
      AND data->>'status'='aberto'
    ORDER BY created_date DESC
    LIMIT 1
  `;
  return recordFromRow(rows[0]);
}

async function getCashSessionSummary(sql, marketId, session) {
  if (!session) return null;
  const rows = await sql`
    SELECT id, data, created_date, updated_date
    FROM nexo.records
    WHERE market_id=${marketId}
      AND entity='sales'
      AND data->>'cash_session_id'=${session.id}
    ORDER BY created_date ASC
  `;
  const sales = rows.map(recordFromRow);
  const movementRows =
    await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${marketId} AND entity='cash_movements' AND data->>'cash_session_id'=${session.id} ORDER BY created_date ASC`;
  const movements = movementRows.map(recordFromRow);
  const entries = roundMoney(
    movements
      .filter((item) => item.type === 'entrada')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  );
  const withdrawals = roundMoney(
    movements
      .filter((item) => item.type === 'retirada')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  );
  const summary = summarizeSales(sales);
  const openingAmount = roundMoney(Number(session.opening_amount || 0));
  const cashSales = roundMoney(Number(summary.payments.dinheiro || 0));
  return {
    ...summary,
    opening_amount: openingAmount,
    cash_sales: cashSales,
    entries,
    withdrawals,
    expected_cash: roundMoney(
      openingAmount + cashSales + entries - withdrawals,
    ),
    opened_at: session.opened_at || session.created_date,
    sales,
    movements,
    filters: {
      from: new Date(session.opened_at || session.created_date).toISOString(),
      to: new Date().toISOString(),
      seller_id: session.seller_id || null,
      payment: null,
    },
  };
}

function normalizeProductPayload(data, partial = false) {
  const source = data && typeof data === 'object' ? data : {};
  const clean = {};
  for (const field of PRODUCT_FIELDS) {
    if (partial && source[field] === undefined) continue;
    if (['sale_price', 'cost_price', 'quantity'].includes(field)) {
      clean[field] =
        source[field] === null || source[field] === ''
          ? field === 'cost_price'
            ? null
            : 0
          : Number(source[field]);
    } else if (field === 'unit')
      clean[field] = PRODUCT_UNITS.has(source[field])
        ? source[field]
        : 'unidade';
    else if (field === 'status')
      clean[field] = PRODUCT_STATUSES.has(source[field])
        ? source[field]
        : 'ativo';
    else if (field === 'allow_pdv_price_edit')
      clean[field] = Boolean(source[field]);
    else if (field === 'track_stock') clean[field] = source[field] !== false;
    else if (field === 'image_url')
      clean[field] = normalizeImageValue(source[field]);
    else clean[field] = text(source[field], 180);
  }
  return clean;
}

async function assertProductBarcodeAvailable(
  sql,
  marketId,
  barcode,
  excludeId = null,
) {
  const normalized = text(barcode, 180);
  if (!normalized) return;
  const rows =
    await sql`SELECT id FROM nexo.records WHERE market_id=${marketId} AND entity='products' AND data->>'barcode'=${normalized} AND (${excludeId === null} OR id<>${excludeId}::uuid) LIMIT 1`;
  if (rows.length)
    throw new AppError(
      409,
      'DUPLICATE_BARCODE',
      'Já existe um produto com este código de barras.',
    );
}

function normalizeAuditPayload(data, user, type) {
  const source = data && typeof data === 'object' ? data : {};
  const details =
    typeof source.details === 'string'
      ? source.details.slice(0, 20000)
      : (source.details ?? '');
  const common = {
    user_id: user.id,
    user_name: text(user.full_name || user.email, 180),
  };
  if (type === 'general_audits')
    return {
      ...common,
      action_type: text(source.action_type, 100),
      entity_type: text(source.entity_type, 100),
      entity_id: isUuid(source.entity_id) ? source.entity_id : null,
      description: text(source.description, 1000),
      details,
    };
  return {
    ...common,
    product_id: isUuid(source.product_id) ? source.product_id : null,
    product_name: text(source.product_name, 180),
    field_changed: text(source.field_changed, 100),
    previous_value: text(source.previous_value, 1000),
    new_value: text(source.new_value, 1000),
    change_origin: text(source.change_origin, 100),
    sale_number: Number.isFinite(Number(source.sale_number))
      ? Number(source.sale_number)
      : null,
    observation: text(source.observation, 1000),
  };
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function matchesFilter(record, key, expected) {
  const actual = record[key];
  if (Array.isArray(expected)) return expected.includes(actual);
  if (expected && typeof expected === 'object') {
    if (Array.isArray(actual)) {
      if (Array.isArray(expected.includesAny))
        return expected.includesAny.some((value) => actual.includes(value));
      if (Array.isArray(expected.includesAll))
        return expected.includesAll.every((value) => actual.includes(value));
    }
    return Object.entries(expected).every(
      ([nestedKey, nestedValue]) => actual?.[nestedKey] === nestedValue,
    );
  }
  return actual === expected;
}

function parseFiltersQuery(value) {
  if (!value) return null;
  try {
    const filters = JSON.parse(String(value));
    if (!filters || typeof filters !== 'object' || Array.isArray(filters))
      throw new Error('filters must be an object');
    return filters;
  } catch {
    throw new AppError(
      400,
      'INVALID_FILTERS',
      'Os filtros informados não são válidos.',
    );
  }
}

function validateProductPayload(data, partial = false) {
  if (!partial || data.name !== undefined) {
    if (!String(data.name || '').trim())
      throw new AppError(
        400,
        'INVALID_PRODUCT',
        'Nome do produto é obrigatório.',
      );
  }
  if (!partial || data.sale_price !== undefined) {
    if (
      !Number.isFinite(Number(data.sale_price)) ||
      Number(data.sale_price) < 0
    )
      throw new AppError(400, 'INVALID_PRODUCT', 'Preço de venda inválido.');
  }
  if (!partial || data.quantity !== undefined) {
    if (!Number.isFinite(Number(data.quantity)) || Number(data.quantity) < 0)
      throw new AppError(400, 'INVALID_PRODUCT', 'Quantidade inválida.');
  }
  if (
    data.cost_price !== undefined &&
    data.cost_price !== null &&
    data.cost_price !== '' &&
    (!Number.isFinite(Number(data.cost_price)) || Number(data.cost_price) < 0)
  ) {
    throw new AppError(400, 'INVALID_PRODUCT', 'Preço de custo inválido.');
  }
  if (data.unit !== undefined && !PRODUCT_UNITS.has(data.unit))
    throw new AppError(400, 'INVALID_PRODUCT', 'Unidade de venda inválida.');
  if (data.status !== undefined && !PRODUCT_STATUSES.has(data.status))
    throw new AppError(400, 'INVALID_PRODUCT', 'Status do produto inválido.');
  if (
    data.allow_pdv_price_edit !== undefined &&
    typeof data.allow_pdv_price_edit !== 'boolean'
  )
    throw new AppError(
      400,
      'INVALID_PRODUCT',
      'Permissão de preço no PDV inválida.',
    );
  if (data.track_stock !== undefined && typeof data.track_stock !== 'boolean')
    throw new AppError(400, 'INVALID_PRODUCT', 'Controle de estoque inválido.');
}

async function routeHandler(req, res) {
  const sql = getDb();
  const requestUrl = new URL(req.url, 'http://localhost');
  req.query = {
    ...Object.fromEntries(requestUrl.searchParams.entries()),
    ...(req.query || {}),
  };
  const routedPath =
    req.query.path || requestUrl.pathname.replace(/^\/api(?:\/index)?/, '');
  const path = String(routedPath || '/')
    .split('/')
    .filter(Boolean);
  assertSameOriginRequest(req);
  req.body = await readJsonBody(req);

  if (path[0] === 'sitemap.xml') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const rawHost = String(
      req.headers['x-forwarded-host'] || req.headers.host || '',
    )
      .split(',')[0]
      .trim();
    const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(rawHost) ? rawHost : '';
    const protocol =
      String(req.headers['x-forwarded-proto'] || 'https')
        .split(',')[0]
        .trim() === 'http'
        ? 'http'
        : 'https';
    const origin = host ? `${protocol}://${host}` : '';
    const location = origin ? `${origin}/` : '/';
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${location}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.status(200).send(xml);
  }

  if (path[0] === 'health') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const databaseVersion = await assertDatabaseReady(sql);
    const [status] = await sql`
      SELECT EXISTS(
        SELECT 1 FROM nexo.users WHERE role = 'super_admin' AND active = true
      ) AS super_admin_ready
    `;
    return send(res, 200, {
      ok: true,
      database: 'connected',
      schemaVersion: databaseVersion,
      requiredSchemaVersion: CURRENT_SCHEMA_VERSION,
      superAdmin: Boolean(status?.super_admin_ready),
    });
  }

  if (path[0] === 'auth' && path[1] === 'logout') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    clearSession(res);
    return send(res, 200, { ok: true });
  }

  await assertDatabaseReady(sql);

  if (path[0] === 'cron' && path[1] === 'stock-alerts') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const cronSecret = String(process.env.CRON_SECRET || '').trim();
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`)
      return send(res, 401, { message: 'Agendamento não autorizado.' });
    const results = await processScheduledStockAlerts(sql);
    return send(res, 200, { ok: true, processed: results.length, results });
  }

  if (path[0] === 'auth' && path[1] === 'login') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const authenticated = await authenticateCredentials(sql, req.body);
    if (authenticated.role !== 'super_admin' && authenticated.maintenance_mode)
      throw new AppError(
        503,
        'PLATFORM_MAINTENANCE',
        authenticated.maintenance_message ||
          'A plataforma está em manutenção. Tente novamente em instantes.',
      );
    await sql`UPDATE nexo.users SET last_login_at = now() WHERE id = ${authenticated.id}`;
    const [sessionPolicy] =
      await sql`SELECT value #>> '{}' AS hours FROM nexo.platform_settings WHERE key='security_session_hours'`;
    await createSession(authenticated, res, Number(sessionPolicy?.hours || 12));
    return send(res, 200, { ok: true, user: publicUser(authenticated) });
  }
  const user = await currentUser(req, sql);
  if (!user)
    return send(res, 401, {
      code: 'SESSION_EXPIRED',
      message: 'Sessão expirada.',
    });
  if (user.role !== 'super_admin' && user.maintenance_mode)
    return send(res, 503, {
      code: 'PLATFORM_MAINTENANCE',
      message:
        user.maintenance_message ||
        'A plataforma está em manutenção. Tente novamente em instantes.',
    });
  if (path[0] === 'auth' && path[1] === 'me') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    return send(res, 200, publicUser(user));
  }
  if (path[0] === 'products' && path[1] === 'barcode-lookup') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const product = await lookupBarcode(req.query.barcode);
    return send(res, 200, { found: Boolean(product), product });
  }
  if (path[0] === 'products' && path[1] === 'image-search') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    if (!hasFeature(user, 'automatic_image_search'))
      return send(res, 403, {
        code: 'FEATURE_NOT_AVAILABLE',
        message:
          'A pesquisa automática de imagens não está incluída neste plano.',
      });
    const result = await searchProductImages({
      query: req.query.query || req.query.name || '',
      name: req.query.name || '',
      page: Number(req.query.page || 1),
    });
    return send(res, 200, result);
  }
  const entityModules = {
    Sale: 'vendas',
    FiadoRecord: 'fiados',
    User: 'usuarios',
  };
  const requiredModule =
    path[0] === 'finance'
      ? 'financeiro'
      : path[0] === 'stock'
        ? 'estoque'
        : path[0] === 'stock-alerts'
          ? 'configuracoes'
          : path[0] === 'products' || path[0] === 'product-media'
            ? null
            : path[0] === 'cash'
              ? ['current', 'open', 'close', 'settings'].includes(path[1])
                ? 'pdv'
                : 'caixas'
              : path[0] === 'sales'
                ? path[1] === 'complete' || path[1] === 'next'
                  ? 'pdv'
                  : path[1] === 'report'
                    ? 'relatorios'
                    : 'vendas'
                : path[0] === 'users'
                  ? 'usuarios'
                  : path[0] === 'maintenance'
                    ? 'configuracoes'
                    : path[0] === 'entities'
                      ? entityModules[path[1]]
                      : null;
  const requiredModuleOptions =
    path[0] === 'entities' && req.method === 'GET' && path[1] === 'Sale'
      ? ['vendas', 'relatorios']
      : path[0] === 'entities' &&
          req.method === 'GET' &&
          path[1] === 'FiadoRecord'
        ? ['fiados', 'relatorios']
        : requiredModule
          ? [requiredModule]
          : [];
  if (
    user.role !== 'super_admin' &&
    requiredModuleOptions.length &&
    !requiredModuleOptions.some((module) =>
      (user.enabled_modules || []).includes(module),
    )
  )
    return send(res, 403, {
      message: 'Esta funcionalidade não está habilitada para o mercado.',
    });
  if (
    user.role !== 'super_admin' &&
    path[0] === 'entities' &&
    path[1] === 'Product' &&
    !['pdv', 'estoque'].some((module) =>
      (user.enabled_modules || []).includes(module),
    )
  )
    return send(res, 403, {
      message: 'Produtos não estão habilitados para o mercado.',
    });

  if (path[0] === 'finance')
    return handleFinanceRequest({ req, res, sql, user, path });

  if (path[0] === 'stock-alerts') {
    if (!user.market_id || !['admin', 'gerente'].includes(user.role))
      return send(res, 403, {
        message: 'Sem permissão para configurar alertas de estoque.',
      });
    if (!hasFeature(user, 'stock_email_alerts'))
      return send(res, 403, {
        code: 'FEATURE_NOT_AVAILABLE',
        message:
          'Os alertas automáticos de reposição não estão incluídos neste plano.',
      });
    if (path[1] === 'settings' && req.method === 'GET') {
      const [recipients, deliveries, configRows] = await Promise.all([
        sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${user.market_id} AND entity='stock_alert_recipients' ORDER BY created_date`,
        sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${user.market_id} AND entity='stock_alert_deliveries' ORDER BY created_date DESC LIMIT 20`,
        sql`SELECT data FROM nexo.records WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key'=ANY(ARRAY['stock_alert_time','stock_alert_enabled','stock_alert_frequency'])`,
      ]);
      const config = Object.fromEntries(
        configRows.map((row) => [row.data?.key, row.data?.value]),
      );
      return send(res, 200, {
        enabled: config.stock_alert_enabled !== 'false',
        frequency: STOCK_ALERT_FREQUENCIES[config.stock_alert_frequency]
          ? config.stock_alert_frequency
          : 'daily',
        time: config.stock_alert_time || '20:00',
        timezone: STOCK_ALERT_TIMEZONE,
        emailConfiguration: getStockEmailConfiguration(),
        recipients: recipients.map(recordFromRow),
        deliveries: deliveries.map(recordFromRow),
      });
    }
    if (path[1] === 'settings' && req.method === 'PATCH') {
      const time = '20:00';
      const enabled = req.body.enabled !== false;
      const frequency = STOCK_ALERT_FREQUENCIES[req.body.frequency]
        ? req.body.frequency
        : 'daily';
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        return send(res, 400, { message: 'Informe um horário válido.' });
      const entries = [
        {
          key: 'stock_alert_time',
          value: time,
          label: 'Horário do alerta de estoque',
        },
        {
          key: 'stock_alert_enabled',
          value: String(enabled),
          label: 'Envio automático do alerta de estoque',
        },
        {
          key: 'stock_alert_frequency',
          value: frequency,
          label: 'Frequência do alerta de estoque',
        },
      ];
      for (const payload of entries) {
        await sql`
          WITH updated AS (
            UPDATE nexo.records SET data=data || ${JSON.stringify(payload)}::jsonb,updated_date=now()
            WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key'=${payload.key} RETURNING id
          )
          INSERT INTO nexo.records(market_id,entity,data) SELECT ${user.market_id},'system_configs',${JSON.stringify(payload)}::jsonb WHERE NOT EXISTS(SELECT 1 FROM updated)
        `;
      }
      return send(res, 200, {
        enabled,
        frequency,
        time,
        timezone: STOCK_ALERT_TIMEZONE,
      });
    }
    if (path[1] === 'preview' && req.method === 'GET') {
      const products = await loadStockAlertReport(sql, user.market_id);
      return send(res, 200, {
        generated_at: new Date().toISOString(),
        products,
      });
    }
    if (path[1] === 'recipients' && !path[2] && req.method === 'POST') {
      const email = text(req.body.email, 320).toLowerCase();
      if (!isValidAlertEmail(email))
        return send(res, 400, {
          message: 'Informe um endereço de e-mail válido.',
        });
      const [recipient] =
        await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(${user.market_id},'stock_alert_recipients',${JSON.stringify({ email, active: req.body.active !== false })}::jsonb) RETURNING id,data,created_date,updated_date`;
      return send(res, 201, recordFromRow(recipient));
    }
    if (path[1] === 'recipients' && path[2] && req.method === 'PATCH') {
      if (!isUuid(path[2]))
        return send(res, 400, { message: 'Destinatário inválido.' });
      const email = text(req.body.email, 320).toLowerCase();
      if (!isValidAlertEmail(email))
        return send(res, 400, {
          message: 'Informe um endereço de e-mail válido.',
        });
      const [recipient] =
        await sql`UPDATE nexo.records SET data=data || ${JSON.stringify({ email, active: req.body.active !== false })}::jsonb,updated_date=now() WHERE id=${path[2]} AND market_id=${user.market_id} AND entity='stock_alert_recipients' RETURNING id,data,created_date,updated_date`;
      return send(
        res,
        recipient ? 200 : 404,
        recipient
          ? recordFromRow(recipient)
          : { message: 'Destinatário não encontrado.' },
      );
    }
    if (path[1] === 'recipients' && path[2] && req.method === 'DELETE') {
      if (!isUuid(path[2]))
        return send(res, 400, { message: 'Destinatário inválido.' });
      const [removed] =
        await sql`DELETE FROM nexo.records WHERE id=${path[2]} AND market_id=${user.market_id} AND entity='stock_alert_recipients' RETURNING id`;
      return send(
        res,
        removed ? 200 : 404,
        removed ? { ok: true } : { message: 'Destinatário não encontrado.' },
      );
    }
    if (path[1] === 'test' && req.method === 'POST') {
      if (!hasFeature(user, 'email_sending'))
        return send(res, 403, {
          code: 'FEATURE_NOT_AVAILABLE',
          message: 'O envio de e-mails não está incluído neste plano.',
        });
      const email = text(req.body.email, 320).toLowerCase();
      if (!isValidAlertEmail(email))
        return send(res, 400, {
          message: 'Informe um endereço de e-mail válido.',
        });
      const products = await loadStockAlertReport(sql, user.market_id);
      const brand = await loadMarketEmailBrand(sql, user.market_id);
      const sent = await sendStockAlertEmail({
        to: [email],
        marketName: user.market_name || 'Nexo PDV',
        brand,
        products,
        generatedAt: new Date().toISOString(),
      });
      return send(res, 200, {
        ok: true,
        provider_id: sent.id,
        product_count: products.length,
      });
    }
    return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
  }

  if (path[0] === 'products' && path[1] === 'quick') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (
      !user.market_id ||
      !['vendedor', 'gerente', 'admin'].includes(user.role)
    )
      return send(res, 403, {
        message: 'Sem permissão para cadastrar produtos no PDV.',
      });
    if (!(user.enabled_modules || []).includes('pdv'))
      return send(res, 403, {
        message: 'O PDV não está habilitado para este mercadinho.',
      });
    if (!hasFeature(user, 'quick_product_creation'))
      return send(res, 403, {
        code: 'FEATURE_NOT_AVAILABLE',
        message: 'O cadastro rápido de produtos não está incluído neste plano.',
      });
    const barcode = text(req.body.barcode, 64);
    const name = text(req.body.name, 180);
    if (!/^\d{6,32}$/.test(barcode))
      return send(res, 400, {
        message: 'O código de barras lido não é válido.',
      });
    if (!name) return send(res, 400, { message: 'Informe o nome do produto.' });
    const configRows =
      await sql`SELECT data FROM nexo.records WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key'=ANY(ARRAY['default_product_unit','default_product_sale_price','default_product_category','default_product_track_stock'])`;
    const [capacity] =
      await sql`SELECT market.product_limit,(SELECT count(*)::int FROM nexo.records WHERE market_id=market.id AND entity='products') AS product_count FROM nexo.markets market WHERE market.id=${user.market_id}`;
    if (
      capacity?.product_limit &&
      Number(capacity.product_count) >= Number(capacity.product_limit)
    )
      return send(res, 409, {
        code: 'PRODUCT_LIMIT_REACHED',
        message:
          'O limite de produtos deste mercadinho foi atingido. Ajuste o plano antes de cadastrar outro item.',
      });
    const defaults = Object.fromEntries(
      configRows.map((row) => [row.data?.key, row.data?.value]),
    );
    const unit = PRODUCT_UNITS.has(defaults.default_product_unit)
      ? defaults.default_product_unit
      : 'unidade';
    const defaultPrice = roundMoney(
      Math.max(0, Number(defaults.default_product_sale_price || 0)),
    );
    const productPayload = {
      name,
      barcode,
      internal_code: `PDV-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
      image_url: '',
      sale_price: Number.isFinite(defaultPrice) ? defaultPrice : 0,
      cost_price: null,
      quantity: 0,
      unit,
      status: 'ativo',
      category: text(defaults.default_product_category, 180),
      allow_pdv_price_edit: false,
      track_stock: defaults.default_product_track_stock !== 'false',
      quick_created: true,
    };
    const auditPayload = {
      action_type: 'produto_cadastrado_rapido',
      entity_type: 'product',
      user_id: user.id,
      user_name: user.full_name || user.email,
      description: `Produto ${name} cadastrado pelo PDV`,
      details: { barcode, origin: 'pdv_quick_registration' },
    };
    const rows = await sql`
      WITH created AS (
        INSERT INTO nexo.records(market_id,entity,data)
        VALUES(${user.market_id},'products',${JSON.stringify(productPayload)}::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING id,data,created_date,updated_date
      ), audit AS (
        INSERT INTO nexo.records(market_id,entity,data)
        SELECT ${user.market_id},'general_audits',${JSON.stringify(auditPayload)}::jsonb || jsonb_build_object('entity_id',created.id)
        FROM created RETURNING id
      )
      SELECT id,data,created_date,updated_date,true AS created FROM created
    `;
    if (rows[0])
      return send(res, 201, { product: recordFromRow(rows[0]), created: true });
    const [existing] =
      await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND btrim(data->>'barcode')=${barcode} LIMIT 1`;
    if (!existing)
      throw new AppError(
        409,
        'PRODUCT_CREATE_CONFLICT',
        'O produto foi alterado por outro usuário. Leia o código novamente.',
      );
    return send(res, 200, { product: recordFromRow(existing), created: false });
  }

  if (path[0] === 'products' && path[1] === 'delete-inactive') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (
      !user.market_id ||
      !['admin', 'gerente'].includes(user.role) ||
      !(user.enabled_modules || []).includes('estoque')
    )
      return send(res, 403, {
        message: 'Sem permissão para apagar produtos inativos.',
      });
    if (req.body.confirmation !== 'APAGAR_INATIVOS')
      return send(res, 400, { message: 'Confirmação inválida.' });
    const removed = await sql`
      WITH candidates AS (
        SELECT id, data
        FROM nexo.records
        WHERE market_id=${user.market_id}
          AND entity='products'
          AND COALESCE(
            CASE
              WHEN COALESCE(data->>'last_sale_at','') ~ '^\d{4}-\d{2}-\d{2}T' THEN (data->>'last_sale_at')::timestamptz
              ELSE NULL
            END,
            created_date
          ) < now() - interval '2 months'
      )
      DELETE FROM nexo.records product
      USING candidates
      WHERE product.id=candidates.id
      RETURNING product.id
    `;
    const deleted = removed.length;
    if (deleted) {
      try {
        const auditData = {
          action_type: 'produtos_inativos_excluidos',
          entity_type: 'product',
          entity_id: null,
          user_id: user.id,
          user_name: user.full_name || user.email,
          description: `${deleted} produto(s) sem venda há 2 meses foram excluídos`,
          details: { deleted },
        };
        await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(${user.market_id},'general_audits',${JSON.stringify(auditData)}::jsonb)`;
      } catch (auditError) {
        console.error(
          'Falha ao auditar exclusão de produtos inativos:',
          auditError?.message,
        );
      }
    }
    return send(res, 200, { deleted });
  }

  if (path[0] === 'products' && path[1] === 'catalog') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    if (
      !user.market_id ||
      !['pdv', 'estoque'].some((module) =>
        (user.enabled_modules || []).includes(module),
      )
    )
      return send(res, 403, {
        message: 'Produtos não estão habilitados para o mercado.',
      });
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 1000, 3000));
    const rows = await sql`
      WITH sales_by_product AS (
        SELECT
          (item->>'product_id')::uuid AS product_id,
          SUM(CASE
            WHEN COALESCE(item->>'unit','') = 'peso' THEN COALESCE((item->>'weight')::numeric, 0)
            ELSE COALESCE((item->>'quantity')::numeric, 0)
          END) AS sold_quantity
        FROM nexo.records sale
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sale.data->'items','[]'::jsonb)) item
        WHERE sale.market_id=${user.market_id}
          AND sale.entity='sales'
          AND sale.data->>'status'='concluida'
          AND item ? 'product_id'
        GROUP BY 1
      )
      SELECT id, data - 'image_url' AS data,
        COALESCE(data->>'image_url','') <> '' AS has_image,
        CASE WHEN COALESCE(data->>'image_url','') LIKE 'data:image/%' THEN true ELSE false END AS image_is_inline,
        CASE WHEN COALESCE(data->>'image_url','') ~ '^https://' THEN data->>'image_url' ELSE '' END AS remote_image_url,
        COALESCE(sales_by_product.sold_quantity, 0) AS sales_count,
        created_date, updated_date
      FROM nexo.records
      LEFT JOIN sales_by_product ON sales_by_product.product_id = nexo.records.id
      WHERE market_id=${user.market_id} AND entity='products'
      ORDER BY updated_date DESC
      LIMIT ${limit}
    `;
    const products = rows.map((row) => ({
      id: row.id,
      ...(row.data || {}),
      image_url:
        row.remote_image_url ||
        (row.has_image
          ? `/api/product-media/${row.id}?v=${new Date(row.updated_date).getTime()}`
          : ''),
      image_is_inline: Boolean(row.image_is_inline),
      sales_count: Number(row.sales_count || 0),
      created_date: row.created_date,
      updated_date: row.updated_date,
    }));
    res.setHeader(
      'Cache-Control',
      'private, max-age=10, stale-while-revalidate=30',
    );
    return send(res, 200, products);
  }

  if (path[0] === 'product-media' && path[1]) {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    if (
      user.role !== 'super_admin' &&
      !['pdv', 'estoque'].some((module) =>
        (user.enabled_modules || []).includes(module),
      )
    )
      return send(res, 403, {
        message: 'Produtos não estão habilitados para o mercado.',
      });
    if (!isUuid(path[1]) || !user.market_id)
      return send(res, 404, { message: 'Imagem não encontrada.' });
    const [row] =
      await sql`SELECT data->>'image_url' AS image_url, updated_date FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='products'`;
    const image = String(row?.image_url || '');
    if (!image) return send(res, 404, { message: 'Imagem não encontrada.' });
    if (/^https:\/\//i.test(image)) {
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Location', image);
      return res.status(302).end();
    }
    const match = image.match(
      /^data:image\/(jpeg|png|webp|avif);base64,(.+)$/i,
    );
    if (!match) return send(res, 404, { message: 'Imagem inválida.' });
    const mime =
      match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length) return send(res, 404, { message: 'Imagem vazia.' });
    res.setHeader('Content-Type', `image/${mime}`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader(
      'Cache-Control',
      'private, max-age=86400, stale-while-revalidate=604800',
    );
    res.setHeader(
      'ETag',
      `"${path[1]}-${new Date(row.updated_date).getTime()}"`,
    );
    return res.status(200).send(buffer);
  }

  if (path[0] === 'cash') {
    if (!user.market_id)
      return send(res, 400, { message: 'Usuário sem mercado vinculado.' });

    if (path[1] === 'history' && req.method === 'GET') {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.max(
        10,
        Math.min(Number.parseInt(req.query.page_size, 10) || 20, 100),
      );
      const offset = (page - 1) * pageSize;
      const from = parseDateQuery(req.query.from);
      const to = parseDateQuery(req.query.to);
      const sellerId =
        user.role === 'vendedor' ? user.id : text(req.query.operator_id, 64);
      const status = text(req.query.status, 30);
      const unitId = text(req.query.unit_id, 64);
      const rows = await sql`
        SELECT id,data,created_date,updated_date,count(*) OVER()::int AS total_count
        FROM nexo.records
        WHERE market_id=${user.market_id} AND entity='cash_sessions'
          AND (${from === null} OR COALESCE(NULLIF(data->>'opened_at','')::timestamptz,created_date) >= ${from})
          AND (${to === null} OR COALESCE(NULLIF(data->>'opened_at','')::timestamptz,created_date) < ${to})
          AND (${sellerId === ''} OR data->>'seller_id'=${sellerId})
          AND (${status === ''} OR data->>'status'=${status})
          AND (${unitId === ''} OR data->>'unit_id'=${unitId})
        ORDER BY COALESCE(NULLIF(data->>'opened_at','')::timestamptz,created_date) DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      const items = [];
      for (const row of rows) {
        const session = recordFromRow(row);
        const summary =
          session.status === 'aberto'
            ? await getCashSessionSummary(sql, user.market_id, session)
            : session.summary || {};
        items.push({
          ...session,
          summary,
          total_sales: Number(summary.total || 0),
          entries: Number(summary.entries || 0),
          withdrawals: Number(summary.withdrawals || 0),
          payments: summary.payments || {},
          final_amount: session.closing_amount ?? summary.expected_cash ?? 0,
        });
      }
      const [operatorRows, unitRows] = await Promise.all([
        user.role === 'vendedor'
          ? [{ id: user.id, name: user.full_name || user.email }]
          : sql`SELECT id,COALESCE(full_name,email) AS name FROM nexo.users WHERE market_id=${user.market_id} ORDER BY COALESCE(full_name,email)`,
        sql`SELECT id,name,code,active FROM nexo.market_units WHERE market_id=${user.market_id} ORDER BY name`,
      ]);
      const total = Number(rows[0]?.total_count || 0);
      return send(res, 200, {
        items,
        page,
        page_size: pageSize,
        total,
        page_count: Math.max(1, Math.ceil(total / pageSize)),
        operators: operatorRows,
        units: unitRows,
      });
    }

    if (isUuid(path[1]) && !path[2] && req.method === 'GET') {
      const [row] =
        await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='cash_sessions' AND (${user.role !== 'vendedor'} OR data->>'seller_id'=${user.id})`;
      if (!row)
        return send(res, 404, {
          message: 'Caixa não encontrado ou sem permissão.',
        });
      const session = recordFromRow(row);
      return send(res, 200, {
        session,
        summary: await getCashSessionSummary(sql, user.market_id, session),
      });
    }

    if (isUuid(path[1]) && path[2] === 'movements') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      const type = text(req.body.type, 20);
      const amount = roundMoney(Number(req.body.amount));
      const note = text(req.body.note, 500);
      if (!['entrada', 'retirada'].includes(type))
        return send(res, 400, { message: 'Selecione entrada ou retirada.' });
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000)
        return send(res, 400, {
          message: 'Informe um valor de movimentação válido.',
        });
      const [sessionRow] =
        await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='cash_sessions' AND data->>'status'='aberto' AND data->>'seller_id'=${user.id}`;
      if (!sessionRow)
        return send(res, 409, {
          message:
            'Somente o operador responsável pode movimentar o próprio caixa aberto.',
        });
      const payload = {
        cash_session_id: path[1],
        type,
        amount,
        note,
        operator_id: user.id,
        operator_name: user.full_name || user.email,
        created_at: new Date().toISOString(),
      };
      const [movement] =
        await sql`WITH movement AS (INSERT INTO nexo.records(market_id,entity,data) VALUES(${user.market_id},'cash_movements',${JSON.stringify(payload)}::jsonb) RETURNING id,data,created_date,updated_date),audit AS (INSERT INTO nexo.records(market_id,entity,data) SELECT ${user.market_id},'general_audits',jsonb_build_object('action_type','movimentacao_caixa','entity_type','cash_session','entity_id',${path[1]}::uuid,'user_id',${user.id}::uuid,'user_name',${user.full_name || user.email}::text,'description',${type === 'entrada' ? 'Entrada registrada no caixa' : 'Retirada registrada no caixa'}::text,'details',${JSON.stringify({ type, amount, note })}::jsonb) FROM movement) SELECT * FROM movement`;
      const session = recordFromRow(sessionRow);
      return send(res, 201, {
        movement: recordFromRow(movement),
        summary: await getCashSessionSummary(sql, user.market_id, session),
      });
    }

    if (path[1] === 'logs' && req.method === 'GET') {
      const rows = await sql`
        SELECT log.id,log.action,log.details,log.created_date,market.name AS market_name,COALESCE(actor.full_name,actor.email,'Sistema') AS actor_name,'administração' AS source
        FROM nexo.market_change_log log
        JOIN nexo.markets market ON market.id=log.market_id
        LEFT JOIN nexo.users actor ON actor.id=log.actor_id
        UNION ALL
        SELECT audit.id,COALESCE(audit.data->>'action_type','evento'),audit.data->'details',audit.created_date,market.name,COALESCE(audit.data->>'user_name','Sistema'),'mercadinho'
        FROM nexo.records audit JOIN nexo.markets market ON market.id=audit.market_id
        WHERE audit.entity='general_audits'
        ORDER BY created_date DESC LIMIT 200
      `;
      return send(res, 200, rows);
    }

    if (path[1] === 'settings') {
      if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
      if (user.role !== 'admin')
        return send(res, 403, {
          message:
            'Apenas administradores podem alterar a exigência de abertura de caixa.',
        });
      if (typeof req.body.require_cash_register !== 'boolean')
        return send(res, 400, {
          message: 'Informe se a abertura de caixa deve ser obrigatória.',
        });
      const [market] = await sql`
        UPDATE nexo.markets
        SET require_cash_register=${req.body.require_cash_register}, updated_date=now()
        WHERE id=${user.market_id}
        RETURNING require_cash_register
      `;
      return send(res, 200, {
        require_cash_register: Boolean(market?.require_cash_register),
      });
    }

    if (path[1] === 'current') {
      if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
      const session = await findOpenCashSession(sql, user.market_id, user.id);
      const summary = session
        ? await getCashSessionSummary(sql, user.market_id, session)
        : null;
      return send(res, 200, {
        required:
          user.role === 'vendedor' && Boolean(user.require_cash_register),
        market_requires_cash: Boolean(user.require_cash_register),
        session,
        summary,
      });
    }

    if (path[1] === 'open') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      if (!['vendedor', 'gerente', 'admin'].includes(user.role))
        return send(res, 403, {
          message: 'Este perfil não pode abrir um caixa.',
        });
      const openingAmount = roundMoney(Number(req.body.opening_amount));
      if (
        !Number.isFinite(openingAmount) ||
        openingAmount < 0 ||
        openingAmount > 10_000_000
      )
        return send(res, 400, { message: 'Informe um valor inicial válido.' });
      const current = await findOpenCashSession(sql, user.market_id, user.id);
      if (current)
        return send(res, 409, {
          message: 'Já existe um caixa aberto para este usuário.',
          session: current,
        });
      const payload = {
        seller_id: user.id,
        seller_name: user.full_name || user.email,
        status: 'aberto',
        opening_amount: openingAmount,
        opened_at: new Date().toISOString(),
        unit_id: user.unit_id || null,
        unit_name: user.unit_name || 'Unidade principal',
      };
      const [row] = await sql`
        INSERT INTO nexo.records(market_id,entity,data)
        VALUES(${user.market_id},'cash_sessions',${JSON.stringify(payload)}::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING id,data,created_date,updated_date
      `;
      if (!row)
        return send(res, 409, {
          message:
            'Já existe um caixa aberto para este usuário. Atualize a página.',
        });
      const session = recordFromRow(row);
      await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(
        ${user.market_id},'general_audits',${JSON.stringify({
          action_type: 'caixa_aberto',
          entity_type: 'cash_session',
          entity_id: session.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          description: `Caixa aberto com ${openingAmount.toFixed(2)}`,
          details: { opening_amount: openingAmount },
        })}::jsonb
      )`;
      return send(res, 201, {
        session,
        summary: await getCashSessionSummary(sql, user.market_id, session),
      });
    }

    if (path[1] === 'close') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      const session = await findOpenCashSession(sql, user.market_id, user.id);
      if (!session)
        return send(res, 409, {
          message: 'Não existe caixa aberto para este usuário.',
        });
      const summary = await getCashSessionSummary(sql, user.market_id, session);
      const closingAmount =
        req.body.closing_amount === '' ||
        req.body.closing_amount === undefined ||
        req.body.closing_amount === null
          ? null
          : roundMoney(Number(req.body.closing_amount));
      if (
        closingAmount !== null &&
        (!Number.isFinite(closingAmount) ||
          closingAmount < 0 ||
          closingAmount > 10_000_000)
      )
        return send(res, 400, {
          message: 'Informe um valor de fechamento válido.',
        });
      const closedAt = new Date().toISOString();
      const {
        sales: cashSalesDetail,
        movements: cashMovementsDetail,
        filters: cashFilters,
        ...summarySnapshot
      } = summary;
      const update = {
        status: 'fechado',
        closed_at: closedAt,
        closing_amount: closingAmount,
        difference:
          closingAmount === null
            ? null
            : roundMoney(closingAmount - Number(summary.expected_cash || 0)),
        summary: summarySnapshot,
      };
      const [row] = await sql`
        UPDATE nexo.records
        SET data=data || ${JSON.stringify(update)}::jsonb, updated_date=now()
        WHERE id=${session.id} AND market_id=${user.market_id} AND entity='cash_sessions' AND data->>'status'='aberto'
        RETURNING id,data,created_date,updated_date
      `;
      if (!row)
        return send(res, 409, {
          message: 'O caixa já foi fechado em outra tela.',
        });
      await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(
        ${user.market_id},'general_audits',${JSON.stringify({
          action_type: 'caixa_fechado',
          entity_type: 'cash_session',
          entity_id: session.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          description: `Caixa fechado com ${summary.sales_count} venda(s)`,
          details: {
            ...summarySnapshot,
            closing_amount: closingAmount,
            difference: update.difference,
          },
        })}::jsonb
      )`;
      return send(res, 200, {
        session: recordFromRow(row),
        summary: {
          ...summary,
          sales: cashSalesDetail,
          movements: cashMovementsDetail,
          filters: { ...(cashFilters || {}), to: closedAt },
          closing_amount: closingAmount,
          difference: update.difference,
        },
      });
    }

    return send(res, 404, { message: 'Operação de caixa não encontrada.' });
  }

  if (path[0] === 'maintenance' && path[1] === 'reset') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (user.role !== 'admin')
      return send(res, 403, {
        message: 'Apenas administradores podem zerar dados do mercado.',
      });
    if (!user.market_id)
      return send(res, 400, { message: 'Usuário sem mercado vinculado.' });
    if (
      String(req.body.confirmation || '')
        .trim()
        .toUpperCase() !== 'ZERAR'
    ) {
      return send(res, 400, {
        message: 'Digite ZERAR para confirmar a operação.',
      });
    }

    const target = String(req.body.target || '');
    const labels = {
      products: 'estoque',
      fiados: 'vendas fiadas',
      sales: 'histórico de vendas',
      audits: 'auditoria',
      cash: 'histórico de caixas',
      operational: 'dados operacionais',
    };
    if (!labels[target])
      return send(res, 400, {
        message: 'Selecione uma área válida para zerar.',
      });

    let result;
    if (target === 'products') {
      [result] = await sql`WITH products AS (
        DELETE FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' RETURNING 1
      ), product_audits AS (
        DELETE FROM nexo.records WHERE market_id=${user.market_id} AND entity='product_audits' RETURNING 1
      ) SELECT (SELECT count(*)::int FROM products) AS products, (SELECT count(*)::int FROM product_audits) AS product_audits`;
    } else if (target === 'fiados') {
      [result] = await sql`WITH removed AS (
        DELETE FROM nexo.records WHERE market_id=${user.market_id} AND entity='fiado_records' RETURNING 1
      ) SELECT count(*)::int AS fiados FROM removed`;
    } else if (target === 'sales') {
      [result] = await sql`WITH removed AS (
        DELETE FROM nexo.records WHERE market_id=${user.market_id} AND entity='sales' RETURNING 1
      ) SELECT count(*)::int AS sales FROM removed`;
    } else if (target === 'audits') {
      [result] = await sql`WITH general_audits AS (
        DELETE FROM nexo.records WHERE market_id=${user.market_id} AND entity='general_audits' RETURNING 1
      ), product_audits AS (
        DELETE FROM nexo.records WHERE market_id=${user.market_id} AND entity='product_audits' RETURNING 1
      ) SELECT (SELECT count(*)::int FROM general_audits) AS general_audits, (SELECT count(*)::int FROM product_audits) AS product_audits`;
    } else if (target === 'cash') {
      const [openState] =
        await sql`SELECT count(*)::int AS count FROM nexo.records WHERE market_id=${user.market_id} AND entity='cash_sessions' AND data->>'status'='aberto'`;
      if (Number(openState?.count || 0) > 0)
        return send(res, 409, {
          message:
            'Feche todos os caixas abertos antes de limpar o histórico de caixas.',
        });
      [result] = await sql`WITH removed AS (
        DELETE FROM nexo.records WHERE market_id=${user.market_id} AND entity=ANY(ARRAY['cash_sessions','cash_movements']) RETURNING 1
      ) SELECT count(*)::int AS cash_sessions FROM removed`;
    } else {
      const [openState] =
        await sql`SELECT count(*)::int AS count FROM nexo.records WHERE market_id=${user.market_id} AND entity='cash_sessions' AND data->>'status'='aberto'`;
      if (Number(openState?.count || 0) > 0)
        return send(res, 409, {
          message:
            'Feche todos os caixas abertos antes de zerar os dados operacionais.',
        });
      [result] = await sql`WITH removed AS (
        DELETE FROM nexo.records
        WHERE market_id=${user.market_id}
          AND entity=ANY(ARRAY['products','sales','fiado_records','cash_sessions','cash_movements','general_audits','product_audits'])
        RETURNING entity
      ), counter AS (
        UPDATE nexo.markets SET next_sale_number=1,updated_date=now() WHERE id=${user.market_id}
      ) SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE entity='products')::int AS products,
        count(*) FILTER (WHERE entity='sales')::int AS sales,
        count(*) FILTER (WHERE entity='fiado_records')::int AS fiados,
        count(*) FILTER (WHERE entity='cash_sessions')::int AS cash_sessions,
        count(*) FILTER (WHERE entity IN ('general_audits','product_audits'))::int AS audits
      FROM removed`;
    }

    if (!['audits', 'operational'].includes(target)) {
      await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(
        ${user.market_id},
        'general_audits',
        ${JSON.stringify({
          action_type: 'dados_zerados',
          entity_type: 'maintenance',
          entity_id: null,
          user_id: user.id,
          user_name: user.full_name || user.email,
          description: `Dados de ${labels[target]} zerados nas configurações`,
          details: { target },
        })}::jsonb
      )`;
    }

    return send(res, 200, {
      ok: true,
      target,
      label: labels[target],
      deleted: result || {},
    });
  }

  if (path[0] === 'admin') {
    if (user.role !== 'super_admin')
      return send(res, 403, { message: 'Acesso restrito ao Super Admin.' });

    if (path[1] === 'logs' && req.method === 'GET') {
      const rows = await sql`
        SELECT log.id,log.action,log.details,log.created_date,market.name AS market_name,COALESCE(actor.full_name,actor.email,'Sistema') AS actor_name,'administração' AS source
        FROM nexo.market_change_log log
        JOIN nexo.markets market ON market.id=log.market_id
        LEFT JOIN nexo.users actor ON actor.id=log.actor_id
        UNION ALL
        SELECT audit.id,COALESCE(audit.data->>'action_type','evento'),audit.data->'details',audit.created_date,market.name,COALESCE(audit.data->>'user_name','Sistema'),'mercadinho'
        FROM nexo.records audit JOIN nexo.markets market ON market.id=audit.market_id
        WHERE audit.entity='general_audits'
        ORDER BY created_date DESC LIMIT 200
      `;
      return send(res, 200, rows);
    }

    if (path[1] === 'overview' && req.method === 'GET') {
      const [metrics, marketGrowth] = await Promise.all([
        sql`SELECT
          (SELECT count(*)::int FROM nexo.markets) AS total_markets,
          (SELECT count(*)::int FROM nexo.markets WHERE status='ativo') AS active_markets,
          (SELECT count(*)::int FROM nexo.markets WHERE status='suspenso') AS suspended_markets,
          (SELECT count(*)::int FROM nexo.markets WHERE status='teste') AS trial_markets,
          (SELECT count(*)::int FROM nexo.users WHERE role<>'super_admin' AND active) AS total_users,
          (SELECT count(*)::int FROM nexo.users WHERE role<>'super_admin' AND active AND last_login_at>=now()-interval '30 days') AS active_users,
          (SELECT count(*)::int FROM nexo.markets WHERE created_date>=now()-interval '30 days') AS new_markets,
          (SELECT count(*)::int FROM nexo.subscriptions WHERE cancelled_at>=now()-interval '30 days') AS cancellations,
          (SELECT COALESCE(sum(monthly_price),0)::numeric FROM nexo.subscriptions WHERE status IN ('ativa','teste')) AS estimated_revenue,
          (SELECT count(*)::int FROM nexo.records WHERE entity='sales' AND data->>'status'='concluida') AS processed_sales,
          (SELECT COALESCE(sum((data->>'total')::numeric),0)::numeric FROM nexo.records WHERE entity='sales' AND data->>'status'='concluida' AND data->>'total' ~ '^[0-9]+(\\.[0-9]+)?$') AS processed_volume,
          (SELECT count(*)::int FROM nexo.records WHERE entity='products') AS products,
          (SELECT count(*)::int FROM nexo.plans WHERE active) AS active_plans`,
        sql`WITH months AS (SELECT generate_series(date_trunc('month',now())-interval '11 months',date_trunc('month',now()),interval '1 month') AS month) SELECT to_char(month,'YYYY-MM') AS month,count(market.id)::int AS markets FROM months LEFT JOIN nexo.markets market ON date_trunc('month',market.created_date)=months.month GROUP BY month ORDER BY month`,
      ]);
      return send(res, 200, {
        metrics: {
          ...metrics[0],
          estimated_revenue: Number(metrics[0]?.estimated_revenue || 0),
          processed_volume: Number(metrics[0]?.processed_volume || 0),
        },
        market_growth: marketGrowth,
      });
    }

    if (path[1] === 'plans') {
      if (req.method === 'GET') {
        const plans =
          await sql`SELECT plan.*,(SELECT count(*)::int FROM nexo.subscriptions subscription WHERE subscription.plan_id=plan.id AND subscription.status IN ('teste','ativa','inadimplente','suspensa')) AS subscription_count,(SELECT count(*)::int FROM nexo.subscriptions subscription WHERE subscription.plan_id=plan.id) AS total_subscription_count,(SELECT count(*)::int FROM nexo.markets market WHERE market.plan_id=plan.id) AS market_count FROM nexo.plans plan ORDER BY plan.active DESC,plan.monthly_price,plan.name`;
        return send(
          res,
          200,
          plans.map((plan) => ({
            ...plan,
            monthly_price: Number(plan.monthly_price),
          })),
        );
      }
      const planId = path[2];
      if (!['POST', 'PATCH', 'DELETE'].includes(req.method))
        return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
      if (req.method !== 'POST' && !isUuid(planId))
        return send(res, 400, { message: 'Plano inválido.' });
      if (req.method === 'DELETE') {
        const [usage] =
          await sql`SELECT (SELECT count(*)::int FROM nexo.subscriptions WHERE plan_id=${planId}) AS subscriptions,(SELECT count(*)::int FROM nexo.markets WHERE plan_id=${planId}) AS markets`;
        if (
          Number(usage?.subscriptions || 0) > 0 ||
          Number(usage?.markets || 0) > 0
        )
          return send(res, 409, {
            code: 'PLAN_IN_USE',
            message:
              'Este plano possui histórico ou mercadinhos vinculados. Desative-o para impedir novas contratações.',
          });
        const [removed] =
          await sql`DELETE FROM nexo.plans WHERE id=${planId} RETURNING id,name`;
        return send(
          res,
          removed ? 200 : 404,
          removed
            ? { ok: true, plan: removed }
            : { message: 'Plano não encontrado.' },
        );
      }
      const source = req.body || {};
      const name = text(source.name, 120);
      const description = text(source.description, 1000);
      const monthlyPrice = Number(source.monthly_price);
      const trialDays = Number.parseInt(source.trial_days, 10) || 0;
      const modules = Array.isArray(source.enabled_modules)
        ? source.enabled_modules
        : [];
      const features = Array.isArray(source.enabled_features)
        ? source.enabled_features
        : [];
      if (
        !name ||
        !Number.isFinite(monthlyPrice) ||
        monthlyPrice < 0 ||
        trialDays < 0 ||
        trialDays > 365
      )
        return send(res, 400, {
          message: 'Revise nome, preço e período de teste do plano.',
        });
      if (modules.some((module) => !MARKET_MODULES.includes(module)))
        return send(res, 400, {
          message: 'O plano contém funcionalidades inválidas.',
        });
      if (features.some((feature) => !MARKET_FEATURES.includes(feature)))
        return send(res, 400, {
          message: 'O plano contém recursos inválidos.',
        });
      if (source.active !== false && !modules.length)
        return send(res, 400, {
          message:
            'Um plano ativo deve oferecer pelo menos uma funcionalidade.',
        });
      const limit = (value) =>
        value === '' || value === null || value === undefined
          ? null
          : Math.max(1, Number.parseInt(value, 10) || 1);
      const values = {
        name,
        description,
        monthlyPrice: roundMoney(monthlyPrice),
        trialDays,
        userLimit: limit(source.user_limit),
        productLimit: limit(source.product_limit),
        unitLimit: limit(source.unit_limit),
        modules,
        features,
        active: source.active !== false,
      };
      if (req.method === 'POST') {
        const [plan] =
          await sql`INSERT INTO nexo.plans(name,description,monthly_price,trial_days,user_limit,product_limit,unit_limit,enabled_modules,enabled_features,active) VALUES(${values.name},${values.description},${values.monthlyPrice},${values.trialDays},${values.userLimit},${values.productLimit},${values.unitLimit},${JSON.stringify(values.modules)}::jsonb,${JSON.stringify(values.features)}::jsonb,${values.active}) RETURNING *`;
        return send(res, 201, {
          ...plan,
          monthly_price: Number(plan.monthly_price),
        });
      }
      const [plan] =
        await sql`UPDATE nexo.plans SET name=${values.name},description=${values.description},monthly_price=${values.monthlyPrice},trial_days=${values.trialDays},user_limit=${values.userLimit},product_limit=${values.productLimit},unit_limit=${values.unitLimit},enabled_modules=${JSON.stringify(values.modules)}::jsonb,enabled_features=${JSON.stringify(values.features)}::jsonb,active=${values.active},updated_date=now() WHERE id=${planId} RETURNING *`;
      return send(
        res,
        plan ? 200 : 404,
        plan
          ? { ...plan, monthly_price: Number(plan.monthly_price) }
          : { message: 'Plano não encontrado.' },
      );
    }

    if (path[1] === 'subscriptions') {
      if (req.method === 'GET') {
        const rows =
          await sql`SELECT subscription.*,market.name AS market_name,plan.name AS plan_name FROM nexo.subscriptions subscription JOIN nexo.markets market ON market.id=subscription.market_id LEFT JOIN nexo.plans plan ON plan.id=subscription.plan_id ORDER BY subscription.updated_date DESC`;
        return send(
          res,
          200,
          rows.map((row) => ({
            ...row,
            monthly_price: Number(row.monthly_price),
          })),
        );
      }
      if (req.method !== 'PATCH' || !isUuid(path[2]))
        return methodNotAllowed(res, ['GET', 'PATCH']);
      const status = text(req.body.status, 30);
      if (
        !['teste', 'ativa', 'inadimplente', 'cancelada', 'suspensa'].includes(
          status,
        )
      )
        return send(res, 400, { message: 'Status de assinatura inválido.' });
      const reason = text(req.body.cancellation_reason, 500);
      const [subscription] =
        await sql`UPDATE nexo.subscriptions SET status=${status},cancelled_at=CASE WHEN ${status}='cancelada' THEN now() ELSE NULL END,cancellation_reason=CASE WHEN ${status}='cancelada' THEN ${reason} ELSE NULL END,updated_date=now() WHERE id=${path[2]} RETURNING *`;
      if (!subscription)
        return send(res, 404, { message: 'Assinatura não encontrada.' });
      const marketStatus =
        status === 'cancelada'
          ? 'cancelado'
          : status === 'suspensa' || status === 'inadimplente'
            ? 'suspenso'
            : status === 'teste'
              ? 'teste'
              : 'ativo';
      await sql`WITH changed AS (UPDATE nexo.markets SET status=${marketStatus},active=${!['cancelado', 'suspenso'].includes(marketStatus)},updated_date=now() WHERE id=${subscription.market_id} RETURNING id) INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'assinatura_atualizada',${JSON.stringify({ status, reason })}::jsonb FROM changed`;
      return send(res, 200, {
        ...subscription,
        monthly_price: Number(subscription.monthly_price),
      });
    }

    if (path[1] === 'payments') {
      if (req.method === 'GET') {
        const subscriptionId = text(req.query.subscription_id, 64);
        const rows =
          await sql`SELECT payment.*,market.name AS market_name,plan.name AS plan_name FROM nexo.subscription_payments payment JOIN nexo.subscriptions subscription ON subscription.id=payment.subscription_id JOIN nexo.markets market ON market.id=subscription.market_id LEFT JOIN nexo.plans plan ON plan.id=subscription.plan_id WHERE (${subscriptionId === ''} OR payment.subscription_id::text=${subscriptionId}) ORDER BY payment.due_date DESC LIMIT 1000`;
        return send(
          res,
          200,
          rows.map((row) => ({ ...row, amount: Number(row.amount) })),
        );
      }
      if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
      if (!isUuid(req.body.subscription_id))
        return send(res, 400, { message: 'Assinatura inválida.' });
      const amount = roundMoney(Number(req.body.amount));
      const dueDate = parseDateQuery(req.body.due_date);
      const paymentStatus = [
        'pendente',
        'pago',
        'vencido',
        'estornado',
      ].includes(req.body.status)
        ? req.body.status
        : 'pendente';
      if (!Number.isFinite(amount) || amount < 0 || !dueDate)
        return send(res, 400, {
          message: 'Informe valor e vencimento válidos.',
        });
      const [payment] =
        await sql`INSERT INTO nexo.subscription_payments(subscription_id,amount,due_date,paid_at,status,notes) VALUES(${req.body.subscription_id},${amount},${dueDate.toISOString().slice(0, 10)},${paymentStatus === 'pago' ? new Date() : null},${paymentStatus},${text(req.body.notes, 500)}) RETURNING *`;
      return send(res, 201, { ...payment, amount: Number(payment.amount) });
    }

    if (path[1] === 'reports' && req.method === 'GET') {
      const from = parseDateQuery(
        req.query.from,
        new Date(Date.now() - 365 * 86_400_000),
      );
      const to = parseDateQuery(req.query.to, new Date());
      const [growth, revenue, cancellations, usage] = await Promise.all([
        sql`SELECT to_char(date_trunc('month',created_date),'YYYY-MM') AS period,count(*)::int AS new_markets FROM nexo.markets WHERE created_date>=${from} AND created_date<${to} GROUP BY 1 ORDER BY 1`,
        sql`SELECT COALESCE(plan.name,'Sem plano') AS plan,count(subscription.id)::int AS subscriptions,COALESCE(sum(subscription.monthly_price),0)::numeric AS revenue FROM nexo.subscriptions subscription LEFT JOIN nexo.plans plan ON plan.id=subscription.plan_id WHERE subscription.status IN ('ativa','teste') GROUP BY plan.name ORDER BY revenue DESC`,
        sql`SELECT to_char(date_trunc('month',cancelled_at),'YYYY-MM') AS period,count(*)::int AS cancellations FROM nexo.subscriptions WHERE cancelled_at>=${from} AND cancelled_at<${to} GROUP BY 1 ORDER BY 1`,
        sql`SELECT market.id,market.name,count(DISTINCT sale.id)::int AS sales,count(DISTINCT product.id)::int AS products,count(DISTINCT active_user.id)::int AS active_users,COALESCE(sum(CASE WHEN sale.data->>'total' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (sale.data->>'total')::numeric ELSE 0 END),0)::numeric AS sales_volume FROM nexo.markets market LEFT JOIN nexo.records sale ON sale.market_id=market.id AND sale.entity='sales' AND sale.data->>'status'='concluida' AND sale.created_date>=${from} AND sale.created_date<${to} LEFT JOIN nexo.records product ON product.market_id=market.id AND product.entity='products' LEFT JOIN nexo.users active_user ON active_user.market_id=market.id AND active_user.active AND active_user.last_login_at>=${from} AND active_user.last_login_at<${to} GROUP BY market.id,market.name ORDER BY sales DESC`,
      ]);
      return send(res, 200, {
        growth,
        revenue: revenue.map((row) => ({
          ...row,
          revenue: Number(row.revenue),
        })),
        cancellations,
        usage: usage.map((row) => ({
          ...row,
          sales_volume: Number(row.sales_volume),
        })),
      });
    }

    if (path[1] === 'settings') {
      const allowed = new Set([
        'email_provider',
        'email_from_name',
        'notification_defaults',
        'plan_enforcement',
        'global_user_limit',
        'global_product_limit',
        'global_unit_limit',
        'security_session_hours',
        'security_login_attempts',
        'integrations',
        'maintenance_mode',
        'maintenance_message',
        'platform_notice',
      ]);
      if (req.method === 'GET') {
        const rows =
          await sql`SELECT key,value,updated_date FROM nexo.platform_settings ORDER BY key`;
        return send(
          res,
          200,
          Object.fromEntries(
            rows.map((row) => [
              row.key,
              { value: row.value, updated_date: row.updated_date },
            ]),
          ),
        );
      }
      if (req.method !== 'PATCH')
        return methodNotAllowed(res, ['GET', 'PATCH']);
      const entries = Object.entries(req.body || {}).filter(([key]) =>
        allowed.has(key),
      );
      if (!entries.length)
        return send(res, 400, {
          message: 'Nenhuma configuração válida foi informada.',
        });
      for (const [key, value] of entries)
        await sql`INSERT INTO nexo.platform_settings(key,value,updated_by) VALUES(${key},${JSON.stringify(value)}::jsonb,${user.id}) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_date=now()`;
      return send(res, 200, { ok: true, updated: entries.length });
    }

    return send(res, 404, { message: 'Área administrativa não encontrada.' });
  }

  if (path[0] === 'markets') {
    if (user.role !== 'super_admin')
      return send(res, 403, { message: 'Acesso restrito.' });
    if (req.method === 'GET' && isUuid(path[1])) {
      const [marketRows, units, history, subscriptions, payments] =
        await Promise.all([
          sql`SELECT market.*,plan.name AS plan_name,plan.monthly_price AS plan_price,(SELECT count(*)::int FROM nexo.users WHERE market_id=market.id AND active) AS user_count,(SELECT count(*)::int FROM nexo.records WHERE market_id=market.id AND entity='products') AS product_count,(SELECT count(*)::int FROM nexo.records WHERE market_id=market.id AND entity='sales') AS sale_count FROM nexo.markets market LEFT JOIN nexo.plans plan ON plan.id=market.plan_id WHERE market.id=${path[1]}`,
          sql`SELECT id,name,code,active,created_date FROM nexo.market_units WHERE market_id=${path[1]} ORDER BY name`,
          sql`SELECT log.*,COALESCE(actor.full_name,actor.email,'Sistema') AS actor_name FROM nexo.market_change_log log LEFT JOIN nexo.users actor ON actor.id=log.actor_id WHERE log.market_id=${path[1]} ORDER BY log.created_date DESC LIMIT 100`,
          sql`SELECT subscription.*,plan.name AS plan_name FROM nexo.subscriptions subscription LEFT JOIN nexo.plans plan ON plan.id=subscription.plan_id WHERE subscription.market_id=${path[1]} ORDER BY subscription.created_date DESC`,
          sql`SELECT payment.* FROM nexo.subscription_payments payment JOIN nexo.subscriptions subscription ON subscription.id=payment.subscription_id WHERE subscription.market_id=${path[1]} ORDER BY payment.due_date DESC LIMIT 100`,
        ]);
      if (!marketRows[0])
        return send(res, 404, { message: 'Mercadinho não encontrado.' });
      return send(res, 200, {
        market: {
          ...marketRows[0],
          plan_price: Number(marketRows[0].plan_price || 0),
        },
        units,
        history,
        subscriptions: subscriptions.map((item) => ({
          ...item,
          monthly_price: Number(item.monthly_price),
        })),
        payments: payments.map((item) => ({
          ...item,
          amount: Number(item.amount),
        })),
      });
    }
    if (req.method === 'GET')
      return send(
        res,
        200,
        await sql`SELECT market.id,market.name,market.slug,market.logo_url,market.primary_color,market.secondary_color,market.enabled_modules,market.enabled_features,market.require_cash_register,market.active,market.status,market.plan_id,plan.name AS plan_name,market.trial_ends_at,market.subscription_due_date,market.user_limit,market.product_limit,market.unit_limit,market.created_date,(SELECT count(*)::int FROM nexo.users WHERE market_id=market.id AND active) AS user_count FROM nexo.markets market LEFT JOIN nexo.plans plan ON plan.id=market.plan_id ORDER BY market.name`,
      );
    if (req.method === 'POST') {
      const marketName = text(req.body.name, 120);
      const marketSlug = text(req.body.slug, 80);
      if (!marketName || !/^[a-z0-9-]+$/.test(marketSlug))
        return send(res, 400, { message: 'Nome ou identificador inválido.' });
      if (
        req.body.primary_color &&
        !/^#[0-9a-f]{6}$/i.test(req.body.primary_color)
      )
        return send(res, 400, { message: 'Cor principal inválida.' });
      if (
        req.body.secondary_color &&
        !/^#[0-9a-f]{6}$/i.test(req.body.secondary_color)
      )
        return send(res, 400, { message: 'Cor secundária inválida.' });
      if (
        !/^\S+@\S+\.\S+$/.test(req.body.admin_email || '') ||
        (req.body.admin_password || '').length < 8
      )
        return send(res, 400, { message: 'Email ou senha inicial inválidos.' });
      const hash = await bcrypt.hash(req.body.admin_password, 12);
      const logoUrl = normalizeImageValue(req.body.logo_url || '');
      const requestedPlanId = isUuid(req.body.plan_id)
        ? req.body.plan_id
        : null;
      const [selectedPlan] = requestedPlanId
        ? await sql`SELECT * FROM nexo.plans WHERE id=${requestedPlanId} AND active LIMIT 1`
        : [];
      if (requestedPlanId && !selectedPlan)
        return send(res, 409, {
          code: 'PLAN_INACTIVE',
          message: 'O plano selecionado está inativo ou não existe.',
        });
      const modules =
        selectedPlan?.enabled_modules ||
        req.body.enabled_modules ||
        MARKET_MODULES;
      const features =
        selectedPlan?.enabled_features ||
        req.body.enabled_features ||
        MARKET_FEATURES;
      if (
        !Array.isArray(modules) ||
        modules.some((module) => !MARKET_MODULES.includes(module))
      )
        return send(res, 400, { message: 'Módulos inválidos.' });
      if (
        !Array.isArray(features) ||
        features.some((feature) => !MARKET_FEATURES.includes(feature))
      )
        return send(res, 400, { message: 'Recursos inválidos.' });
      const requestedStatus = ['ativo', 'teste'].includes(req.body.status)
        ? req.body.status
        : 'teste';
      const adminEmail = String(req.body.admin_email).trim().toLowerCase();
      const adminName =
        String(req.body.admin_name || 'Administrador').trim() ||
        'Administrador';
      const [duplicate] = await sql`
        SELECT
          EXISTS(SELECT 1 FROM nexo.markets WHERE lower(slug)=lower(${marketSlug})) AS slug,
          EXISTS(SELECT 1 FROM nexo.users WHERE lower(email)=lower(${adminEmail})) AS email
      `;
      if (duplicate?.slug)
        return send(res, 409, {
          code: 'DUPLICATE_MARKET_SLUG',
          message: 'Já existe um mercado com este identificador.',
        });
      if (duplicate?.email)
        return send(res, 409, {
          code: 'DUPLICATE_ADMIN_EMAIL',
          message: 'Já existe um usuário com este e-mail.',
        });
      const [market] = selectedPlan
        ? await sql`WITH market AS (INSERT INTO nexo.markets(name,slug,logo_url,primary_color,secondary_color,enabled_modules,enabled_features,require_cash_register,status,plan_id,trial_ends_at,user_limit,product_limit,unit_limit) VALUES(${marketName},${marketSlug},${logoUrl},${req.body.primary_color || '#16a06a'},${req.body.secondary_color || '#0f5132'},${JSON.stringify(modules)}::jsonb,${JSON.stringify(features)}::jsonb,${Boolean(req.body.require_cash_register)},${requestedStatus},${selectedPlan.id},CASE WHEN ${requestedStatus}='teste' THEN now()+make_interval(days=>${selectedPlan.trial_days}::int) ELSE NULL END,${selectedPlan.user_limit},${selectedPlan.product_limit},${selectedPlan.unit_limit}) RETURNING *),unit AS (INSERT INTO nexo.market_units(market_id,name,code) SELECT id,'Unidade principal','principal' FROM market RETURNING id,market_id),admin AS (INSERT INTO nexo.users(market_id,unit_id,email,password_hash,full_name,role) SELECT market.id,unit.id,${adminEmail},${hash},${adminName}::text,'admin' FROM market JOIN unit ON unit.market_id=market.id),subscription AS (INSERT INTO nexo.subscriptions(market_id,plan_id,status,monthly_price,trial_ends_at,current_period_ends_at) SELECT market.id,${selectedPlan.id},CASE WHEN ${requestedStatus}='teste' THEN 'teste' ELSE 'ativa' END,${selectedPlan.monthly_price},CASE WHEN ${requestedStatus}='teste' THEN now()+make_interval(days=>${selectedPlan.trial_days}::int) ELSE NULL END,now()+interval '1 month' FROM market),log AS (INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'mercado_criado',jsonb_build_object('status',${requestedStatus}::text,'plan_id',${selectedPlan.id}::uuid) FROM market) SELECT * FROM market`
        : await sql`WITH market AS (INSERT INTO nexo.markets(name,slug,logo_url,primary_color,secondary_color,enabled_modules,enabled_features,require_cash_register,status,trial_ends_at,user_limit,product_limit,unit_limit) VALUES(${marketName},${marketSlug},${logoUrl},${req.body.primary_color || '#16a06a'},${req.body.secondary_color || '#0f5132'},${JSON.stringify(modules)}::jsonb,${JSON.stringify(features)}::jsonb,${Boolean(req.body.require_cash_register)},${requestedStatus},CASE WHEN ${requestedStatus}='teste' THEN now()+interval '14 days' ELSE NULL END,${req.body.user_limit || null},${req.body.product_limit || null},${req.body.unit_limit || null}) RETURNING *),unit AS (INSERT INTO nexo.market_units(market_id,name,code) SELECT id,'Unidade principal','principal' FROM market RETURNING id,market_id),admin AS (INSERT INTO nexo.users(market_id,unit_id,email,password_hash,full_name,role) SELECT market.id,unit.id,${adminEmail},${hash},${adminName}::text,'admin' FROM market JOIN unit ON unit.market_id=market.id),log AS (INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'mercado_criado',jsonb_build_object('status',${requestedStatus}::text) FROM market) SELECT * FROM market`;
      return send(res, 201, market);
    }
    if (req.method === 'PATCH') {
      const id = path[1],
        b = req.body;
      if (!isUuid(id)) return send(res, 400, { message: 'Mercado inválido.' });
      if (
        b.enabled_modules &&
        (!Array.isArray(b.enabled_modules) ||
          b.enabled_modules.some((module) => !MARKET_MODULES.includes(module)))
      )
        return send(res, 400, { message: 'Módulos inválidos.' });
      if (
        b.enabled_features &&
        (!Array.isArray(b.enabled_features) ||
          b.enabled_features.some(
            (feature) => !MARKET_FEATURES.includes(feature),
          ))
      )
        return send(res, 400, { message: 'Recursos inválidos.' });
      const updatedName = b.name === undefined ? null : text(b.name, 120);
      if (b.name !== undefined && !updatedName)
        return send(res, 400, { message: 'Nome do mercado é obrigatório.' });
      if (b.primary_color && !/^#[0-9a-f]{6}$/i.test(b.primary_color))
        return send(res, 400, { message: 'Cor principal inválida.' });
      if (b.secondary_color && !/^#[0-9a-f]{6}$/i.test(b.secondary_color))
        return send(res, 400, { message: 'Cor secundária inválida.' });
      const logoUrl =
        b.logo_url === undefined ? null : normalizeImageValue(b.logo_url);
      const status = ['ativo', 'suspenso', 'teste', 'cancelado'].includes(
        b.status,
      )
        ? b.status
        : typeof b.active === 'boolean'
          ? b.active
            ? 'ativo'
            : 'suspenso'
          : null;
      const planId =
        b.plan_id === null ? null : isUuid(b.plan_id) ? b.plan_id : undefined;
      const [selectedPlan] = planId
        ? await sql`SELECT * FROM nexo.plans WHERE id=${planId} AND active LIMIT 1`
        : [];
      if (planId && !selectedPlan)
        return send(res, 409, {
          code: 'PLAN_INACTIVE',
          message: 'O plano selecionado está inativo ou não existe.',
        });
      const modulesUpdate = selectedPlan?.enabled_modules || b.enabled_modules;
      const featuresUpdate =
        selectedPlan?.enabled_features || b.enabled_features;
      const [market] =
        await sql`WITH changed AS (UPDATE nexo.markets SET name=COALESCE(${updatedName},name),logo_url=COALESCE(${logoUrl},logo_url),primary_color=COALESCE(${b.primary_color || null},primary_color),secondary_color=COALESCE(${b.secondary_color || null},secondary_color),enabled_modules=COALESCE(${modulesUpdate ? JSON.stringify(modulesUpdate) : null}::jsonb,enabled_modules),enabled_features=COALESCE(${featuresUpdate ? JSON.stringify(featuresUpdate) : null}::jsonb,enabled_features),require_cash_register=COALESCE(${typeof b.require_cash_register === 'boolean' ? b.require_cash_register : null},require_cash_register),active=CASE WHEN ${status}::text IS NOT NULL THEN ${!['suspenso', 'cancelado'].includes(status)} ELSE COALESCE(${typeof b.active === 'boolean' ? b.active : null},active) END,status=COALESCE(${status},status),plan_id=CASE WHEN ${planId !== undefined} THEN ${planId || null}::uuid ELSE plan_id END,subscription_due_date=COALESCE(${b.subscription_due_date || null}::date,subscription_due_date),user_limit=CASE WHEN ${Boolean(planId)} THEN ${selectedPlan?.user_limit ?? null} ELSE COALESCE(${b.user_limit || null},user_limit) END,product_limit=CASE WHEN ${Boolean(planId)} THEN ${selectedPlan?.product_limit ?? null} ELSE COALESCE(${b.product_limit || null},product_limit) END,unit_limit=CASE WHEN ${Boolean(planId)} THEN ${selectedPlan?.unit_limit ?? null} ELSE COALESCE(${b.unit_limit || null},unit_limit) END,updated_date=now() WHERE id=${id} RETURNING *),log AS (INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'mercado_atualizado',jsonb_build_object('fields',${JSON.stringify(Object.keys(b || {}))}::jsonb) FROM changed) SELECT * FROM changed`;
      if (market && planId)
        await sql`WITH selected_plan AS (SELECT * FROM nexo.plans WHERE id=${planId} AND active),closed AS (UPDATE nexo.subscriptions SET status='cancelada',cancelled_at=now(),cancellation_reason='Troca de plano',updated_date=now() WHERE market_id=${id} AND status IN ('teste','ativa','inadimplente','suspensa')) INSERT INTO nexo.subscriptions(market_id,plan_id,status,monthly_price,current_period_ends_at) SELECT ${id},id,'ativa',monthly_price,now()+interval '1 month' FROM selected_plan`;
      if (market && status) {
        const subscriptionStatus =
          status === 'cancelado'
            ? 'cancelada'
            : status === 'suspenso'
              ? 'suspensa'
              : status === 'teste'
                ? 'teste'
                : 'ativa';
        await sql`UPDATE nexo.subscriptions SET status=${subscriptionStatus},cancelled_at=CASE WHEN ${subscriptionStatus}='cancelada' THEN now() ELSE NULL END,cancellation_reason=CASE WHEN ${subscriptionStatus}='cancelada' THEN 'Encerramento pelo Super Admin' ELSE NULL END,updated_date=now() WHERE market_id=${id} AND status IN ('teste','ativa','inadimplente','suspensa')`;
      }
      return send(
        res,
        market ? 200 : 404,
        market || { message: 'Mercado não encontrado.' },
      );
    }
    if (req.method === 'DELETE') {
      const id = path[1];
      if (!isUuid(id))
        return send(res, 400, { message: 'Mercadinho inválido.' });
      const reason =
        text(req.body.reason, 500) || 'Encerramento pelo Super Admin';
      const [market] =
        await sql`WITH changed AS (UPDATE nexo.markets SET active=false,status='cancelado',updated_date=now() WHERE id=${id} AND status<>'cancelado' RETURNING *),subscriptions AS (UPDATE nexo.subscriptions SET status='cancelada',cancelled_at=now(),cancellation_reason=${reason},updated_date=now() WHERE market_id=${id} AND status IN ('teste','ativa','inadimplente','suspensa')),log AS (INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'mercado_encerrado',jsonb_build_object('reason',${reason}) FROM changed) SELECT * FROM changed`;
      return send(
        res,
        market ? 200 : 404,
        market || { message: 'Mercadinho não encontrado ou já encerrado.' },
      );
    }
  }
  if (path[0] === 'users' && req.method === 'POST') {
    if (!['admin', 'super_admin', 'gerente'].includes(user.role))
      return send(res, 403, { message: 'Sem permissão.' });
    if (!user.market_id)
      return send(res, 400, {
        message: 'Selecione um mercado para criar usuários.',
      });
    if (!req.body.email || !/^\S+@\S+\.\S+$/.test(req.body.email))
      return send(res, 400, { message: 'Informe um email válido.' });
    if (!req.body.password || req.body.password.length < 8)
      return send(res, 400, {
        message: 'A senha deve ter ao menos 8 caracteres.',
      });
    if (req.body.role && !USER_ROLES.includes(req.body.role))
      return send(res, 400, { message: 'Perfil de usuário inválido.' });
    if (user.role === 'gerente' && (req.body.role || 'vendedor') !== 'vendedor')
      return send(res, 403, {
        message: 'Gerentes podem criar apenas usuários vendedores.',
      });
    const [capacity] =
      await sql`SELECT market.user_limit,(SELECT count(*)::int FROM nexo.users WHERE market_id=market.id AND active) AS user_count FROM nexo.markets market WHERE market.id=${user.market_id}`;
    if (
      capacity?.user_limit &&
      Number(capacity.user_count) >= Number(capacity.user_limit)
    )
      return send(res, 409, {
        code: 'USER_LIMIT_REACHED',
        message: 'O limite de usuários do plano foi atingido.',
      });
    const hash = await bcrypt.hash(req.body.password, 12);
    const email = String(req.body.email).trim().toLowerCase();
    const photoUrl = req.body.photo_url
      ? normalizeImageValue(req.body.photo_url)
      : null;
    const [created] =
      await sql`INSERT INTO nexo.users(market_id,email,password_hash,full_name,role,photo_url) VALUES(${user.market_id},${email},${hash},${String(req.body.full_name || email).trim() || email},${req.body.role || 'vendedor'},${photoUrl}) RETURNING id,email,full_name,role,photo_url`;
    return send(res, 201, created);
  }
  if (path[0] === 'sales' && path[1] === 'list' && req.method === 'GET') {
    if (!user.market_id)
      return send(res, 400, { message: 'Usuário sem mercado.' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(
      10,
      Math.min(Number.parseInt(req.query.page_size, 10) || 20, 100),
    );
    const offset = (page - 1) * pageSize;
    const from = parseDateQuery(req.query.from);
    const to = parseDateQuery(req.query.to);
    const requestedSeller =
      user.role === 'vendedor' ? user.id : text(req.query.seller_id, 180);
    const query = text(req.query.search, 180).toLowerCase();
    const queryPattern = `%${query}%`;
    const payment = text(req.query.payment, 40);
    const status = text(req.query.status, 40);
    const rows = await sql`
      SELECT id, data - 'items' AS data, created_date, updated_date, count(*) OVER()::int AS total_count
      FROM nexo.records
      WHERE market_id=${user.market_id}
        AND entity='sales'
        AND data->>'status'=ANY(ARRAY['concluida','cancelada'])
        AND (${from === null} OR created_date >= ${from})
        AND (${to === null} OR created_date < ${to})
        AND (${requestedSeller === ''} OR data->>'seller_id'=${requestedSeller})
        AND (${status === ''} OR data->>'status'=${status})
        AND (${payment === ''} OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(data->'payments','[]'::jsonb)) AS payment_item
          WHERE payment_item->>'method'=${payment}
        ))
        AND (${query === ''} OR lower(COALESCE(data->>'sale_number','')) LIKE ${queryPattern}
          OR lower(COALESCE(data->>'seller_name','')) LIKE ${queryPattern}
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(data->'payments','[]'::jsonb)) AS search_payment
            WHERE lower(COALESCE(search_payment->>'method','')) LIKE ${queryPattern}
          )
        )
      ORDER BY created_date DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const sales = rows.map(recordFromRow);
    const total = Number(rows[0]?.total_count || 0);
    const includeSellers =
      req.query.include_sellers === '1' || user.role === 'vendedor';
    const sellerRows = !includeSellers
      ? []
      : user.role === 'vendedor'
        ? [{ id: user.id, full_name: user.full_name || user.email }]
        : await sql`SELECT id,COALESCE(full_name,email) AS full_name FROM nexo.users WHERE market_id=${user.market_id} AND active=true AND role=ANY(ARRAY['vendedor','gerente','admin']) ORDER BY COALESCE(full_name,email)`;
    const sellers = sellerRows.map((seller) => ({
      id: seller.id,
      name: seller.full_name,
    }));
    return send(res, 200, {
      items: sales,
      page,
      page_size: pageSize,
      total,
      page_count: Math.max(1, Math.ceil(total / pageSize)),
      sellers,
    });
  }

  if (path[0] === 'sales' && path[1] === 'report' && req.method === 'GET') {
    if (!hasFeature(user, 'report_export'))
      return send(res, 403, {
        code: 'FEATURE_NOT_AVAILABLE',
        message: 'Exportação de relatórios não está incluída neste plano.',
      });
    if (!user.market_id)
      return send(res, 400, { message: 'Usuário sem mercado.' });
    const from = parseDateQuery(req.query.from);
    const to = parseDateQuery(req.query.to);
    if (
      !from ||
      !to ||
      to <= from ||
      to.getTime() - from.getTime() > 27 * 60 * 60 * 1000
    ) {
      return send(res, 400, {
        message: 'Informe um único dia e um intervalo de horário válido.',
      });
    }
    const requestedSeller =
      user.role === 'vendedor' ? user.id : text(req.query.seller_id, 180);
    const rows = await sql`
      SELECT id, data, created_date, updated_date
      FROM nexo.records
      WHERE market_id=${user.market_id}
        AND entity='sales'
        AND created_date >= ${from}
        AND created_date < ${to}
        AND (${requestedSeller === ''} OR data->>'seller_id'=${requestedSeller})
      ORDER BY created_date ASC
      LIMIT 5000
    `;
    let sales = rows
      .map(recordFromRow)
      .filter((sale) => ['concluida', 'cancelada'].includes(sale.status));
    const payment = text(req.query.payment, 40);
    if (payment)
      sales = sales.filter((sale) =>
        (sale.payments || []).some((item) => item.method === payment),
      );
    return send(res, 200, {
      sales,
      summary: summarizeSales(sales),
      filters: {
        from: from.toISOString(),
        to: to.toISOString(),
        seller_id: requestedSeller || null,
        payment: payment || null,
      },
    });
  }

  if (path[0] === 'sales' && path[1] === 'next' && req.method === 'GET') {
    const rows =
      await sql`SELECT next_sale_number FROM nexo.markets WHERE id=${user.market_id}`;
    return send(
      res,
      rows[0] ? 200 : 404,
      rows[0]
        ? { sale_number: Number(rows[0].next_sale_number) }
        : { message: 'Mercado não encontrado.' },
    );
  }
  if (path[0] === 'sales' && path[1] === 'complete' && req.method === 'POST') {
    if (!user.market_id)
      return send(res, 400, { message: 'Usuário sem mercado.' });
    const openCashSession = await findOpenCashSession(
      sql,
      user.market_id,
      user.id,
    );
    if (
      user.role === 'vendedor' &&
      user.require_cash_register &&
      !openCashSession
    ) {
      return send(res, 409, {
        code: 'CASH_REGISTER_REQUIRED',
        message:
          'Abra o caixa e informe o valor inicial antes de começar a vender.',
      });
    }
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const rawPayments = Array.isArray(req.body.payments)
      ? req.body.payments
      : [];
    if (!rawItems.length)
      return send(res, 400, { message: 'A venda não possui itens.' });
    if (rawItems.length > 500)
      return send(res, 400, {
        message:
          'A venda possui itens demais para ser concluída de uma só vez.',
      });
    if (
      rawItems.some(
        (item) =>
          !isUuid(item.product_id) ||
          !Number.isFinite(Number(item.quantity ?? item.weight)),
      )
    )
      return send(res, 400, {
        message:
          'Há itens inválidos na venda. Remova e adicione o produto novamente.',
      });
    const productIds = [...new Set(rawItems.map((item) => item.product_id))];
    const ownedProducts =
      await sql`SELECT id,data FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND id=ANY(${productIds}::uuid[])`;
    if (ownedProducts.length !== productIds.length)
      return send(res, 409, {
        message:
          'A venda possui produto inexistente ou de outro mercado. Atualize o PDV e tente novamente.',
      });
    const productsById = new Map(
      ownedProducts.map((product) => [product.id, product.data]),
    );
    const items = rawItems.map((item) => {
      const product = productsById.get(item.product_id);
      const unit = product.unit === 'peso' ? 'peso' : product.unit || 'unidade';
      const soldQuantity =
        unit === 'peso' ? Number(item.weight) : Number(item.quantity);
      const currentPrice = Number(product.sale_price);
      if (
        !Number.isFinite(soldQuantity) ||
        soldQuantity <= 0 ||
        !Number.isFinite(currentPrice) ||
        currentPrice < 0
      )
        throw new AppError(
          400,
          'INVALID_SALE_ITEM',
          'Há quantidade ou preço inválido na venda.',
        );
      if (Math.abs(Number(item.unit_price) - currentPrice) > 0.009)
        throw new AppError(
          409,
          'PRODUCT_PRICE_CHANGED',
          `O preço de ${text(product.name, 180)} foi alterado. Atualize o produto na venda e tente novamente.`,
        );
      return {
        product_id: item.product_id,
        product_name: text(product.name, 180),
        barcode: text(product.barcode, 180),
        internal_code: text(product.internal_code, 180),
        quantity: unit === 'peso' ? 1 : soldQuantity,
        weight: unit === 'peso' ? soldQuantity : null,
        unit_price: currentPrice,
        unit_cost:
          product.cost_price === null ||
          product.cost_price === '' ||
          product.cost_price === undefined
            ? null
            : roundMoney(Math.max(0, Number(product.cost_price) || 0)),
        subtotal: roundMoney(soldQuantity * currentPrice),
        unit,
      };
    });
    if (
      rawPayments.length > 10 ||
      rawPayments.some(
        (payment) =>
          !PAYMENT_METHODS.has(payment.method) ||
          !Number.isFinite(Number(payment.amount)) ||
          Number(payment.amount) < 0,
      )
    )
      return send(res, 400, { message: 'Há pagamentos inválidos na venda.' });
    const isFiado = req.body.sale_type === 'fiado';
    const fiadoPaymentCount = rawPayments.filter(
      (payment) => payment.method === 'fiado',
    ).length;
    if ((!isFiado && fiadoPaymentCount) || (isFiado && fiadoPaymentCount !== 1))
      return send(res, 400, {
        message:
          'A forma de pagamento fiado não está configurada corretamente.',
      });
    const subtotal = roundMoney(
      items.reduce((sum, item) => sum + item.subtotal, 0),
    );
    const discountType =
      req.body.discount_type === 'percentual' ? 'percentual' : 'valor';
    const discountValue = Math.max(0, Number(req.body.discount_value || 0));
    const discount = roundMoney(
      discountType === 'percentual'
        ? (subtotal * Math.min(discountValue, 100)) / 100
        : Math.min(discountValue, subtotal),
    );
    const total = roundMoney(Math.max(0, subtotal - discount));
    const cleanPayments = rawPayments.map((payment) => ({
      method: payment.method,
      amount: roundMoney(Math.max(0, Number(payment.amount))),
    }));
    const paid = roundMoney(
      cleanPayments
        .filter((payment) => payment.method !== 'fiado')
        .reduce((sum, payment) => sum + payment.amount, 0),
    );
    const outstanding = roundMoney(Math.max(0, total - paid));
    if (!isFiado && paid + 0.009 < total)
      return send(res, 400, {
        message: 'O pagamento é menor que o total da venda.',
      });
    const responsibleName = text(req.body.fiado?.responsible_name, 180);
    if (isFiado && !responsibleName)
      return send(res, 400, {
        message: 'Informe o responsável pela venda fiada.',
      });
    if (isFiado && paid > total + 0.009)
      return send(res, 400, {
        message:
          'O valor recebido não pode ser maior que o total em uma venda fiada.',
      });
    if (isFiado && outstanding < 0.01)
      return send(res, 400, {
        message: 'Não há saldo pendente para registrar como fiado.',
      });
    const normalizedPayments = cleanPayments.map((payment) =>
      payment.method === 'fiado'
        ? { method: 'fiado', amount: outstanding }
        : payment,
    );
    const saleData = {
      seller_id: user.id,
      seller_name: user.full_name || user.email,
      cash_session_id: openCashSession?.id || null,
      status: 'concluida',
      items,
      payments: normalizedPayments,
      subtotal,
      discount_value: discountValue,
      discount_type: discountType,
      total,
      paid_amount: paid,
      outstanding_amount: isFiado ? outstanding : 0,
      change_amount: isFiado ? 0 : roundMoney(Math.max(0, paid - total)),
      observation: text(req.body.observation, 1000),
      sale_type: isFiado ? 'fiado' : 'normal',
    };
    const fiadoPayload = {
      responsible_name: responsibleName,
      phone: text(req.body.fiado?.phone, 40),
      observation: text(req.body.fiado?.observation, 1000),
      total_amount: outstanding,
      seller_id: user.id,
      seller_name: user.full_name || user.email,
      status: 'pendente',
    };
    const auditPayload = {
      action_type: 'venda_concluida',
      entity_type: 'sale',
      user_id: user.id,
      user_name: user.full_name || user.email,
      description: 'Venda concluída',
      details: {
        total,
        items: items.length,
        sale_type: isFiado ? 'fiado' : 'normal',
      },
    };
    const [sale] = await sql`
      WITH sale_number AS (
        UPDATE nexo.markets
        SET next_sale_number = next_sale_number + 1
        WHERE id = ${user.market_id}
        RETURNING next_sale_number - 1 AS value
      ), sale AS (
        INSERT INTO nexo.records(market_id, entity, data)
        SELECT ${user.market_id}, 'sales', ${JSON.stringify(saleData)}::jsonb || jsonb_build_object('sale_number', sale_number.value)
        FROM sale_number
        RETURNING id, data, created_date, updated_date
      ), stock_source AS (
        SELECT
          (item->>'product_id')::uuid AS product_id,
          SUM(CASE WHEN item->>'unit'='peso' THEN (item->>'weight')::numeric ELSE (item->>'quantity')::numeric END) AS sold_quantity
        FROM sale, jsonb_array_elements(sale.data->'items') item
        GROUP BY 1
      ), stock AS (
        UPDATE nexo.records product
        SET data = product.data || jsonb_build_object(
          'quantity',
          (CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END) - stock_source.sold_quantity,
          'last_sale_at', now()
        ), updated_date = now()
        FROM stock_source
        WHERE product.id = stock_source.product_id
          AND product.market_id = ${user.market_id}
          AND product.entity = 'products'
        RETURNING product.id
      ), fiado AS (
        INSERT INTO nexo.records(market_id, entity, data)
        SELECT ${user.market_id}, 'fiado_records', ${JSON.stringify(fiadoPayload)}::jsonb || jsonb_build_object(
          'sale_id', sale.id,
          'sale_number', sale.data->'sale_number'
        )
        FROM sale
        WHERE ${isFiado}
        RETURNING id
      ), audit AS (
        INSERT INTO nexo.records(market_id, entity, data)
        SELECT ${user.market_id}, 'general_audits', ${JSON.stringify(auditPayload)}::jsonb || jsonb_build_object(
          'entity_id', sale.id,
          'description', 'Venda #' || (sale.data->>'sale_number') || ' concluída'
        )
        FROM sale
        RETURNING id
      )
      SELECT id, data, created_date, updated_date FROM sale
    `;
    if (!sale)
      throw new AppError(
        409,
        'SALE_NUMBER_UNAVAILABLE',
        'Não foi possível reservar o número da venda. Atualize o PDV e tente novamente.',
      );
    return send(res, 201, {
      id: sale.id,
      ...sale.data,
      created_date: sale.created_date,
      updated_date: sale.updated_date,
    });
  }
  if (path[0] === 'sales' && path[2] === 'cancel' && req.method === 'POST') {
    const saleId = path[1];
    if (!isUuid(saleId)) return send(res, 400, { message: 'Venda inválida.' });
    const cancellationReason = text(req.body.reason, 500);
    const canCancelAny = ['admin', 'gerente'].includes(user.role);
    const rows = await sql`
      SELECT id,data,created_date,updated_date
      FROM nexo.records
      WHERE id=${saleId}
        AND market_id=${user.market_id}
        AND entity='sales'
        AND (${canCancelAny} OR data->>'seller_id'=${user.id})
      LIMIT 1
    `;
    const current = recordFromRow(rows[0]);
    if (!current)
      return send(res, 404, {
        message: 'Venda não encontrada ou sem permissão para cancelar.',
      });
    if (current.status !== 'concluida')
      return send(res, 409, {
        message: 'A venda já foi cancelada ou não pode mais ser alterada.',
      });

    const restoreByProduct = new Map();
    for (const item of current.items || []) {
      if (!isUuid(item.product_id)) continue;
      const quantity = Number(
        item.unit === 'peso' ? item.weight : item.quantity,
      );
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      restoreByProduct.set(
        item.product_id,
        Number(restoreByProduct.get(item.product_id) || 0) + quantity,
      );
    }
    const restores = [...restoreByProduct.entries()].map(([id, quantity]) => ({
      id,
      quantity,
    }));
    const cancelledAt = new Date().toISOString();
    const operationId = randomUUID();
    const auditPayload = {
      action_type: 'venda_cancelada',
      entity_type: 'sale',
      entity_id: saleId,
      user_id: user.id,
      user_name: user.full_name || user.email,
      description: `Venda #${current.sale_number} cancelada`,
      details: {
        reason: cancellationReason,
        total: current.total,
        products_to_restore: restores.length,
      },
    };

    // Todas as etapas são executadas na mesma transação. O identificador da
    // operação impede que dois cliques restaurem o estoque duas vezes.
    const [saleRows, restoredRows, fiadoRows] = await sql.transaction((tx) => [
      tx`
        UPDATE nexo.records
        SET data=data || ${JSON.stringify({
          status: 'cancelada',
          cancellation_reason: cancellationReason,
          cancelled_by_id: user.id,
          cancelled_by_name: user.full_name || user.email,
          cancelled_at: cancelledAt,
          cancellation_operation_id: operationId,
        })}::jsonb,
        updated_date=now()
        WHERE id=${saleId}
          AND market_id=${user.market_id}
          AND entity='sales'
          AND data->>'status'='concluida'
        RETURNING id,data,created_date,updated_date
      `,
      tx`
        WITH stock_input AS (
          SELECT (entry->>'id')::uuid AS id, (entry->>'quantity')::numeric AS quantity
          FROM jsonb_array_elements(${JSON.stringify(restores)}::jsonb) entry
        )
        UPDATE nexo.records product
        SET data=product.data || jsonb_build_object(
          'quantity',
          (CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END) + stock_input.quantity,
          'last_sale_at', (
            SELECT MAX(previous_sale.created_date)
            FROM nexo.records previous_sale
            WHERE previous_sale.market_id=${user.market_id}
              AND previous_sale.entity='sales'
              AND previous_sale.data->>'status'='concluida'
              AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(previous_sale.data->'items','[]'::jsonb)) previous_item
                WHERE previous_item->>'product_id'=product.id::text
              )
          )
        ), updated_date=now()
        FROM stock_input
        WHERE product.id=stock_input.id
          AND product.market_id=${user.market_id}
          AND product.entity='products'
          AND EXISTS (
            SELECT 1 FROM nexo.records cancelled_sale
            WHERE cancelled_sale.id=${saleId}
              AND cancelled_sale.market_id=${user.market_id}
              AND cancelled_sale.entity='sales'
              AND cancelled_sale.data->>'cancellation_operation_id'=${operationId}
          )
        RETURNING product.id
      `,
      tx`
        UPDATE nexo.records fiado
        SET data=fiado.data || ${JSON.stringify({
          status: 'cancelado',
          cancellation_reason: cancellationReason,
          settled_by_id: user.id,
          settled_by_name: user.full_name || user.email,
          cancelled_at: cancelledAt,
        })}::jsonb,
        updated_date=now()
        WHERE fiado.market_id=${user.market_id}
          AND fiado.entity='fiado_records'
          AND fiado.data->>'sale_id'=${saleId}
          AND fiado.data->>'status'='pendente'
          AND EXISTS (
            SELECT 1 FROM nexo.records cancelled_sale
            WHERE cancelled_sale.id=${saleId}
              AND cancelled_sale.data->>'cancellation_operation_id'=${operationId}
          )
        RETURNING fiado.id
      `,
      tx`
        INSERT INTO nexo.records(market_id,entity,data)
        SELECT ${user.market_id},'general_audits',${JSON.stringify(auditPayload)}::jsonb || jsonb_build_object(
          'details', (${JSON.stringify(auditPayload.details)}::jsonb || jsonb_build_object(
            'products_restored', (
              SELECT count(*) FROM nexo.records product
              WHERE product.market_id=${user.market_id}
                AND product.entity='products'
                AND product.id=ANY(${restores.map((item) => item.id)}::uuid[])
            )
          ))
        )
        WHERE EXISTS (
          SELECT 1 FROM nexo.records cancelled_sale
          WHERE cancelled_sale.id=${saleId}
            AND cancelled_sale.market_id=${user.market_id}
            AND cancelled_sale.entity='sales'
            AND cancelled_sale.data->>'cancellation_operation_id'=${operationId}
        )
        RETURNING id
      `,
    ]);

    if (!saleRows?.[0])
      return send(res, 409, {
        message: 'A venda foi alterada em outra tela. Atualize o histórico.',
      });
    const cancelled = recordFromRow(saleRows[0]);
    return send(res, 200, {
      ...cancelled,
      restored_products: restoredRows?.length || 0,
      fiado_cancelled: Boolean(fiadoRows?.length),
    });
  }
  if (path[0] === 'sales' && path[1] && !path[2] && req.method === 'DELETE') {
    if (user.role !== 'admin')
      return send(res, 403, {
        message: 'Apenas administradores podem excluir vendas.',
      });
    if (!isUuid(path[1])) return send(res, 400, { message: 'Venda inválida.' });
    const deletionAudit = {
      action_type: 'venda_excluida',
      entity_type: 'sale',
      entity_id: path[1],
      user_id: user.id,
      user_name: user.full_name || user.email,
    };
    const [removed] = await sql`
      WITH target AS MATERIALIZED (
        SELECT id, data
        FROM nexo.records
        WHERE id=${path[1]}
          AND market_id=${user.market_id}
          AND entity='sales'
          AND data->>'status'='cancelada'
        FOR UPDATE
      ), audit AS (
        INSERT INTO nexo.records(market_id, entity, data)
        SELECT ${user.market_id}, 'general_audits', ${JSON.stringify(deletionAudit)}::jsonb || jsonb_build_object(
          'description', 'Venda #' || COALESCE(target.data->>'sale_number', target.id::text) || ' excluída'
        )
        FROM target
        RETURNING id
      ), deleted AS (
        DELETE FROM nexo.records sale
        USING target
        WHERE sale.id=target.id
          AND EXISTS (SELECT 1 FROM audit)
        RETURNING sale.id, sale.data
      )
      SELECT deleted.id, deleted.data->>'sale_number' AS sale_number
      FROM deleted
    `;
    return send(
      res,
      removed ? 200 : 409,
      removed
        ? { ok: true, id: removed.id, sale_number: removed.sale_number }
        : { message: 'Cancele a venda antes de excluí-la.' },
    );
  }
  if (path[0] === 'stock' && path[1] === 'import' && req.method === 'POST') {
    if (
      !user.market_id ||
      !['admin', 'gerente', 'vendedor'].includes(user.role)
    )
      return send(res, 403, {
        message: 'Sem permissão para alterar o estoque.',
      });
    if (!Array.isArray(req.body.products) || req.body.products.length > 5000)
      return send(res, 400, { message: 'Planilha inválida ou muito grande.' });
    const normalizedProducts = req.body.products.map((product) => {
      const clean = normalizeProductPayload(product);
      validateProductPayload(clean);
      return product.id ? { id: String(product.id), ...clean } : clean;
    });
    const seenNames = new Set();
    const seenBarcodes = new Set();
    const cleanProducts = normalizedProducts.filter((product) => {
      const nameKey = productNameKey(product.name);
      const barcodeKey = text(product.barcode, 180);
      if (
        seenNames.has(nameKey) ||
        (barcodeKey && seenBarcodes.has(barcodeKey))
      )
        return false;
      seenNames.add(nameKey);
      if (barcodeKey) seenBarcodes.add(barcodeKey);
      return true;
    });
    const discarded = normalizedProducts.length - cleanProducts.length;
    const existingMode = ['preview', 'keep', 'update'].includes(
      req.body.existing_mode,
    )
      ? req.body.existing_mode
      : 'update';
    const existingRows =
      await sql`SELECT id,data FROM nexo.records WHERE market_id=${user.market_id} AND entity='products'`;
    const [marketCapacity] =
      await sql`SELECT product_limit FROM nexo.markets WHERE id=${user.market_id}`;
    const existingById = new Map(
      existingRows.map((record) => [record.id, record]),
    );
    const existingByBarcode = new Map(
      existingRows
        .filter((record) => text(record.data?.barcode, 180))
        .map((record) => [text(record.data.barcode, 180), record]),
    );
    const existingByName = new Map(
      existingRows.map((record) => [productNameKey(record.data?.name), record]),
    );
    const reconciled = [];
    let existingCount = 0;
    for (const product of cleanProducts) {
      const match =
        (isUuid(product.id) && existingById.get(product.id)) ||
        (product.barcode && existingByBarcode.get(product.barcode)) ||
        existingByName.get(productNameKey(product.name));
      if (match) {
        existingCount += 1;
        if (existingMode === 'keep') continue;
        reconciled.push({ ...product, id: match.id });
      } else {
        const newProduct = { ...product };
        delete newProduct.id;
        reconciled.push(newProduct);
      }
    }
    if (existingMode === 'preview')
      return send(res, 200, {
        existing: existingCount,
        new: cleanProducts.length - existingCount,
        discarded,
      });
    cleanProducts.splice(0, cleanProducts.length, ...reconciled);
    const newProductCount = cleanProducts.filter(
      (product) => !product.id,
    ).length;
    if (
      marketCapacity?.product_limit &&
      existingRows.length + newProductCount >
        Number(marketCapacity.product_limit)
    )
      return send(res, 409, {
        code: 'PRODUCT_LIMIT_REACHED',
        message: `A importação ultrapassa o limite de ${marketCapacity.product_limit} produtos deste mercadinho.`,
      });
    const barcodeOwners = new Map();
    for (const product of cleanProducts) {
      if (!product.barcode) continue;
      if (
        barcodeOwners.has(product.barcode) &&
        barcodeOwners.get(product.barcode) !== product.id
      )
        return send(res, 409, {
          message: `O código de barras ${product.barcode} aparece em mais de um produto da planilha.`,
        });
      barcodeOwners.set(product.barcode, product.id || null);
    }
    const barcodes = [...barcodeOwners.keys()];
    if (barcodes.length) {
      const existing =
        await sql`SELECT id,data->>'barcode' AS barcode FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND data->>'barcode'=ANY(${barcodes})`;
      const conflict = existing.find(
        (record) => barcodeOwners.get(record.barcode) !== record.id,
      );
      if (conflict)
        return send(res, 409, {
          message: `O código de barras ${conflict.barcode} já pertence a outro produto.`,
        });
    }
    const payload = JSON.stringify(cleanProducts);
    await sql`WITH input AS (SELECT item FROM jsonb_array_elements(${payload}::jsonb) item), updated AS (UPDATE nexo.records record SET data=record.data || (input.item-'id'),updated_date=now() FROM input WHERE input.item?'id' AND record.id=(input.item->>'id')::uuid AND record.market_id=${user.market_id} AND record.entity='products') INSERT INTO nexo.records(market_id,entity,data) SELECT ${user.market_id},'products',item FROM input WHERE NOT item?'id'`;
    return send(res, 200, {
      updated: cleanProducts.length,
      existing: existingCount,
      discarded,
    });
  }
  if (path[0] === 'entities') {
    const table = ENTITIES[path[1]];
    if (!table) return send(res, 404, { message: 'Entidade desconhecida.' });
    const id = path[2];
    if (table === 'users') {
      if (!['admin', 'gerente'].includes(user.role))
        return send(res, 403, {
          message: 'Sem permissão para gerenciar usuários.',
        });
      if (req.method === 'GET')
        return send(
          res,
          200,
          await sql`SELECT id,email,full_name,role,photo_url,active,created_date,updated_date FROM nexo.users WHERE market_id=${user.market_id} AND active=true ORDER BY full_name NULLS LAST,email`,
        );
      if (req.method === 'DELETE') {
        if (!isUuid(id))
          return send(res, 400, { message: 'Usuário inválido.' });
        if (id === user.id)
          return send(res, 400, {
            message: 'Você não pode excluir o próprio usuário.',
          });
        const [target] =
          await sql`SELECT id,email,full_name,role FROM nexo.users WHERE id=${id} AND market_id=${user.market_id} AND active=true`;
        if (!target)
          return send(res, 404, { message: 'Usuário não encontrado.' });
        if (user.role === 'gerente' && target.role !== 'vendedor')
          return send(res, 403, {
            message: 'Gerentes podem excluir apenas usuários vendedores.',
          });
        if (target.role === 'admin') {
          const [state] =
            await sql`SELECT count(*)::int AS active_admins FROM nexo.users WHERE market_id=${user.market_id} AND role='admin' AND active=true`;
          if (Number(state?.active_admins || 0) <= 1)
            return send(res, 409, {
              message: 'Mantenha pelo menos um administrador ativo no mercado.',
            });
        }
        const deletedEmail = `deleted+${String(id).replace(/-/g, '')}@nexo.invalid`;
        const deletedName = `${target.full_name || target.email} (excluído)`;
        const revokedPasswordHash = await bcrypt.hash(randomUUID(), 10);
        const auditPayload = {
          action_type: 'usuario_excluido',
          entity_type: 'user',
          entity_id: id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          description: `Usuário ${target.full_name || target.email} excluído`,
          details: {
            email: target.email,
            role: target.role,
            method: 'soft_delete',
          },
        };

        // A desativação e a auditoria permanecem atômicas, mas sem depender
        // de aliases externos no RETURNING. Essa forma é compatível com o
        // driver serverless do Neon e evita o erro 500 observado na exclusão.
        const [disabledRows] = await sql.transaction((tx) => [
          tx`
            UPDATE nexo.users
            SET active=false,
                email=${deletedEmail},
                full_name=${deletedName},
                photo_url=NULL,
                password_hash=${revokedPasswordHash},
                updated_date=now()
            WHERE id=${id}
              AND market_id=${user.market_id}
              AND active=true
            RETURNING id
          `,
          tx`
            INSERT INTO nexo.records(market_id,entity,data)
            SELECT ${user.market_id},'general_audits',${JSON.stringify(auditPayload)}::jsonb
            WHERE EXISTS (
              SELECT 1
              FROM nexo.users
              WHERE id=${id}
                AND market_id=${user.market_id}
                AND active=false
                AND email=${deletedEmail}
            )
            RETURNING id
          `,
        ]);
        if (!disabledRows?.[0])
          return send(res, 409, {
            message: 'O usuário já foi excluído ou está inativo.',
          });
        return send(res, 200, { ok: true });
      }
      if (req.method === 'PATCH') {
        if (!isUuid(id))
          return send(res, 400, { message: 'Usuário inválido.' });
        if (req.body.role && !USER_ROLES.includes(req.body.role))
          return send(res, 400, { message: 'Perfil de usuário inválido.' });
        if (id === user.id && req.body.active === false)
          return send(res, 400, {
            message: 'Você não pode desativar o próprio acesso.',
          });
        const [target] =
          await sql`SELECT id,role FROM nexo.users WHERE id=${id} AND market_id=${user.market_id} AND active=true`;
        if (!target)
          return send(res, 404, { message: 'Usuário não encontrado.' });
        if (user.role === 'gerente') {
          if (target.id !== user.id && target.role !== 'vendedor')
            return send(res, 403, {
              message: 'Gerentes podem alterar apenas usuários vendedores.',
            });
          if (req.body.role && req.body.role !== target.role)
            return send(res, 403, {
              message: 'Gerentes não podem alterar perfis de acesso.',
            });
          if (target.id === user.id && typeof req.body.active === 'boolean')
            return send(res, 403, {
              message: 'Gerentes não podem alterar o próprio status.',
            });
        }
        const fullName =
          req.body.full_name === undefined
            ? null
            : text(req.body.full_name, 180);
        if (req.body.full_name !== undefined && !fullName)
          return send(res, 400, { message: 'Nome do usuário é obrigatório.' });
        const photoUrl =
          req.body.photo_url === undefined
            ? null
            : normalizeImageValue(req.body.photo_url);
        const [u] =
          await sql`UPDATE nexo.users SET role=COALESCE(${req.body.role || null},role),full_name=COALESCE(${fullName},full_name),photo_url=COALESCE(${photoUrl},photo_url),active=COALESCE(${typeof req.body.active === 'boolean' ? req.body.active : null},active),updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING id,email,full_name,role,photo_url,active`;
        return send(res, 200, u);
      }
    }
    if (table === 'markets')
      return send(res, 403, { message: 'Use o painel geral.' });
    if (table === 'cash_sessions')
      return send(res, 403, { message: 'Use as operações próprias de caixa.' });
    if (
      ['general_audits', 'product_audits'].includes(table) &&
      !['admin', 'gerente'].includes(user.role) &&
      req.method === 'GET'
    )
      return send(res, 403, {
        message: 'Sem permissão para consultar auditorias.',
      });
    if (
      ['general_audits', 'product_audits'].includes(table) &&
      !['GET', 'POST'].includes(req.method)
    )
      return send(res, 405, {
        message: 'Registros de auditoria não podem ser alterados ou excluídos.',
      });
    if (
      table === 'system_configs' &&
      !['admin', 'gerente'].includes(user.role) &&
      req.method !== 'GET'
    )
      return send(res, 403, {
        message: 'Sem permissão para alterar configurações.',
      });
    if (table === 'fiado_records' && req.method === 'POST')
      return send(res, 405, {
        message: 'Fiados são criados automaticamente ao concluir uma venda.',
      });
    if (table === 'fiado_records' && req.method === 'DELETE')
      return send(res, 405, {
        message: 'Fiados devem ser quitados ou cancelados, não excluídos.',
      });
    if (
      table === 'products' &&
      req.method === 'DELETE' &&
      !['admin', 'gerente'].includes(user.role)
    )
      return send(res, 403, {
        message: 'Sem permissão para excluir produtos.',
      });
    if (table === 'system_configs' && req.method === 'DELETE')
      return send(res, 405, {
        message: 'Configurações não podem ser excluídas por esta operação.',
      });
    if (table === 'sales' && ['POST', 'PATCH', 'DELETE'].includes(req.method))
      return send(res, 405, {
        message: 'Use as operações próprias de vendas.',
      });
    if (req.method === 'GET' && id) {
      if (!isUuid(id))
        return send(res, 400, { message: 'Identificador inválido.' });
      const rows =
        await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity=${table}`;
      const record = rows[0]
        ? {
            id: rows[0].id,
            ...rows[0].data,
            created_date: rows[0].created_date,
            updated_date: rows[0].updated_date,
          }
        : null;
      if (
        record &&
        user.role === 'vendedor' &&
        ['sales', 'fiado_records'].includes(table) &&
        record.seller_id !== user.id
      )
        return send(res, 403, {
          message: 'Sem permissão para acessar este registro.',
        });
      return send(
        res,
        record ? 200 : 404,
        record || { message: 'Registro não encontrado.' },
      );
    }
    if (req.method === 'GET') {
      const maxLimit = table === 'sales' ? 5000 : 1000;
      const limit = Math.max(
        1,
        Math.min(Number(req.query.limit) || 500, maxLimit),
      );
      const rows =
        await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${user.market_id} AND entity=${table} ORDER BY updated_date DESC LIMIT ${limit}`;
      let out = rows.map((r) => ({
        id: r.id,
        ...r.data,
        created_date: r.created_date,
        updated_date: r.updated_date,
      }));
      if (
        user.role === 'vendedor' &&
        ['sales', 'fiado_records'].includes(table)
      )
        out = out.filter((record) => record.seller_id === user.id);
      const f = parseFiltersQuery(req.query.filters);
      if (f) {
        out = out.filter((r) =>
          Object.entries(f).every(([k, v]) => matchesFilter(r, k, v)),
        );
      }
      const sort = req.query.sort;
      if (sort) {
        const desc = sort.startsWith('-'),
          key = sort.replace(/^-/, '');
        out.sort((a, b) => (a[key] > b[key] ? 1 : -1) * (desc ? -1 : 1));
      }
      return send(res, 200, out);
    }
    if (req.method === 'POST') {
      let recordPayload = req.body;
      if (table === 'products') {
        if (req.body?.image_url && !hasFeature(user, 'product_image_upload'))
          return send(res, 403, {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Imagens de produtos não estão incluídas neste plano.',
          });
        recordPayload = normalizeProductPayload(req.body);
        validateProductPayload(recordPayload);
        await assertProductBarcodeAvailable(
          sql,
          user.market_id,
          recordPayload.barcode,
        );
        const [capacity] =
          await sql`SELECT market.product_limit,(SELECT count(*)::int FROM nexo.records WHERE market_id=market.id AND entity='products') AS product_count FROM nexo.markets market WHERE market.id=${user.market_id}`;
        if (
          capacity?.product_limit &&
          Number(capacity.product_count) >= Number(capacity.product_limit)
        )
          return send(res, 409, {
            code: 'PRODUCT_LIMIT_REACHED',
            message: 'O limite de produtos do plano foi atingido.',
          });
      }
      if (['general_audits', 'product_audits'].includes(table))
        recordPayload = normalizeAuditPayload(req.body, user, table);
      if (table === 'system_configs') {
        recordPayload = {
          key: text(req.body.key, 100),
          value: String(req.body.value || '').startsWith('data:image/')
            ? normalizeImageValue(req.body.value)
            : text(req.body.value, 5000),
        };
        if (!recordPayload.key)
          return send(res, 400, { message: 'Chave de configuração inválida.' });
        const requiredFeature = CONFIG_FEATURES[recordPayload.key];
        if (requiredFeature && !hasFeature(user, requiredFeature))
          return send(res, 403, {
            code: 'FEATURE_NOT_AVAILABLE',
            message:
              'Este recurso de personalização não está incluído no plano.',
          });
        const [existing] =
          await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(recordPayload)}::jsonb,updated_date=now() WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key'=${recordPayload.key} RETURNING id,data,created_date,updated_date`;
        if (existing)
          return send(res, 200, {
            id: existing.id,
            ...existing.data,
            created_date: existing.created_date,
            updated_date: existing.updated_date,
          });
      }
      const [r] =
        await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(${user.market_id},${table},${JSON.stringify(recordPayload)}::jsonb) RETURNING id,data,created_date,updated_date`;
      return send(res, 201, {
        id: r.id,
        ...r.data,
        created_date: r.created_date,
        updated_date: r.updated_date,
      });
    }
    if (table === 'fiado_records' && req.method === 'PATCH') {
      if (!isUuid(id))
        return send(res, 400, { message: 'Identificador inválido.' });
      const allowedFields = new Set([
        'status',
        'settlement_date',
        'settlement_method',
        'settled_by_id',
        'settled_by_name',
        'cancellation_reason',
      ]);
      const invalidFields = Object.keys(req.body || {}).filter(
        (key) => !allowedFields.has(key),
      );
      if (invalidFields.length)
        return send(res, 400, {
          message: 'A alteração contém campos não permitidos.',
        });
      if (!['quitado', 'cancelado'].includes(req.body.status))
        return send(res, 400, {
          message: 'O fiado só pode ser quitado ou cancelado.',
        });
      if (
        req.body.status === 'quitado' &&
        !['dinheiro', 'pix', 'debito', 'credito', 'outros'].includes(
          req.body.settlement_method,
        )
      )
        return send(res, 400, { message: 'Forma de quitação inválida.' });
      const sellerOnly = user.role === 'vendedor';
      const [current] =
        await sql`SELECT id,data FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity='fiado_records' AND (${!sellerOnly} OR data->>'seller_id'=${user.id})`;
      if (!current)
        return send(res, 404, {
          message: 'Fiado não encontrado ou sem permissão.',
        });
      if (current.data.status !== 'pendente')
        return send(res, 409, {
          message: 'Somente fiados pendentes podem ser quitados ou cancelados.',
        });
      const fiadoUpdate = {
        status: req.body.status,
        settled_by_id: user.id,
        settled_by_name: user.full_name || user.email,
        ...(req.body.status === 'quitado'
          ? {
              settlement_date: new Date().toISOString(),
              settlement_method: req.body.settlement_method,
            }
          : { cancellation_reason: text(req.body.cancellation_reason, 500) }),
      };
      const [r] =
        await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(fiadoUpdate)}::jsonb,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND entity='fiado_records' RETURNING id,data,created_date,updated_date`;
      return send(res, 200, {
        id: r.id,
        ...r.data,
        created_date: r.created_date,
        updated_date: r.updated_date,
      });
    }
    if (req.method === 'PATCH') {
      if (!isUuid(id))
        return send(res, 400, { message: 'Identificador inválido.' });
      let recordPayload = req.body;
      if (table === 'products') {
        if (
          req.body?.image_url !== undefined &&
          !hasFeature(user, 'product_image_upload')
        )
          return send(res, 403, {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Imagens de produtos não estão incluídas neste plano.',
          });
        recordPayload = normalizeProductPayload(req.body, true);
        validateProductPayload(recordPayload, true);
        if (recordPayload.barcode !== undefined)
          await assertProductBarcodeAvailable(
            sql,
            user.market_id,
            recordPayload.barcode,
            id,
          );
      }
      if (table === 'system_configs') {
        const [currentConfig] =
          await sql`SELECT data->>'key' AS key FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity='system_configs'`;
        const requiredFeature = CONFIG_FEATURES[currentConfig?.key];
        if (requiredFeature && !hasFeature(user, requiredFeature))
          return send(res, 403, {
            code: 'FEATURE_NOT_AVAILABLE',
            message:
              'Este recurso de personalização não está incluído no plano.',
          });
        recordPayload = {
          value: String(req.body.value || '').startsWith('data:image/')
            ? normalizeImageValue(req.body.value)
            : text(req.body.value, 5000),
        };
      }
      const [r] =
        await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(recordPayload)}::jsonb,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND entity=${table} RETURNING id,data,created_date,updated_date`;
      return send(
        res,
        r ? 200 : 404,
        r
          ? {
              id: r.id,
              ...r.data,
              created_date: r.created_date,
              updated_date: r.updated_date,
            }
          : { message: 'Registro não encontrado.' },
      );
    }
    if (table === 'products' && req.method === 'DELETE') {
      if (!isUuid(id)) return send(res, 400, { message: 'Produto inválido.' });
      const [removed] = await sql`
        DELETE FROM nexo.records
        WHERE id=${id} AND market_id=${user.market_id} AND entity='products'
        RETURNING id,data
      `;
      if (!removed)
        return send(res, 404, {
          message: 'Produto não encontrado ou já excluído.',
        });
      try {
        const auditData = {
          action_type: 'produto_excluido',
          entity_type: 'product',
          entity_id: removed.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          description: `Produto ${text(removed.data?.name, 180) || 'sem nome'} excluído do estoque`,
          details: {
            barcode: text(removed.data?.barcode, 180),
            internal_code: text(removed.data?.internal_code, 180),
          },
        };
        await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(${user.market_id},'general_audits',${JSON.stringify(auditData)}::jsonb)`;
      } catch (auditError) {
        console.error(
          'Falha ao auditar exclusão de produto:',
          auditError?.message,
        );
      }
      return send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      if (!isUuid(id))
        return send(res, 400, { message: 'Identificador inválido.' });
      await sql`DELETE FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity=${table}`;
      return send(res, 200, { ok: true });
    }
  }
  return send(res, 404, { message: 'Rota não encontrada.' });
}

export default async function handler(req, res) {
  try {
    return await routeHandler(req, res);
  } catch (error) {
    return handleError(error, res);
  }
}
