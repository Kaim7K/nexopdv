import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  assertDatabaseReady,
  CURRENT_SCHEMA_VERSION,
} from '../server/db.js';
import {
  authenticateCredentials,
  clearSession,
  createSession,
  currentUser,
  publicUser,
} from '../server/auth.js';
import {
  handleError,
  methodNotAllowed,
  send,
} from '../server/http.js';
import { createRequestContext } from '../server/request-context.js';
import { moduleAccessError } from '../server/module-access.js';
import { handleEntityRequest } from '../server/entities/routes.js';
import { handleSalesRequest } from '../server/sales/routes.js';
import { handleCashRequest } from '../server/cash/routes.js';
import { handlePlatformRequest } from '../server/platform/routes.js';
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
import {
  buildCashSessionSummary,
  roundMoney,
} from '../server/cash-summary.js';
import { normalizeCashClosingTime } from '../server/cash-access.js';

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

async function getCashSessionsSummaries(sql, marketId, sessions) {
  const validSessions = (sessions || []).filter(Boolean);
  if (!validSessions.length) return new Map();
  const sessionIds = validSessions.map((session) => String(session.id));
  const [saleRows, movementRows] = await Promise.all([
    sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${marketId} AND entity='sales' AND data->>'cash_session_id'=ANY(${sessionIds}::text[]) ORDER BY created_date ASC`,
    sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${marketId} AND entity='cash_movements' AND data->>'cash_session_id'=ANY(${sessionIds}::text[]) ORDER BY created_date ASC`,
  ]);
  const salesBySession = new Map();
  const movementsBySession = new Map();
  for (const row of saleRows) {
    const sale = recordFromRow(row);
    const key = String(sale.cash_session_id || '');
    salesBySession.set(key, [...(salesBySession.get(key) || []), sale]);
  }
  for (const row of movementRows) {
    const movement = recordFromRow(row);
    const key = String(movement.cash_session_id || '');
    movementsBySession.set(key, [
      ...(movementsBySession.get(key) || []),
      movement,
    ]);
  }
  return new Map(
    validSessions.map((session) => [
      String(session.id),
      buildCashSessionSummary(
        session,
        salesBySession.get(String(session.id)) || [],
        movementsBySession.get(String(session.id)) || [],
      ),
    ]),
  );
}

async function getCashSessionSummary(sql, marketId, session) {
  if (!session) return null;
  const summaries = await getCashSessionsSummaries(sql, marketId, [session]);
  return summaries.get(String(session.id)) || null;
}

async function ensureCashFinanceReferences(sql, user) {
  await sql`
    INSERT INTO nexo.finance_accounts(market_id,unit_id,name,type,is_default,created_by)
    SELECT ${user.market_id},${user.unit_id || null},'Caixa principal','cash',true,${user.id}
    WHERE NOT EXISTS (
      SELECT 1 FROM nexo.finance_accounts WHERE market_id=${user.market_id}
    )
    ON CONFLICT DO NOTHING
  `;
  await sql`
    INSERT INTO nexo.finance_categories(market_id,name,type,system_key,created_by)
    SELECT ${user.market_id},'Outras despesas','expense','other_expense',${user.id}
    WHERE NOT EXISTS (
      SELECT 1 FROM nexo.finance_categories
      WHERE market_id=${user.market_id} AND system_key='other_expense'
    )
    ON CONFLICT DO NOTHING
  `;
  const [[account], [category]] = await Promise.all([
    sql`SELECT id FROM nexo.finance_accounts WHERE market_id=${user.market_id} AND active ORDER BY is_default DESC,created_date LIMIT 1`,
    sql`SELECT id FROM nexo.finance_categories WHERE market_id=${user.market_id} AND active AND type IN ('expense','both') ORDER BY CASE WHEN system_key='other_expense' THEN 0 ELSE 1 END,created_date LIMIT 1`,
  ]);
  return { accountId: account?.id || null, categoryId: category?.id || null };
}

