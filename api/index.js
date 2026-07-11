import bcrypt from 'bcryptjs';
import { handleUpload } from '@vercel/blob/client';
import { assertDatabaseReady, CURRENT_SCHEMA_VERSION, getDb } from '../server/db.js';
import {
  authenticateCredentials,
  clearSession,
  createSession,
  currentUser,
  publicUser,
} from '../server/auth.js';
import { assertSameOriginRequest, handleError, methodNotAllowed, readJsonBody, send } from '../server/http.js';
import { AppError } from '../server/errors.js';
import { searchProductImages } from '../server/product-images.js';
import { IMAGE_UPLOAD_KINDS, importRemoteProductImage, PRODUCT_IMAGE_UPLOAD_RULES } from '../server/media.js';

const ENTITIES = {
  Product: 'products', Sale: 'sales', FiadoRecord: 'fiado_records', GeneralAudit: 'general_audits',
  ProductAudit: 'product_audits', SystemConfig: 'system_configs', User: 'users', Market: 'markets',
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MARKET_MODULES = ['pdv','estoque','vendas','fiados','relatorios','auditoria','usuarios','configuracoes'];
const USER_ROLES = ['vendedor', 'gerente', 'admin'];
const PAYMENT_METHODS = new Set(['dinheiro', 'pix', 'debito', 'credito', 'outros', 'fiado']);
const PRODUCT_FIELDS = ['name','category','barcode','internal_code','image_url','sale_price','cost_price','quantity','unit','status'];
const PRODUCT_UNITS = new Set(['unidade','peso','pacote']);
const PRODUCT_STATUSES = new Set(['ativo','inativo']);

const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function normalizeProductPayload(data, partial = false) {
  const source = data && typeof data === 'object' ? data : {};
  const clean = {};
  for (const field of PRODUCT_FIELDS) {
    if (partial && source[field] === undefined) continue;
    if (['sale_price','cost_price','quantity'].includes(field)) {
      clean[field] = source[field] === null || source[field] === '' ? (field === 'cost_price' ? null : 0) : Number(source[field]);
    } else if (field === 'unit') clean[field] = PRODUCT_UNITS.has(source[field]) ? source[field] : 'unidade';
    else if (field === 'status') clean[field] = PRODUCT_STATUSES.has(source[field]) ? source[field] : 'ativo';
    else clean[field] = text(source[field], field === 'image_url' ? 2048 : 180);
  }
  return clean;
}

async function assertProductBarcodeAvailable(sql, marketId, barcode, excludeId = null) {
  const normalized = text(barcode, 180);
  if (!normalized) return;
  const rows = await sql`SELECT id FROM nexo.records WHERE market_id=${marketId} AND entity='products' AND data->>'barcode'=${normalized} AND (${excludeId === null} OR id<>${excludeId}::uuid) LIMIT 1`;
  if (rows.length) throw new AppError(409, 'DUPLICATE_BARCODE', 'Já existe um produto com este código de barras.');
}

function normalizeAuditPayload(data, user, type) {
  const source = data && typeof data === 'object' ? data : {};
  const details = typeof source.details === 'string' ? source.details.slice(0, 20000) : source.details ?? '';
  const common = {
    user_id: user.id,
    user_name: text(user.full_name || user.email, 180),
  };
  if (type === 'general_audits') return {
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
    sale_number: Number.isFinite(Number(source.sale_number)) ? Number(source.sale_number) : null,
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
      if (Array.isArray(expected.includesAny)) return expected.includesAny.some(value => actual.includes(value));
      if (Array.isArray(expected.includesAll)) return expected.includesAll.every(value => actual.includes(value));
    }
    return Object.entries(expected).every(([nestedKey, nestedValue]) => actual?.[nestedKey] === nestedValue);
  }
  return actual === expected;
}

function validateProductPayload(data, partial = false) {
  if (!partial || data.name !== undefined) {
    if (!String(data.name || '').trim()) throw new AppError(400, 'INVALID_PRODUCT', 'Nome do produto é obrigatório.');
  }
  if (!partial || data.sale_price !== undefined) {
    if (!Number.isFinite(Number(data.sale_price)) || Number(data.sale_price) < 0) throw new AppError(400, 'INVALID_PRODUCT', 'Preço de venda inválido.');
  }
  if (!partial || data.quantity !== undefined) {
    if (!Number.isFinite(Number(data.quantity)) || Number(data.quantity) < 0) throw new AppError(400, 'INVALID_PRODUCT', 'Quantidade inválida.');
  }
  if (data.cost_price !== undefined && data.cost_price !== null && data.cost_price !== '' && (!Number.isFinite(Number(data.cost_price)) || Number(data.cost_price) < 0)) {
    throw new AppError(400, 'INVALID_PRODUCT', 'Preço de custo inválido.');
  }
  if (data.unit !== undefined && !PRODUCT_UNITS.has(data.unit)) throw new AppError(400, 'INVALID_PRODUCT', 'Unidade de venda inválida.');
  if (data.status !== undefined && !PRODUCT_STATUSES.has(data.status)) throw new AppError(400, 'INVALID_PRODUCT', 'Status do produto inválido.');
}

