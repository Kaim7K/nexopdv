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
import { handleError, methodNotAllowed, readJsonBody, send } from '../server/http.js';
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
}

async function routeHandler(req, res) {
  const sql = getDb();
  const requestUrl = new URL(req.url, 'http://localhost');
  req.query = { ...Object.fromEntries(requestUrl.searchParams.entries()), ...(req.query || {}) };
  const routedPath = req.query.path || requestUrl.pathname.replace(/^\/api(?:\/index)?/, '');
  const path = String(routedPath || '/').split('/').filter(Boolean);
  req.body = await readJsonBody(req);

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
      if (!req.body.name?.trim() || !/^[a-z0-9-]+$/.test(req.body.slug || '')) return send(res, 400, { message: 'Nome ou identificador inválido.' });
      if (!/^\S+@\S+\.\S+$/.test(req.body.admin_email || '') || (req.body.admin_password || '').length < 8) return send(res, 400, { message: 'Email ou senha inicial inválidos.' });
      const modules = req.body.enabled_modules || ['pdv','estoque','vendas','fiados','relatorios','auditoria','usuarios','configuracoes'];
      if (!Array.isArray(modules) || modules.some(module => !MARKET_MODULES.includes(module))) return send(res, 400, { message: 'Módulos inválidos.' });
      const hash = await bcrypt.hash(req.body.admin_password, 12);
      const [market] = await sql`WITH market AS (INSERT INTO nexo.markets(name,slug,logo_url,primary_color,secondary_color,enabled_modules) VALUES(${req.body.name.trim()},${req.body.slug},${req.body.logo_url || ''},${req.body.primary_color || '#16a06a'},${req.body.secondary_color || '#0f5132'},${JSON.stringify(modules)}::jsonb) RETURNING *), admin AS (INSERT INTO nexo.users(market_id,email,password_hash,full_name,role) SELECT id,${String(req.body.admin_email).trim().toLowerCase()},${hash},${String(req.body.admin_name || 'Administrador').trim() || 'Administrador'},'admin' FROM market) SELECT * FROM market`;
      return send(res, 201, market);
    }
    if (req.method === 'PATCH') {
      const id = path[1], b = req.body;
      if (!isUuid(id)) return send(res, 400, { message: 'Mercado inválido.' });
      if (b.enabled_modules && (!Array.isArray(b.enabled_modules) || b.enabled_modules.some(module => !MARKET_MODULES.includes(module)))) return send(res, 400, { message: 'Módulos inválidos.' });
      const [market] = await sql`UPDATE nexo.markets SET name=COALESCE(${b.name || null},name), logo_url=COALESCE(${b.logo_url ?? null},logo_url), primary_color=COALESCE(${b.primary_color || null},primary_color), secondary_color=COALESCE(${b.secondary_color || null},secondary_color), enabled_modules=COALESCE(${b.enabled_modules ? JSON.stringify(b.enabled_modules) : null}::jsonb,enabled_modules), active=COALESCE(${typeof b.active === 'boolean' ? b.active : null},active), updated_date=now() WHERE id=${id} RETURNING *`;
      return send(res, market ? 200 : 404, market || { message: 'Mercado não encontrado.' });
    }
  }
  if (path[0] === 'users' && req.method === 'POST') {
    if (!['admin','super_admin','gerente'].includes(user.role)) return send(res, 403, { message: 'Sem permissão.' });
    if (!user.market_id) return send(res, 400, { message: 'Selecione um mercado para criar usuários.' });
    if (!req.body.email || !/^\S+@\S+\.\S+$/.test(req.body.email)) return send(res, 400, { message: 'Informe um email válido.' });
    if (!req.body.password || req.body.password.length < 8) return send(res, 400, { message: 'A senha deve ter ao menos 8 caracteres.' });
    if (req.body.role && !USER_ROLES.includes(req.body.role)) return send(res, 400, { message: 'Perfil de usuário inválido.' });
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
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const payments = Array.isArray(req.body.payments) ? req.body.payments : [];
    if (!items.length) return send(res, 400, { message: 'A venda não possui itens.' });
    if (items.some(item => !isUuid(item.product_id) || Number(item.quantity || item.weight) <= 0 || Number(item.unit_price) < 0 || Number(item.subtotal) < 0)) return send(res, 400, { message: 'Há itens inválidos na venda. Remova e adicione o produto novamente.' });
    if (payments.some(payment => !payment.method || Number(payment.amount || 0) < 0)) return send(res, 400, { message: 'Há pagamentos inválidos na venda.' });
    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const discountValue = Math.max(0, Number(req.body.discount_value || 0));
    const discount = req.body.discount_type === 'percentual' ? subtotal * Math.min(discountValue, 100) / 100 : Math.min(discountValue, subtotal);
    const total = Math.max(0, subtotal - discount);
    const isFiado = req.body.sale_type === 'fiado';
    const paid = payments.filter(payment => payment.method !== 'fiado').reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0);
    if (!isFiado && paid + 0.009 < total) return send(res, 400, { message: 'O pagamento é menor que o total da venda.' });
    if (isFiado && !req.body.fiado?.responsible_name?.trim()) return send(res, 400, { message: 'Informe o responsável pela venda fiada.' });
    const saleData = { seller_id:user.id, seller_name:user.full_name||user.email, status:'concluida', items, payments, subtotal, discount_value:discountValue, discount_type:req.body.discount_type||'valor', total, paid_amount:paid, change_amount:Math.max(0,paid-total), observation:req.body.observation||'', sale_type:isFiado?'fiado':'normal' };
    const productIds = [...new Set(items.map(item => item.product_id))];
    const ownedProducts = await sql`SELECT id FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND id=ANY(${productIds}::uuid[])`;
    if (ownedProducts.length !== productIds.length) return send(res, 409, { message: 'A venda possui produto inexistente ou de outro mercado. Atualize o PDV e tente novamente.' });
    const [number] = await sql`
      UPDATE nexo.markets
      SET next_sale_number = next_sale_number + 1
      WHERE id = ${user.market_id}
      RETURNING next_sale_number - 1 AS value
    `;
    if (!number) throw new AppError(409, 'SALE_NUMBER_UNAVAILABLE', 'Não foi possível reservar o número da venda. Atualize o PDV e tente novamente.');

    const salePayload = { ...saleData, sale_number: Number(number.value) };
    const [sale] = await sql`
      INSERT INTO nexo.records(market_id, entity, data)
      VALUES (${user.market_id}, 'sales', ${JSON.stringify(salePayload)}::jsonb)
      RETURNING id, data, created_date, updated_date
    `;

    for (const item of items) {
      const soldQuantity = item.unit === 'peso' ? Number(item.weight || 0) : Number(item.quantity || 0);
      await sql`
        UPDATE nexo.records
        SET data = jsonb_set(
          data,
          '{quantity}',
          to_jsonb(
            CASE
              WHEN data->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (data->>'quantity')::numeric
              ELSE 0
            END - ${soldQuantity}
          )
        ),
        updated_date = now()
        WHERE id = ${item.product_id}
          AND market_id = ${user.market_id}
          AND entity = 'products'
      `;
    }

    if (isFiado) {
      await sql`
        INSERT INTO nexo.records(market_id, entity, data)
        VALUES (${user.market_id}, 'fiado_records', ${JSON.stringify({
          sale_id: sale.id,
          sale_number: salePayload.sale_number,
          responsible_name: req.body.fiado?.responsible_name || '',
          phone: req.body.fiado?.phone || '',
          observation: req.body.fiado?.observation || '',
          total_amount: total,
          seller_id: user.id,
          seller_name: user.full_name || user.email,
          status: 'pendente',
        })}::jsonb)
      `;
    }

    await sql`
      INSERT INTO nexo.records(market_id, entity, data)
      VALUES (${user.market_id}, 'general_audits', ${JSON.stringify({
        action_type: 'venda_concluida',
        entity_type: 'sale',
        entity_id: sale.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        description: `Venda #${salePayload.sale_number} concluída`,
        details: { total, items: items.length, sale_type: isFiado ? 'fiado' : 'normal' },
      })}::jsonb)
    `;
    return send(res, 201, { id:sale.id, ...sale.data, created_date:sale.created_date, updated_date:sale.updated_date });
  }
  if (path[0] === 'sales' && path[2] === 'cancel' && req.method === 'POST') {
    const saleId = path[1];
    if (!isUuid(saleId)) return send(res, 400, { message: 'Venda inválida.' });
    const [sale] = await sql`
      WITH cancelled AS (
        UPDATE nexo.records SET data=data || jsonb_build_object('status','cancelada','cancellation_reason',${req.body.reason || ''},'cancelled_by_id',${user.id},'cancelled_by_name',${user.full_name || user.email}),updated_date=now()
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
      ), audit AS (
        INSERT INTO nexo.records(market_id,entity,data) SELECT ${user.market_id},'general_audits',jsonb_build_object('action_type','venda_cancelada','entity_type','sale','entity_id',cancelled.id,'user_id',${user.id},'user_name',${user.full_name || user.email},'description','Venda #' || (cancelled.data->>'sale_number') || ' cancelada','details',jsonb_build_object('reason',${req.body.reason || ''},'total',cancelled.data->'total')) FROM cancelled
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
    for (const product of req.body.products) if (!product.name?.trim() || Number(product.sale_price) < 0 || Number(product.quantity) < 0) return send(res, 400, { message: `Produto inválido: ${product.name || 'sem nome'}.` });
    const ids = req.body.products.filter(product => product.id).map(product => String(product.id));
    if (ids.some(id => !isUuid(id))) return send(res, 400, { message: 'A planilha contém IDs inválidos.' });
    if (ids.length) { const owned=await sql`SELECT id FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND id=ANY(${ids}::uuid[])`; if(owned.length!==new Set(ids).size)return send(res,404,{message:'A planilha contém produtos inexistentes ou de outro mercado.'}); }
    const payload = JSON.stringify(req.body.products);
    await sql`WITH input AS (SELECT item FROM jsonb_array_elements(${payload}::jsonb) item), updated AS (UPDATE nexo.records record SET data=record.data || (input.item-'id'),updated_date=now() FROM input WHERE input.item?'id' AND record.id=(input.item->>'id')::uuid AND record.market_id=${user.market_id} AND record.entity='products') INSERT INTO nexo.records(market_id,entity,data) SELECT ${user.market_id},'products',item FROM input WHERE NOT item?'id'`;
    return send(res, 200, { updated: req.body.products?.length || 0 });
  }
  if (path[0] === 'entities') {
    const table = ENTITIES[path[1]];
    if (!table) return send(res, 404, { message: 'Entidade desconhecida.' });
    const id = path[2];
    if (table === 'users') {
      if (!['admin','gerente'].includes(user.role)) return send(res, 403, { message: 'Sem permissão para gerenciar usuários.' });
      if (req.method === 'GET') return send(res, 200, await sql`SELECT id,email,full_name,role,photo_url,active,created_date,updated_date FROM nexo.users WHERE market_id=${user.market_id}`);
      if (req.method === 'PATCH') { if (!isUuid(id)) return send(res, 400, { message: 'Usuário inválido.' }); if (req.body.role && !USER_ROLES.includes(req.body.role)) return send(res, 400, { message: 'Perfil de usuário inválido.' }); const fullName = req.body.full_name === undefined ? null : String(req.body.full_name).trim(); const [u] = await sql`UPDATE nexo.users SET role=COALESCE(${req.body.role || null},role),full_name=COALESCE(${fullName || null},full_name),photo_url=COALESCE(${req.body.photo_url ?? null},photo_url),active=COALESCE(${typeof req.body.active === 'boolean' ? req.body.active : null},active),updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING id,email,full_name,role,photo_url,active`; return send(res, u ? 200 : 404, u || { message:'Usuário não encontrado.' }); }
    }
    if (table === 'markets') return send(res, 403, { message: 'Use o painel geral.' });
    if (['general_audits','product_audits'].includes(table) && !['admin','gerente'].includes(user.role) && req.method === 'GET') return send(res, 403, { message: 'Sem permissão para consultar auditorias.' });
    if (table === 'system_configs' && !['admin','gerente'].includes(user.role) && req.method !== 'GET') return send(res, 403, { message: 'Sem permissão para alterar configurações.' });
    if (table === 'sales' && ['POST','PATCH','DELETE'].includes(req.method)) return send(res, 405, { message: 'Use as operações próprias de vendas.' });
    if (req.method === 'GET' && id) { if (!isUuid(id)) return send(res, 400, { message: 'Identificador inválido.' }); const rows = await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity=${table}`; const record=rows[0]?{id:rows[0].id,...rows[0].data,created_date:rows[0].created_date,updated_date:rows[0].updated_date}:null; if(record&&user.role==='vendedor'&&['sales','fiado_records'].includes(table)&&record.seller_id!==user.id)return send(res,403,{message:'Sem permissão para acessar este registro.'}); return send(res,record?200:404,record||{message:'Registro não encontrado.'}); }
    if (req.method === 'GET') {
      const limit = Math.min(Number(req.query.limit) || 500, 1000); const rows = await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${user.market_id} AND entity=${table} ORDER BY updated_date DESC LIMIT ${limit}`;
      let out = rows.map(r => ({ id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date }));
      if (user.role === 'vendedor' && ['sales','fiado_records'].includes(table)) out=out.filter(record=>record.seller_id===user.id);
      if (req.query.filters) { const f=JSON.parse(req.query.filters); out=out.filter(r=>Object.entries(f).every(([k,v])=>matchesFilter(r,k,v))); }
      const sort=req.query.sort; if(sort){const desc=sort.startsWith('-'),key=sort.replace(/^-/,'');out.sort((a,b)=>(a[key]>b[key]?1:-1)*(desc?-1:1));}
      return send(res, 200, out);
    }
    if (req.method === 'POST') {
      if (table === 'products') validateProductPayload(req.body);
      if (table === 'system_configs' && req.body.key) { const [existing]=await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(req.body)}::jsonb,updated_date=now() WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key'=${req.body.key} RETURNING id,data,created_date,updated_date`; if(existing)return send(res,200,{id:existing.id,...existing.data,created_date:existing.created_date,updated_date:existing.updated_date}); }
      const [r]=await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(${user.market_id},${table},${JSON.stringify(req.body)}::jsonb) RETURNING id,data,created_date,updated_date`; return send(res,201,{id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date});
    }
    if (req.method === 'PATCH') { if (!isUuid(id)) return send(res, 400, { message: 'Identificador inválido.' }); if (table === 'products') validateProductPayload(req.body, true); const sellerOnly=table==='fiado_records'&&user.role==='vendedor'; const [r]=await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(req.body)}::jsonb,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND entity=${table} AND (${!sellerOnly} OR data->>'seller_id'=${user.id}) RETURNING id,data,created_date,updated_date`; return send(res,r?200:404,r?{id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date}:{message:'Registro não encontrado ou sem permissão.'}); }
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