function cashClosingExpenseQuery(
  sqlTag,
  user,
  session,
  amount,
  occurredAt = new Date().toISOString(),
  references = {},
  requiredSessionStatus = null,
  requiredOperationId = null,
) {
  const normalizedAmount = roundMoney(Number(amount || 0));
  if (normalizedAmount <= 0) {
    return sqlTag`
      WITH reversed_transaction AS (
        UPDATE nexo.finance_transactions
        SET status='reversed',paid_amount=0,settled_at=NULL,cancelled_by=${user.id},
            cancelled_at=now(),cancellation_reason='Fechamento de caixa reaberto ou ajustado',updated_date=now()
        WHERE market_id=${user.market_id} AND origin='cash_close' AND origin_id=${session.id}
          AND status NOT IN ('cancelled','reversed')
          AND (${requiredSessionStatus === null} OR EXISTS (
            SELECT 1 FROM nexo.records cash_session
            WHERE cash_session.id=${session.id} AND cash_session.market_id=${user.market_id}
              AND cash_session.entity='cash_sessions'
              AND cash_session.data->>'status'=${requiredSessionStatus}
              AND (${requiredOperationId === null} OR cash_session.data->>'financial_operation_id'=${requiredOperationId})
          ))
        RETURNING id,market_id
      ), reversed_payments AS (
        UPDATE nexo.finance_payments payment
        SET reversed_at=now(),reversed_by=${user.id},
            reversal_reason='Fechamento de caixa reaberto ou ajustado'
        FROM reversed_transaction transaction
        WHERE payment.transaction_id=transaction.id AND payment.reversed_at IS NULL
      )
      INSERT INTO nexo.finance_transaction_events(
        market_id,transaction_id,action,new_data,actor_id,actor_name
      )
      SELECT market_id,id,'reversed',jsonb_build_object('amount',0),${user.id},${user.full_name || user.email}
      FROM reversed_transaction
    `;
  }

  const { accountId, categoryId } = references;
  if (!accountId)
    throw new AppError(
      409,
      'FINANCE_ACCOUNT_REQUIRED',
      'Não foi possível vincular a despesa do fechamento a uma conta financeira.',
    );
  const description = 'Despesa registrada no fechamento do caixa';
  return sqlTag`
    WITH transaction AS (
      INSERT INTO nexo.finance_transactions(
        market_id,unit_id,account_id,category_id,supplier_id,type,description,
        amount,paid_amount,issue_date,due_date,settled_at,payment_method,
        status,origin,origin_id,notes,created_by
      ) SELECT
        ${user.market_id},${session.unit_id || user.unit_id || null},${accountId},${categoryId},NULL,
        'expense',${description},${normalizedAmount},${normalizedAmount},${occurredAt.slice(0, 10)},
        ${occurredAt.slice(0, 10)},${occurredAt},'dinheiro','paid','cash_close',${session.id},
        ${`Caixa ${session.id}`},${user.id}
      WHERE (${requiredSessionStatus === null} OR EXISTS (
        SELECT 1 FROM nexo.records cash_session
        WHERE cash_session.id=${session.id} AND cash_session.market_id=${user.market_id}
          AND cash_session.entity='cash_sessions'
          AND cash_session.data->>'status'=${requiredSessionStatus}
          AND (${requiredOperationId === null} OR cash_session.data->>'financial_operation_id'=${requiredOperationId})
      ))
      ON CONFLICT (market_id,origin,origin_id)
        WHERE origin='cash_close' AND origin_id IS NOT NULL
      DO UPDATE SET
        unit_id=excluded.unit_id,account_id=excluded.account_id,category_id=excluded.category_id,
        amount=excluded.amount,paid_amount=excluded.paid_amount,issue_date=excluded.issue_date,
        due_date=excluded.due_date,settled_at=excluded.settled_at,payment_method=excluded.payment_method,
        status='paid',cancelled_by=NULL,cancelled_at=NULL,cancellation_reason=NULL,updated_date=now()
      RETURNING *
    ), reversed_payments AS (
      UPDATE nexo.finance_payments payment
      SET reversed_at=now(),reversed_by=${user.id},reversal_reason='Valor do fechamento atualizado'
      FROM transaction
      WHERE payment.transaction_id=transaction.id AND payment.reversed_at IS NULL
    ), payment AS (
      INSERT INTO nexo.finance_payments(
        market_id,transaction_id,account_id,amount,paid_at,payment_method,notes,created_by
      )
      SELECT market_id,id,account_id,paid_amount,settled_at,payment_method,
             'Pagamento sincronizado com o fechamento do caixa',${user.id}
      FROM transaction
    )
    INSERT INTO nexo.finance_transaction_events(
      market_id,transaction_id,action,new_data,actor_id,actor_name
    )
    SELECT market_id,id,'cash_close_synced',to_jsonb(transaction),${user.id},${user.full_name || user.email}
    FROM transaction
  `;
}