async function routeHandler(req, res) {
  const sql = getDb();
  const requestUrl = new URL(req.url, 'http://localhost');
  req.query = { ...Object.fromEntries(requestUrl.searchParams.entries()), ...(req.query || {}) };
  const routedPath = req.query.path || requestUrl.pathname.replace(/^\/api(?:\/index)?/, '');
  const path = String(routedPath || '/').split('/').filter(Boolean);
  assertSameOriginRequest(req);
  req.body = await readJsonBody(req);

  if (path[0] === 'sitemap.xml') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(rawHost) ? rawHost : '';
    const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() === 'http' ? 'http' : 'https';
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

  await assertDatabaseReady(sql);

  if (path[0] === 'auth' && path[1] === 'login') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const authenticated = await authenticateCredentials(sql, req.body);
    await sql`UPDATE nexo.users SET last_login_at = now() WHERE id = ${authenticated.id}`;
    await createSession(authenticated, res);
    return send(res, 200, { ok: true, user: publicUser(authenticated) });
  }
  if (path[0] === 'auth' && path[1] === 'logout') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    clearSession(res);
    return send(res, 200, { ok: true });
  }

  const user = await currentUser(req, sql);
  if (!user) return send(res, 401, { code: 'SESSION_EXPIRED', message: 'Sessão expirada.' });
  if (path[0] === 'auth' && path[1] === 'me') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    return send(res, 200, publicUser(user));
  }
  const entityModules = { Sale:'vendas', FiadoRecord:'fiados', User:'usuarios' };
  const requiredModule = path[0] === 'stock' ? 'estoque' : path[0] === 'sales' ? (path[1] === 'complete' ? 'pdv' : 'vendas') : path[0] === 'users' ? 'usuarios' : path[0] === 'entities' ? entityModules[path[1]] : null;
  if (user.role !== 'super_admin' && requiredModule && !(user.enabled_modules || []).includes(requiredModule)) return send(res, 403, { message: 'Esta funcionalidade não está habilitada para o mercado.' });
  if (user.role !== 'super_admin' && path[0] === 'entities' && path[1] === 'Product' && !['pdv','estoque'].some(module => (user.enabled_modules || []).includes(module))) return send(res, 403, { message: 'Produtos não estão habilitados para o mercado.' });

  if (path[0] === 'product-images' && path[1] === 'search') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    if (!user.market_id || (user.role !== 'super_admin' && !['pdv','estoque'].some(module => (user.enabled_modules || []).includes(module)))) {
      return send(res, 403, { message: 'Sem permissão para buscar imagens de produtos.' });
    }
    const result = await searchProductImages({
      barcode: req.query.barcode,
      name: req.query.name,
      category: req.query.category,
      page: req.query.page,
    });
    return send(res, 200, result);
  }

  if (path[0] === 'media' && path[1] === 'upload') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
      throw new AppError(503, 'BLOB_NOT_CONFIGURED', 'O armazenamento de imagens ainda não foi conectado. Na Vercel, abra Storage, crie/conecte um Blob Store ao projeto e redeploye para gerar BLOB_READ_WRITE_TOKEN.');
    }
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try { payload = clientPayload ? JSON.parse(clientPayload) : {}; } catch { payload = {}; }
        const kind = IMAGE_UPLOAD_KINDS[payload.kind] ? payload.kind : '';
        if (!kind) throw new AppError(400, 'INVALID_UPLOAD_KIND', 'Tipo de upload inválido.');
        if (kind === 'market' && user.role !== 'super_admin' && !['admin','gerente'].includes(user.role)) throw new AppError(403, 'UPLOAD_FORBIDDEN', 'Sem permissão para enviar logo do mercado.');
        if (kind === 'user' && !['admin','gerente','super_admin'].includes(user.role)) throw new AppError(403, 'UPLOAD_FORBIDDEN', 'Sem permissão para enviar foto de usuário.');
        if (kind === 'product' && (!user.market_id || (user.role !== 'super_admin' && !['pdv','estoque'].some(module => (user.enabled_modules || []).includes(module))))) throw new AppError(403, 'UPLOAD_FORBIDDEN', 'Sem permissão para enviar imagens de produtos.');
        const scope = user.market_id || user.id;
        const prefix = `${IMAGE_UPLOAD_KINDS[kind]}/${scope}/`;
        if (!String(pathname || '').startsWith(prefix)) throw new AppError(400, 'INVALID_UPLOAD_PATH', 'Destino de upload inválido.');
        return {
          ...PRODUCT_IMAGE_UPLOAD_RULES,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
          tokenPayload: JSON.stringify({ userId: user.id, marketId: user.market_id, kind }),
        };
      },
      onUploadCompleted: async () => {},
    });
    return send(res, 200, json);
  }

  if (path[0] === 'media' && path[1] === 'import') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!user.market_id || (user.role !== 'super_admin' && !['pdv','estoque'].some(module => (user.enabled_modules || []).includes(module)))) {
      return send(res, 403, { message: 'Sem permissão para importar imagens de produtos.' });
    }
    const imported = await importRemoteProductImage({
      url: req.body.url,
      productName: req.body.productName,
      marketId: user.market_id,
    });
    return send(res, 201, imported);
  }

  if (path[0] === 'markets') {
    if (user.role !== 'super_admin') return send(res, 403, { message: 'Acesso restrito.' });
    if (req.method === 'GET') return send(res, 200, await sql`SELECT id,name,slug,logo_url,primary_color,secondary_color,enabled_modules,active,created_date FROM nexo.markets ORDER BY name`);
    if (req.method === 'POST') {
      const marketName = text(req.body.name, 120);
      const marketSlug = text(req.body.slug, 80);
      if (!marketName || !/^[a-z0-9-]+$/.test(marketSlug)) return send(res, 400, { message: 'Nome ou identificador inválido.' });
      if (req.body.primary_color && !/^#[0-9a-f]{6}$/i.test(req.body.primary_color)) return send(res, 400, { message: 'Cor principal inválida.' });
      if (req.body.secondary_color && !/^#[0-9a-f]{6}$/i.test(req.body.secondary_color)) return send(res, 400, { message: 'Cor secundária inválida.' });
      if (!/^\S+@\S+\.\S+$/.test(req.body.admin_email || '') || (req.body.admin_password || '').length < 8) return send(res, 400, { message: 'Email ou senha inicial inválidos.' });
      const modules = req.body.enabled_modules || ['pdv','estoque','vendas','fiados','relatorios','auditoria','usuarios','configuracoes'];
      if (!Array.isArray(modules) || modules.some(module => !MARKET_MODULES.includes(module))) return send(res, 400, { message: 'Módulos inválidos.' });
      const hash = await bcrypt.hash(req.body.admin_password, 12);
      const [market] = await sql`WITH market AS (INSERT INTO nexo.markets(name,slug,logo_url,primary_color,secondary_color,enabled_modules) VALUES(${marketName},${marketSlug},${req.body.logo_url || ''},${req.body.primary_color || '#16a06a'},${req.body.secondary_color || '#0f5132'},${JSON.stringify(modules)}::jsonb) RETURNING *), admin AS (INSERT INTO nexo.users(market_id,email,password_hash,full_name,role) SELECT id,${String(req.body.admin_email).trim().toLowerCase()},${hash},${String(req.body.admin_name || 'Administrador').trim() || 'Administrador'},'admin' FROM market) SELECT * FROM market`;
      return send(res, 201, market);
    }
    if (req.method === 'PATCH') {
      const id = path[1], b = req.body;
      if (!isUuid(id)) return send(res, 400, { message: 'Mercado inválido.' });
      if (b.enabled_modules && (!Array.isArray(b.enabled_modules) || b.enabled_modules.some(module => !MARKET_MODULES.includes(module)))) return send(res, 400, { message: 'Módulos inválidos.' });
      const updatedName = b.name === undefined ? null : text(b.name, 120);
      if (b.name !== undefined && !updatedName) return send(res, 400, { message: 'Nome do mercado é obrigatório.' });
      if (b.primary_color && !/^#[0-9a-f]{6}$/i.test(b.primary_color)) return send(res, 400, { message: 'Cor principal inválida.' });
      if (b.secondary_color && !/^#[0-9a-f]{6}$/i.test(b.secondary_color)) return send(res, 400, { message: 'Cor secundária inválida.' });
      const [market] = await sql`UPDATE nexo.markets SET name=COALESCE(${updatedName},name), logo_url=COALESCE(${b.logo_url ?? null},logo_url), primary_color=COALESCE(${b.primary_color || null},primary_color), secondary_color=COALESCE(${b.secondary_color || null},secondary_color), enabled_modules=COALESCE(${b.enabled_modules ? JSON.stringify(b.enabled_modules) : null}::jsonb,enabled_modules), active=COALESCE(${typeof b.active === 'boolean' ? b.active : null},active), updated_date=now() WHERE id=${id} RETURNING *`;
      return send(res, market ? 200 : 404, market || { message: 'Mercado não encontrado.' });
    }
  }
  if (path[0] === 'users' && req.method === 'POST') {
    if (!['admin','super_admin','gerente'].includes(user.role)) return send(res, 403, { message: 'Sem permissão.' });
    if (!user.market_id) return send(res, 400, { message: 'Selecione um mercado para criar usuários.' });
    if (!req.body.email || !/^\S+@\S+\.\S+$/.test(req.body.email)) return send(res, 400, { message: 'Informe um email válido.' });
    if (!req.body.password || req.body.password.length < 8) return send(res, 400, { message: 'A senha deve ter ao menos 8 caracteres.' });
    if (req.body.role && !USER_ROLES.includes(req.body.role)) return send(res, 400, { message: 'Perfil de usuário inválido.' });
    if (user.role === 'gerente' && (req.body.role || 'vendedor') !== 'vendedor') return send(res, 403, { message: 'Gerentes podem criar apenas usuários vendedores.' });
    const hash = await bcrypt.hash(req.body.password, 12);
    const email = String(req.body.email).trim().toLowerCase();
    const [created] = await sql`INSERT INTO nexo.users(market_id,email,password_hash,full_name,role,photo_url) VALUES(${user.market_id},${email},${hash},${String(req.body.full_name || email).trim() || email},${req.body.role || 'vendedor'},${req.body.photo_url || null}) RETURNING id,email,full_name,role,photo_url`;
    return send(res, 201, created);
  }
  if (path[0] === 'sales' && path[1] === 'next' && req.method === 'GET') {
    const rows=await sql`SELECT next_sale_number FROM nexo.markets WHERE id=${user.market_id}`;
    return send(res,rows[0]?200:404,rows[0]?{sale_number:Number(rows[0].next_sale_number)}:{message:'Mercado não encontrado.'});
  }
  if (path[0] === 'sales' && path[1] === 'complete' && req.method === 'POST') {
    if (!user.market_id) return send(res, 400, { message: 'Usuário sem mercado.' });
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const rawPayments = Array.isArray(req.body.payments) ? req.body.payments : [];
    if (!rawItems.length) return send(res, 400, { message: 'A venda não possui itens.' });
    if (rawItems.length > 500) return send(res, 400, { message: 'A venda possui itens demais para ser concluída de uma só vez.' });
    if (rawItems.some(item => !isUuid(item.product_id) || !Number.isFinite(Number(item.quantity ?? item.weight)))) return send(res, 400, { message: 'Há itens inválidos na venda. Remova e adicione o produto novamente.' });
    const productIds = [...new Set(rawItems.map(item => item.product_id))];
    const ownedProducts = await sql`SELECT id,data FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND id=ANY(${productIds}::uuid[])`;
    if (ownedProducts.length !== productIds.length) return send(res, 409, { message: 'A venda possui produto inexistente ou de outro mercado. Atualize o PDV e tente novamente.' });
    const productsById = new Map(ownedProducts.map(product => [product.id, product.data]));
    const items = rawItems.map(item => {
      const product = productsById.get(item.product_id);
      const unit = product.unit === 'peso' ? 'peso' : product.unit || 'unidade';
      const soldQuantity = unit === 'peso' ? Number(item.weight) : Number(item.quantity);
      const currentPrice = Number(product.sale_price);
      if (!Number.isFinite(soldQuantity) || soldQuantity <= 0 || !Number.isFinite(currentPrice) || currentPrice < 0) throw new AppError(400, 'INVALID_SALE_ITEM', 'Há quantidade ou preço inválido na venda.');
      if (Math.abs(Number(item.unit_price) - currentPrice) > 0.009) throw new AppError(409, 'PRODUCT_PRICE_CHANGED', `O preço de ${text(product.name, 180)} foi alterado. Atualize o produto na venda e tente novamente.`);
      return {
        product_id: item.product_id,
        product_name: text(product.name, 180),
        barcode: text(product.barcode, 180),
        internal_code: text(product.internal_code, 180),
        quantity: unit === 'peso' ? 1 : soldQuantity,
        weight: unit === 'peso' ? soldQuantity : null,
        unit_price: currentPrice,
        subtotal: roundMoney(soldQuantity * currentPrice),
        unit,
      };
    });
    if (rawPayments.length > 10 || rawPayments.some(payment => !PAYMENT_METHODS.has(payment.method) || !Number.isFinite(Number(payment.amount)) || Number(payment.amount) < 0)) return send(res, 400, { message: 'Há pagamentos inválidos na venda.' });
    const isFiado = req.body.sale_type === 'fiado';
    const fiadoPaymentCount = rawPayments.filter(payment => payment.method === 'fiado').length;
    if ((!isFiado && fiadoPaymentCount) || (isFiado && fiadoPaymentCount !== 1)) return send(res, 400, { message: 'A forma de pagamento fiado não está configurada corretamente.' });
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));
    const discountType = req.body.discount_type === 'percentual' ? 'percentual' : 'valor';
    const discountValue = Math.max(0, Number(req.body.discount_value || 0));
    const discount = roundMoney(discountType === 'percentual' ? subtotal * Math.min(discountValue, 100) / 100 : Math.min(discountValue, subtotal));
    const total = roundMoney(Math.max(0, subtotal - discount));
    const cleanPayments = rawPayments.map(payment => ({ method: payment.method, amount: roundMoney(Math.max(0, Number(payment.amount))) }));
    const paid = roundMoney(cleanPayments.filter(payment => payment.method !== 'fiado').reduce((sum, payment) => sum + payment.amount, 0));
    const outstanding = roundMoney(Math.max(0, total - paid));
    if (!isFiado && paid + 0.009 < total) return send(res, 400, { message: 'O pagamento é menor que o total da venda.' });
    const responsibleName = text(req.body.fiado?.responsible_name, 180);
    if (isFiado && !responsibleName) return send(res, 400, { message: 'Informe o responsável pela venda fiada.' });
    if (isFiado && paid > total + 0.009) return send(res, 400, { message: 'O valor recebido não pode ser maior que o total em uma venda fiada.' });
    if (isFiado && outstanding < 0.01) return send(res, 400, { message: 'Não há saldo pendente para registrar como fiado.' });
    const normalizedPayments = cleanPayments.map(payment => payment.method === 'fiado' ? { method: 'fiado', amount: outstanding } : payment);
    const saleData = { seller_id:user.id, seller_name:user.full_name||user.email, status:'concluida', items, payments:normalizedPayments, subtotal, discount_value:discountValue, discount_type:discountType, total, paid_amount:paid, outstanding_amount:isFiado?outstanding:0, change_amount:isFiado?0:roundMoney(Math.max(0,paid-total)), observation:text(req.body.observation,1000), sale_type:isFiado?'fiado':'normal' };
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
      details: { total, items: items.length, sale_type: isFiado ? 'fiado' : 'normal' },
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
        SET data = jsonb_set(
          product.data,
          '{quantity}',
          to_jsonb(
            (CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END)
            - stock_source.sold_quantity
          )
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
    if (!sale) throw new AppError(409, 'SALE_NUMBER_UNAVAILABLE', 'Não foi possível reservar o número da venda. Atualize o PDV e tente novamente.');
    return send(res, 201, { id:sale.id, ...sale.data, created_date:sale.created_date, updated_date:sale.updated_date });
  }
  if (path[0] === 'sales' && path[2] === 'cancel' && req.method === 'POST') {
    const saleId = path[1];
    if (!isUuid(saleId)) return send(res, 400, { message: 'Venda inválida.' });
    const cancellationReason = text(req.body.reason, 500);
    const [sale] = await sql`
      WITH cancelled AS (
        UPDATE nexo.records SET data=data || jsonb_build_object('status','cancelada','cancellation_reason',${cancellationReason},'cancelled_by_id',${user.id},'cancelled_by_name',${user.full_name || user.email}),updated_date=now()
        WHERE id=${saleId} AND market_id=${user.market_id} AND entity='sales' AND data->>'status'='concluida' AND (${['admin','gerente'].includes(user.role)} OR data->>'seller_id'=${user.id}) RETURNING id,data
      ), stock AS (
        UPDATE nexo.records product SET data=jsonb_set(product.data,'{quantity}',to_jsonb((CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END)+source.qty)),updated_date=now()
        FROM (
          SELECT
            (item->>'product_id')::uuid id,
            SUM(
              CASE
                WHEN item->>'unit'='peso' AND item->>'weight' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (item->>'weight')::numeric
                WHEN item->>'unit'<>'peso' AND item->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (item->>'quantity')::numeric
                ELSE 0
              END
            ) qty
          FROM cancelled,jsonb_array_elements(cancelled.data->'items') item
          WHERE item->>'product_id' ~ '^[0-9a-fA-F-]{36}$'
          GROUP BY 1
        ) source
        WHERE product.id=source.id AND product.market_id=${user.market_id} AND product.entity='products'
      ), fiado AS (
        UPDATE nexo.records record
        SET data=record.data || jsonb_build_object(
          'status','cancelado',
          'cancellation_reason',${cancellationReason},
          'settled_by_id',${user.id},
          'settled_by_name',${user.full_name || user.email}
        ),updated_date=now()
        FROM cancelled
        WHERE record.market_id=${user.market_id}
          AND record.entity='fiado_records'
          AND record.data->>'sale_id'=cancelled.id::text
          AND record.data->>'status'='pendente'
        RETURNING record.id
      ), audit AS (
        INSERT INTO nexo.records(market_id,entity,data) SELECT ${user.market_id},'general_audits',jsonb_build_object('action_type','venda_cancelada','entity_type','sale','entity_id',cancelled.id,'user_id',${user.id},'user_name',${user.full_name || user.email},'description','Venda #' || (cancelled.data->>'sale_number') || ' cancelada','details',jsonb_build_object('reason',${cancellationReason},'total',cancelled.data->'total','fiado_cancelado',EXISTS(SELECT 1 FROM fiado))) FROM cancelled
      ) SELECT id,data FROM cancelled`;
    return send(res, sale ? 200 : 409, sale ? { id:sale.id,...sale.data } : { message:'A venda não existe ou já foi cancelada.' });
  }
  if (path[0] === 'sales' && path[1] && !path[2] && req.method === 'DELETE') {
    if (user.role !== 'admin') return send(res, 403, { message: 'Apenas administradores podem excluir vendas.' });
    if (!isUuid(path[1])) return send(res, 400, { message: 'Venda inválida.' });
    const [removed] = await sql`WITH deleted AS (DELETE FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='sales' AND data->>'status'='cancelada' RETURNING id,data), audit AS (INSERT INTO nexo.records(market_id,entity,data) SELECT ${user.market_id},'general_audits',jsonb_build_object('action_type','venda_excluida','entity_type','sale','entity_id',deleted.id,'user_id',${user.id},'user_name',${user.full_name || user.email},'description','Venda #' || (deleted.data->>'sale_number') || ' excluída') FROM deleted) SELECT id FROM deleted`;
    return send(res, removed ? 200 : 409, removed ? { ok:true } : { message:'Cancele a venda antes de excluí-la.' });
  }
  if (path[0] === 'stock' && path[1] === 'import' && req.method === 'POST') {
    if (!user.market_id || !['admin','gerente','vendedor'].includes(user.role)) return send(res, 403, { message: 'Sem permissão para alterar o estoque.' });
    if (!Array.isArray(req.body.products) || req.body.products.length > 5000) return send(res, 400, { message: 'Planilha inválida ou muito grande.' });
    const cleanProducts = req.body.products.map(product => {
      const clean = normalizeProductPayload(product);
      validateProductPayload(clean);
      return product.id ? { id: String(product.id), ...clean } : clean;
    });
    const ids = cleanProducts.filter(product => product.id).map(product => product.id);
    if (ids.some(id => !isUuid(id))) return send(res, 400, { message: 'A planilha contém IDs inválidos.' });
    if (ids.length) {
      const owned=await sql`SELECT id FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND id=ANY(${ids}::uuid[])`;
      if(owned.length!==new Set(ids).size)return send(res,404,{message:'A planilha contém produtos inexistentes ou de outro mercado.'});
    }
    const barcodeOwners = new Map();
    for (const product of cleanProducts) {
      if (!product.barcode) continue;
      if (barcodeOwners.has(product.barcode) && barcodeOwners.get(product.barcode) !== product.id) return send(res, 409, { message: `O código de barras ${product.barcode} aparece em mais de um produto da planilha.` });
      barcodeOwners.set(product.barcode, product.id || null);
    }
    const barcodes = [...barcodeOwners.keys()];
    if (barcodes.length) {
      const existing = await sql`SELECT id,data->>'barcode' AS barcode FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND data->>'barcode'=ANY(${barcodes})`;
      const conflict = existing.find(record => barcodeOwners.get(record.barcode) !== record.id);
      if (conflict) return send(res, 409, { message: `O código de barras ${conflict.barcode} já pertence a outro produto.` });
    }
    const payload = JSON.stringify(cleanProducts);
    await sql`WITH input AS (SELECT item FROM jsonb_array_elements(${payload}::jsonb) item), updated AS (UPDATE nexo.records record SET data=record.data || (input.item-'id'),updated_date=now() FROM input WHERE input.item?'id' AND record.id=(input.item->>'id')::uuid AND record.market_id=${user.market_id} AND record.entity='products') INSERT INTO nexo.records(market_id,entity,data) SELECT ${user.market_id},'products',item FROM input WHERE NOT item?'id'`;
    return send(res, 200, { updated: cleanProducts.length });
  }
  if (path[0] === 'entities') {
    const table = ENTITIES[path[1]];
    if (!table) return send(res, 404, { message: 'Entidade desconhecida.' });
    const id = path[2];
    if (table === 'users') {
      if (!['admin','gerente'].includes(user.role)) return send(res, 403, { message: 'Sem permissão para gerenciar usuários.' });
      if (req.method === 'GET') return send(res, 200, await sql`SELECT id,email,full_name,role,photo_url,active,created_date,updated_date FROM nexo.users WHERE market_id=${user.market_id}`);
      if (req.method === 'PATCH') {
        if (!isUuid(id)) return send(res, 400, { message: 'Usuário inválido.' });
        if (req.body.role && !USER_ROLES.includes(req.body.role)) return send(res, 400, { message: 'Perfil de usuário inválido.' });
        if (id === user.id && req.body.active === false) return send(res, 400, { message: 'Você não pode desativar o próprio acesso.' });
        const [target] = await sql`SELECT id,role FROM nexo.users WHERE id=${id} AND market_id=${user.market_id}`;
        if (!target) return send(res, 404, { message: 'Usuário não encontrado.' });
        if (user.role === 'gerente') {
          if (target.id !== user.id && target.role !== 'vendedor') return send(res, 403, { message: 'Gerentes podem alterar apenas usuários vendedores.' });
          if (req.body.role && req.body.role !== target.role) return send(res, 403, { message: 'Gerentes não podem alterar perfis de acesso.' });
          if (target.id === user.id && typeof req.body.active === 'boolean') return send(res, 403, { message: 'Gerentes não podem alterar o próprio status.' });
        }
        const fullName = req.body.full_name === undefined ? null : text(req.body.full_name, 180);
        if (req.body.full_name !== undefined && !fullName) return send(res, 400, { message: 'Nome do usuário é obrigatório.' });
        const [u] = await sql`UPDATE nexo.users SET role=COALESCE(${req.body.role || null},role),full_name=COALESCE(${fullName},full_name),photo_url=COALESCE(${req.body.photo_url === undefined ? null : text(req.body.photo_url, 2048)},photo_url),active=COALESCE(${typeof req.body.active === 'boolean' ? req.body.active : null},active),updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING id,email,full_name,role,photo_url,active`;
        return send(res, 200, u);
      }
    }
    if (table === 'markets') return send(res, 403, { message: 'Use o painel geral.' });
    if (['general_audits','product_audits'].includes(table) && !['admin','gerente'].includes(user.role) && req.method === 'GET') return send(res, 403, { message: 'Sem permissão para consultar auditorias.' });
    if (['general_audits','product_audits'].includes(table) && !['GET','POST'].includes(req.method)) return send(res, 405, { message: 'Registros de auditoria não podem ser alterados ou excluídos.' });
    if (table === 'system_configs' && !['admin','gerente'].includes(user.role) && req.method !== 'GET') return send(res, 403, { message: 'Sem permissão para alterar configurações.' });
    if (table === 'fiado_records' && req.method === 'POST') return send(res, 405, { message: 'Fiados são criados automaticamente ao concluir uma venda.' });
    if (table === 'fiado_records' && req.method === 'DELETE') return send(res, 405, { message: 'Fiados devem ser quitados ou cancelados, não excluídos.' });
    if (table === 'products' && req.method === 'DELETE' && !['admin','gerente'].includes(user.role)) return send(res, 403, { message: 'Sem permissão para excluir produtos.' });
    if (table === 'system_configs' && req.method === 'DELETE') return send(res, 405, { message: 'Configurações não podem ser excluídas por esta operação.' });
    if (table === 'sales' && ['POST','PATCH','DELETE'].includes(req.method)) return send(res, 405, { message: 'Use as operações próprias de vendas.' });
    if (req.method === 'GET' && id) { if (!isUuid(id)) return send(res, 400, { message: 'Identificador inválido.' }); const rows = await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity=${table}`; const record=rows[0]?{id:rows[0].id,...rows[0].data,created_date:rows[0].created_date,updated_date:rows[0].updated_date}:null; if(record&&user.role==='vendedor'&&['sales','fiado_records'].includes(table)&&record.seller_id!==user.id)return send(res,403,{message:'Sem permissão para acessar este registro.'}); return send(res,record?200:404,record||{message:'Registro não encontrado.'}); }
    if (req.method === 'GET') {
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 500, 1000)); const rows = await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${user.market_id} AND entity=${table} ORDER BY updated_date DESC LIMIT ${limit}`;
      let out = rows.map(r => ({ id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date }));
      if (user.role === 'vendedor' && ['sales','fiado_records'].includes(table)) out=out.filter(record=>record.seller_id===user.id);
      if (req.query.filters) { const f=JSON.parse(req.query.filters); out=out.filter(r=>Object.entries(f).every(([k,v])=>matchesFilter(r,k,v))); }
      const sort=req.query.sort; if(sort){const desc=sort.startsWith('-'),key=sort.replace(/^-/,'');out.sort((a,b)=>(a[key]>b[key]?1:-1)*(desc?-1:1));}
      return send(res, 200, out);
    }
    if (req.method === 'POST') {
      let recordPayload = req.body;
      if (table === 'products') {
        recordPayload = normalizeProductPayload(req.body);
        validateProductPayload(recordPayload);
        await assertProductBarcodeAvailable(sql, user.market_id, recordPayload.barcode);
      }
      if (['general_audits','product_audits'].includes(table)) recordPayload = normalizeAuditPayload(req.body, user, table);
      if (table === 'system_configs') {
        recordPayload = { key: text(req.body.key, 100), value: text(req.body.value, 5000) };
        if (!recordPayload.key) return send(res, 400, { message: 'Chave de configuração inválida.' });
        const [existing]=await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(recordPayload)}::jsonb,updated_date=now() WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key'=${recordPayload.key} RETURNING id,data,created_date,updated_date`;
        if(existing)return send(res,200,{id:existing.id,...existing.data,created_date:existing.created_date,updated_date:existing.updated_date});
      }
      const [r]=await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(${user.market_id},${table},${JSON.stringify(recordPayload)}::jsonb) RETURNING id,data,created_date,updated_date`;
      return send(res,201,{id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date});
    }
    if (table === 'fiado_records' && req.method === 'PATCH') {
      if (!isUuid(id)) return send(res, 400, { message: 'Identificador inválido.' });
      const allowedFields = new Set(['status','settlement_date','settlement_method','settled_by_id','settled_by_name','cancellation_reason']);
      const invalidFields = Object.keys(req.body || {}).filter(key => !allowedFields.has(key));
      if (invalidFields.length) return send(res, 400, { message: 'A alteração contém campos não permitidos.' });
      if (!['quitado','cancelado'].includes(req.body.status)) return send(res, 400, { message: 'O fiado só pode ser quitado ou cancelado.' });
      if (req.body.status === 'quitado' && !['dinheiro','pix','debito','credito','outros'].includes(req.body.settlement_method)) return send(res, 400, { message: 'Forma de quitação inválida.' });
      const sellerOnly = user.role === 'vendedor';
      const [current] = await sql`SELECT id,data FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity='fiado_records' AND (${!sellerOnly} OR data->>'seller_id'=${user.id})`;
      if (!current) return send(res, 404, { message: 'Fiado não encontrado ou sem permissão.' });
      if (current.data.status !== 'pendente') return send(res, 409, { message: 'Somente fiados pendentes podem ser quitados ou cancelados.' });
      const fiadoUpdate = {
        status: req.body.status,
        settled_by_id: user.id,
        settled_by_name: user.full_name || user.email,
        ...(req.body.status === 'quitado' ? { settlement_date: new Date().toISOString(), settlement_method: req.body.settlement_method } : { cancellation_reason: text(req.body.cancellation_reason, 500) }),
      };
      const [r] = await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(fiadoUpdate)}::jsonb,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND entity='fiado_records' RETURNING id,data,created_date,updated_date`;
      return send(res, 200, { id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date });
    }
    if (req.method === 'PATCH') {
      if (!isUuid(id)) return send(res, 400, { message: 'Identificador inválido.' });
      let recordPayload = req.body;
      if (table === 'products') {
        recordPayload = normalizeProductPayload(req.body, true);
        validateProductPayload(recordPayload, true);
        if (recordPayload.barcode !== undefined) await assertProductBarcodeAvailable(sql, user.market_id, recordPayload.barcode, id);
      }
      if (table === 'system_configs') recordPayload = { value: text(req.body.value, 5000) };
      const [r]=await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(recordPayload)}::jsonb,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND entity=${table} RETURNING id,data,created_date,updated_date`;
      return send(res,r?200:404,r?{id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date}:{message:'Registro não encontrado.'});
    }
    if (req.method === 'DELETE') { if (!isUuid(id)) return send(res, 400, { message: 'Identificador inválido.' }); await sql`DELETE FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity=${table}`; return send(res,200,{ok:true}); }
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