function cashClosingEntryQuery(
  sqlTag,
  user,
  session,
  amount,
  occurredAt = new Date().toISOString(),
  references = {},
  requiredSessionStatus = null,
  requiredOperationId = null,
) {
  const normalizedAmount = roundMoney(Number(amount || 0));
  if (normalizedAmount <= 0) {
    return sqlTag`
      WITH reversed_transaction AS (
        UPDATE nexo.finance_transactions
        SET status='reversed',paid_amount=0,settled_at=NULL,cancelled_by=${user.id},
            cancelled_at=now(),cancellation_reason='Entrada do fechamento removida',updated_date=now()
        WHERE market_id=${user.market_id} AND origin='cash_close_entry' AND origin_id=${session.id}
          AND status NOT IN ('cancelled','reversed')
          AND (${requiredSessionStatus === null} OR EXISTS (
            SELECT 1 FROM nexo.records cash_session
            WHERE cash_session.id=${session.id} AND cash_session.market_id=${user.market_id}
              AND cash_session.entity='cash_sessions'
              AND cash_session.data->>'status'=${requiredSessionStatus}
              AND (${requiredOperationId === null} OR cash_session.data->>'financial_operation_id'=${requiredOperationId})
          ))
        RETURNING id,market_id
      ), reversed_payments AS (
        UPDATE nexo.finance_payments payment
        SET reversed_at=now(),reversed_by=${user.id},reversal_reason='Entrada do fechamento removida'
        FROM reversed_transaction transaction
        WHERE payment.transaction_id=transaction.id AND payment.reversed_at IS NULL
      )
      INSERT INTO nexo.finance_transaction_events(
        market_id,transaction_id,action,new_data,actor_id,actor_name
      )
      SELECT market_id,id,'reversed',jsonb_build_object('amount',0),${user.id},${user.full_name || user.email}
      FROM reversed_transaction
    `;
  }

  const { accountId } = references;
  if (!accountId)
    throw new AppError(
      409,
      'FINANCE_ACCOUNT_REQUIRED',
      'Não foi possível vincular a entrada do fechamento a uma conta financeira.',
    );
  return sqlTag`
    WITH transaction AS (
      INSERT INTO nexo.finance_transactions(
        market_id,unit_id,account_id,type,description,amount,paid_amount,
        issue_date,due_date,settled_at,payment_method,status,origin,origin_id,notes,created_by
      ) SELECT
        ${user.market_id},${session.unit_id || user.unit_id || null},${accountId},'adjustment',
        'Entrada registrada no fechamento do caixa',${normalizedAmount},${normalizedAmount},
        ${occurredAt.slice(0, 10)},${occurredAt.slice(0, 10)},${occurredAt},'dinheiro','paid',
        'cash_close_entry',${session.id},${`cash_direction:entrada | Caixa ${session.id}`},${user.id}
      WHERE (${requiredSessionStatus === null} OR EXISTS (
        SELECT 1 FROM nexo.records cash_session
        WHERE cash_session.id=${session.id} AND cash_session.market_id=${user.market_id}
          AND cash_session.entity='cash_sessions'
          AND cash_session.data->>'status'=${requiredSessionStatus}
          AND (${requiredOperationId === null} OR cash_session.data->>'financial_operation_id'=${requiredOperationId})
      ))
      ON CONFLICT (market_id,origin,origin_id)
        WHERE origin='cash_close_entry' AND origin_id IS NOT NULL
      DO UPDATE SET
        unit_id=excluded.unit_id,account_id=excluded.account_id,amount=excluded.amount,
        paid_amount=excluded.paid_amount,issue_date=excluded.issue_date,due_date=excluded.due_date,
        settled_at=excluded.settled_at,payment_method=excluded.payment_method,status='paid',
        cancelled_by=NULL,cancelled_at=NULL,cancellation_reason=NULL,updated_date=now()
      RETURNING *
    ), reversed_payments AS (
      UPDATE nexo.finance_payments payment
      SET reversed_at=now(),reversed_by=${user.id},reversal_reason='Entrada do fechamento atualizada'
      FROM transaction
      WHERE payment.transaction_id=transaction.id AND payment.reversed_at IS NULL
    ), payment AS (
      INSERT INTO nexo.finance_payments(
        market_id,transaction_id,account_id,amount,paid_at,payment_method,notes,created_by
      )
      SELECT market_id,id,account_id,paid_amount,settled_at,payment_method,
             'Entrada sincronizada com o fechamento do caixa',${user.id}
      FROM transaction
    )
    INSERT INTO nexo.finance_transaction_events(
      market_id,transaction_id,action,new_data,actor_id,actor_name
    )
    SELECT market_id,id,'cash_close_entry_synced',to_jsonb(transaction),${user.id},${user.full_name || user.email}
    FROM transaction
  `;
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
  const { sql, path } = await createRequestContext(req);

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
    const sessionHours =
      req.body?.remember === false ? Number(sessionPolicy?.hours || 12) : 24 * 90;
    await createSession(authenticated, res, sessionHours);
    return send(res, 200, { ok: true, user: publicUser(authenticated) });
  }
  const user = await currentUser(req, sql);
  if (!user)
    return send(res, 401, {
      code: 'SESSION_EXPIRED',
      message: 'Sessão expirada.',
    });
  const isSystemReloadStatus =
    path[0] === 'system' && path[1] === 'reload' && req.method === 'GET';
  if (
    user.role !== 'super_admin' &&
    user.maintenance_mode &&
    !isSystemReloadStatus
  )
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
  const accessError = moduleAccessError(user, path, req.method);
  if (accessError) return send(res, 403, { message: accessError });

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
    const rawSalePrice = req.body.sale_price;
    const hasCustomPrice =
      rawSalePrice !== undefined && rawSalePrice !== null && rawSalePrice !== '';
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
    const customPrice = hasCustomPrice
      ? roundMoney(Math.max(0, Number(rawSalePrice)))
      : defaultPrice;
    if (hasCustomPrice && (!Number.isFinite(customPrice) || customPrice < 0))
      return send(res, 400, {
        message: 'Informe um preço de venda válido.',
      });
    const productPayload = {
      name,
      barcode,
      internal_code: `PDV-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
      image_url: '',
      sale_price: Number.isFinite(customPrice) ? customPrice : 0,
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

  if (path[0] === 'cash')
    return handleCashRequest(
      { req, res, sql, user, path },
      {
        cashClosingEntryQuery,
        cashClosingExpenseQuery,
        ensureCashFinanceReferences,
        findOpenCashSession,
        getCashSessionSummary,
        getCashSessionsSummaries,
        isUuid,
        parseDateQuery,
        recordFromRow,
        text,
      },
    );
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

  if (path[0] === 'admin' || path[0] === 'markets' || path[0] === 'system')
    return handlePlatformRequest(
      { req, res, sql, user, path },
      {
        MARKET_FEATURES,
        MARKET_MODULES,
        isUuid,
        normalizeImageValue,
        parseDateQuery,
        text,
      },
    );
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
    if (
      req.body.cash_closing_time_enabled !== undefined &&
      typeof req.body.cash_closing_time_enabled !== 'boolean'
    )
      return send(res, 400, {
        message: 'Configuração de horário de fechamento inválida.',
      });
    const closingTime = normalizeCashClosingTime(
      req.body.cash_closing_min_time,
    );
    const closingTimeEnabled = Boolean(req.body.cash_closing_time_enabled);
    if (closingTimeEnabled && !closingTime)
      return send(res, 400, {
        message: 'Informe um horário mínimo válido para fechar o caixa.',
      });
    const [created] =
      await sql`INSERT INTO nexo.users(market_id,email,password_hash,full_name,role,photo_url,cash_closing_time_enabled,cash_closing_min_time) VALUES(${user.market_id},${email},${hash},${String(req.body.full_name || email).trim() || email},${req.body.role || 'vendedor'},${photoUrl},${closingTimeEnabled},${closingTime}::time) RETURNING id,email,full_name,role,photo_url,cash_closing_time_enabled,to_char(cash_closing_min_time,'HH24:MI') AS cash_closing_min_time`;
    return send(res, 201, created);
  }
  if (path[0] === 'sales')
    return handleSalesRequest(
      { req, res, sql, user, path },
      {
        PAYMENT_METHODS,
        findOpenCashSession,
        hasFeature,
        isUuid,
        parseDateQuery,
        recordFromRow,
        text,
      },
    );

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
  if (path[0] === 'entities')
    return handleEntityRequest(
      { req, res, sql, user, path },
      {
        ENTITIES,
        USER_ROLES,
        CONFIG_FEATURES,
        assertProductBarcodeAvailable,
        findOpenCashSession,
        hasFeature,
        isUuid,
        matchesFilter,
        normalizeAuditPayload,
        normalizeImageValue,
        normalizeProductPayload,
        parseFiltersQuery,
        text,
        validateProductPayload,
      },
    );

  return send(res, 404, { message: 'Rota não encontrada.' });
}

export default async function handler(req, res) {
  try {
    return await routeHandler(req, res);
  } catch (error) {
    return handleError(error, res);
  }
}
