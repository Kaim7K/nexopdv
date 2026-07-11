import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const ENTITIES = {
  Product: 'products', Sale: 'sales', FiadoRecord: 'fiado_records', GeneralAudit: 'general_audits',
  ProductAudit: 'product_audits', SystemConfig: 'system_configs', User: 'users', Market: 'markets',
};
const DEFAULT_MODULES = ['pdv','estoque','vendas','fiados','relatorios','auditoria','usuarios','configuracoes'];
let schemaInitialization = null;

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || '');
const cookie = (req, name) => {
  const entry = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
};
const send = (res, status, data) => res.status(status).json(data);

const withStage = async (stage, operation) => {
  try {
    return await operation();
  } catch (error) {
    error.nexoStage = stage;
    throw error;
  }
};

async function prepareSchema(sql) {
  // As tabelas são criadas sem chaves estrangeiras no bootstrap para não quebrar
  // bancos que já possuam tabelas homônimas de uma versão anterior do projeto.
  await withStage('create_markets', () => sql`CREATE TABLE IF NOT EXISTS markets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), market_id uuid, name text NOT NULL, slug text UNIQUE NOT NULL, logo_url text, primary_color text DEFAULT '#16a06a', secondary_color text DEFAULT '#0f5132', enabled_modules jsonb DEFAULT '["pdv","estoque","vendas","fiados","relatorios","auditoria","usuarios","configuracoes"]', active boolean DEFAULT true, next_sale_number bigint NOT NULL DEFAULT 1, created_date timestamptz DEFAULT now(), updated_date timestamptz DEFAULT now())`);
  await withStage('create_users', () => sql`CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), market_id uuid, email text UNIQUE NOT NULL, password_hash text NOT NULL, full_name text, role text DEFAULT 'vendedor', photo_url text, active boolean DEFAULT true, created_date timestamptz DEFAULT now(), updated_date timestamptz DEFAULT now())`);
  await withStage('create_records', () => sql`CREATE TABLE IF NOT EXISTS records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), market_id uuid, entity text NOT NULL, data jsonb NOT NULL DEFAULT '{}', created_date timestamptz DEFAULT now(), updated_date timestamptz DEFAULT now())`);

  // CREATE TABLE IF NOT EXISTS não adiciona colunas ausentes. Estas migrações
  // deixam o login compatível com bancos criados por versões anteriores.
  await withStage('migrate_markets', async () => {
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS market_id uuid`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS name text`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS slug text`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS logo_url text`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#16a06a'`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#0f5132'`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS enabled_modules jsonb DEFAULT '["pdv","estoque","vendas","fiados","relatorios","auditoria","usuarios","configuracoes"]'`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS active boolean DEFAULT true`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS next_sale_number bigint DEFAULT 1`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now()`;
    await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS updated_date timestamptz DEFAULT now()`;
  });

  await withStage('migrate_users', async () => {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS market_id uuid`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'vendedor'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean DEFAULT true`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now()`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_date timestamptz DEFAULT now()`;
  });

  await withStage('migrate_records', async () => {
    await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS market_id uuid`;
    await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS entity text`;
    await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'`;
    await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now()`;
    await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS updated_date timestamptz DEFAULT now()`;
    await sql`CREATE INDEX IF NOT EXISTS records_market_entity_idx ON records(market_id, entity)`;
  });

  if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
    await withStage('create_super_admin', async () => {
      const email = process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
      const existing = await sql`SELECT id FROM users WHERE lower(email)=lower(${email}) LIMIT 1`;
      if (!existing.length) {
        const hash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 12);
        await sql`INSERT INTO users(email,password_hash,full_name,role,active) VALUES(${email},${hash},'Administrador Nexo','super_admin',true)`;
      }
    });
  }
}

async function init(sql) {
  if (!schemaInitialization) {
    schemaInitialization = prepareSchema(sql).catch(error => {
      schemaInitialization = null;
      throw error;
    });
  }
  return schemaInitialization;
}

async function currentUser(req, sql) {
  const token = cookie(req, 'nexo_session');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const rows = await sql`SELECT u.id,u.email,u.full_name,u.role,u.photo_url,u.market_id,m.name market_name,m.logo_url,m.primary_color,m.secondary_color,m.enabled_modules FROM users u LEFT JOIN markets m ON m.id=u.market_id WHERE u.id=${payload.sub} AND u.active=true AND (u.role='super_admin' OR m.active=true)`;
    return rows[0] || null;
  } catch { return null; }
}

async function routeHandler(req, res) {
  const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^['"]|['"]$/g, '');
  if (!databaseUrl) return send(res, 503, { code: 'DATABASE_URL_MISSING', message: 'Configure DATABASE_URL na Vercel.' });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return send(res, 503, { message: 'Configure JWT_SECRET com pelo menos 32 caracteres.' });
  const sql = neon(databaseUrl);
  const routedPath = req.query.path || req.url.split('?')[0].replace(/^\/api(?:\/index)?/, '');
  const path = String(routedPath || '/').split('/').filter(Boolean);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (path[0] === 'health') {
    await sql`SELECT 1 AS connected`;
    await init(sql);
    const [counts] = await sql`SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM markets) AS markets`;
    return send(res, 200, {
      ok: true,
      database: 'connected',
      schema: 'ready',
      jwt: 'configured',
      superAdmin: Boolean(process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD),
      counts,
    });
  }
  await init(sql);

  if (path[0] === 'auth' && path[1] === 'login' && req.method === 'POST') {
    const rows = await sql`SELECT * FROM users WHERE lower(email)=lower(${body.email || ''}) AND active=true`;
    const user = rows[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(body.password || '', user.password_hash))) return send(res, 401, { message: 'Email ou senha inválidos.' });
    const token = await new SignJWT({ role: user.role, market_id: user.market_id }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(user.id)).setExpirationTime('12h').sign(secret());
    res.setHeader('Set-Cookie', `nexo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`);
    return send(res, 200, { ok: true });
  }
  if (path[0] === 'auth' && path[1] === 'logout') { res.setHeader('Set-Cookie', 'nexo_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax'); return send(res, 200, { ok: true }); }
  const user = await currentUser(req, sql);
  if (!user) return send(res, 401, { message: 'Sessão expirada.' });
  if (path[0] === 'auth' && path[1] === 'me') return send(res, 200, user);
  const entityModules = { Sale:'vendas', FiadoRecord:'fiados', User:'usuarios' };
  const requiredModule = path[0] === 'stock' ? 'estoque' : path[0] === 'sales' ? (path[1] === 'complete' ? 'pdv' : 'vendas') : path[0] === 'users' ? 'usuarios' : path[0] === 'entities' ? entityModules[path[1]] : null;
  if (user.role !== 'super_admin' && requiredModule && !(user.enabled_modules || []).includes(requiredModule)) return send(res, 403, { message: 'Esta funcionalidade não está habilitada para o mercado.' });
  if (user.role !== 'super_admin' && path[0] === 'entities' && path[1] === 'Product' && !['pdv','estoque'].some(module => (user.enabled_modules || []).includes(module))) return send(res, 403, { message: 'Produtos não estão habilitados para o mercado.' });

  if (path[0] === 'markets') {
    if (user.role !== 'super_admin') return send(res, 403, { message: 'Acesso restrito.' });
    if (req.method === 'GET') return send(res, 200, await sql`SELECT id,name,slug,logo_url,primary_color,secondary_color,enabled_modules,active,created_date FROM markets ORDER BY name`);
    if (req.method === 'POST') {
      if (!body.name?.trim() || !/^[a-z0-9-]+$/.test(body.slug || '')) return send(res, 400, { message: 'Nome ou identificador inválido.' });
      if (!/^\S+@\S+\.\S+$/.test(body.admin_email || '') || (body.admin_password || '').length < 8) return send(res, 400, { message: 'Email ou senha inicial inválidos.' });
      const modules = body.enabled_modules || DEFAULT_MODULES;
      const hash = await bcrypt.hash(body.admin_password, 12);
      const [market] = await sql`WITH market AS (INSERT INTO markets(name,slug,logo_url,primary_color,secondary_color,enabled_modules) VALUES(${body.name.trim()},${body.slug},${body.logo_url || ''},${body.primary_color || '#16a06a'},${body.secondary_color || '#0f5132'},${JSON.stringify(modules)}::jsonb) RETURNING *), admin AS (INSERT INTO users(market_id,email,password_hash,full_name,role) SELECT id,${body.admin_email.toLowerCase()},${hash},${body.admin_name || 'Administrador'},'admin' FROM market) SELECT * FROM market`;
      return send(res, 201, market);
    }
    if (req.method === 'PATCH') {
      const id = path[1], b = body;
      const [market] = await sql`UPDATE markets SET name=COALESCE(${b.name || null},name), logo_url=COALESCE(${b.logo_url ?? null},logo_url), primary_color=COALESCE(${b.primary_color || null},primary_color), secondary_color=COALESCE(${b.secondary_color || null},secondary_color), enabled_modules=COALESCE(${b.enabled_modules ? JSON.stringify(b.enabled_modules) : null}::jsonb,enabled_modules), active=COALESCE(${typeof b.active === 'boolean' ? b.active : null},active), updated_date=now() WHERE id=${id} RETURNING *`;
      return send(res, 200, market);
    }
  }
  if (path[0] === 'users' && req.method === 'POST') {
    if (!['admin','super_admin','gerente'].includes(user.role)) return send(res, 403, { message: 'Sem permissão.' });
    if (!user.market_id) return send(res, 400, { message: 'Selecione um mercado para criar usuários.' });
    if (!body.email || !/^\S+@\S+\.\S+$/.test(body.email)) return send(res, 400, { message: 'Informe um email válido.' });
    if (!body.password || body.password.length < 8) return send(res, 400, { message: 'A senha deve ter ao menos 8 caracteres.' });
    const hash = await bcrypt.hash(body.password, 12);
    const [created] = await sql`INSERT INTO users(market_id,email,password_hash,full_name,role) VALUES(${user.market_id},${body.email},${hash},${body.full_name || body.email},${body.role || 'vendedor'}) RETURNING id,email,full_name,role`;
    return send(res, 201, created);
  }
  if (path[0] === 'sales' && path[1] === 'next' && req.method === 'GET') {
    const rows=await sql`SELECT next_sale_number FROM markets WHERE id=${user.market_id}`;
    return send(res,rows[0]?200:404,rows[0]?{sale_number:Number(rows[0].next_sale_number)}:{message:'Mercado não encontrado.'});
  }
  if (path[0] === 'sales' && path[1] === 'complete' && req.method === 'POST') {
    if (!user.market_id) return send(res, 400, { message: 'Usuário sem mercado.' });
    const items = Array.isArray(body.items) ? body.items : [];
    const payments = Array.isArray(body.payments) ? body.payments : [];
    if (!items.length) return send(res, 400, { message: 'A venda não possui itens.' });
    if (items.some(item => !item.product_id || Number(item.quantity || item.weight) <= 0 || Number(item.unit_price) < 0)) return send(res, 400, { message: 'Há itens inválidos na venda.' });
    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const discountValue = Math.max(0, Number(body.discount_value || 0));
    const discount = body.discount_type === 'percentual' ? subtotal * Math.min(discountValue, 100) / 100 : Math.min(discountValue, subtotal);
    const total = Math.max(0, subtotal - discount);
    const isFiado = body.sale_type === 'fiado';
    const paid = payments.filter(payment => payment.method !== 'fiado').reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0);
    if (!isFiado && paid + 0.009 < total) return send(res, 400, { message: 'O pagamento é menor que o total da venda.' });
    if (isFiado && !body.fiado?.responsible_name?.trim()) return send(res, 400, { message: 'Informe o responsável pela venda fiada.' });
    const saleData = { seller_id:user.id, seller_name:user.full_name||user.email, status:'concluida', items, payments, subtotal, discount_value:discountValue, discount_type:body.discount_type||'valor', total, paid_amount:paid, change_amount:Math.max(0,paid-total), observation:body.observation||'', sale_type:isFiado?'fiado':'normal' };
    const [sale] = await sql`
      WITH number AS (
        UPDATE markets SET next_sale_number=next_sale_number+1 WHERE id=${user.market_id} RETURNING next_sale_number-1 AS value
      ), inserted AS (
        INSERT INTO records(market_id,entity,data)
        SELECT ${user.market_id},'sales',${JSON.stringify(saleData)}::jsonb || jsonb_build_object('sale_number',number.value) FROM number
        RETURNING id,data,created_date,updated_date
      ), stock AS (
        UPDATE records product SET data=jsonb_set(product.data,'{quantity}',to_jsonb(COALESCE((product.data->>'quantity')::numeric,0)-source.qty))
        FROM (SELECT (item->>'product_id')::uuid id, SUM(CASE WHEN item->>'unit'='peso' THEN (item->>'weight')::numeric ELSE (item->>'quantity')::numeric END) qty FROM jsonb_array_elements(${JSON.stringify(items)}::jsonb) item GROUP BY 1) source
        WHERE product.id=source.id AND product.market_id=${user.market_id} AND product.entity='products'
      ), debt AS (
        INSERT INTO records(market_id,entity,data)
        SELECT ${user.market_id},'fiado_records',jsonb_build_object('sale_id',inserted.id,'sale_number',inserted.data->'sale_number','responsible_name',${body.fiado?.responsible_name || ''},'phone',${body.fiado?.phone || ''},'observation',${body.fiado?.observation || ''},'total_amount',${total},'seller_id',${user.id},'seller_name',${user.full_name || user.email},'status','pendente') FROM inserted WHERE ${isFiado}
      ), audit AS (
        INSERT INTO records(market_id,entity,data)
        SELECT ${user.market_id},'general_audits',jsonb_build_object('action_type','venda_concluida','entity_type','sale','entity_id',inserted.id,'user_id',${user.id},'user_name',${user.full_name || user.email},'description','Venda #' || (inserted.data->>'sale_number') || ' concluída','details',jsonb_build_object('total',${total},'items',${items.length},'sale_type',${isFiado ? 'fiado' : 'normal'})) FROM inserted
      ) SELECT id,data,created_date,updated_date FROM inserted`;
    return send(res, 201, { id:sale.id, ...sale.data, created_date:sale.created_date, updated_date:sale.updated_date });
  }
  if (path[0] === 'sales' && path[2] === 'cancel' && req.method === 'POST') {
    const saleId = path[1];
    const [sale] = await sql`
      WITH cancelled AS (
        UPDATE records SET data=data || jsonb_build_object('status','cancelada','cancellation_reason',${body.reason || ''},'cancelled_by_id',${user.id},'cancelled_by_name',${user.full_name || user.email}),updated_date=now()
        WHERE id=${saleId} AND market_id=${user.market_id} AND entity='sales' AND data->>'status'='concluida' AND (${['admin','gerente'].includes(user.role)} OR data->>'seller_id'=${user.id}) RETURNING id,data
      ), stock AS (
        UPDATE records product SET data=jsonb_set(product.data,'{quantity}',to_jsonb(COALESCE((product.data->>'quantity')::numeric,0)+source.qty))
        FROM (SELECT (item->>'product_id')::uuid id,SUM(CASE WHEN item->>'unit'='peso' THEN (item->>'weight')::numeric ELSE (item->>'quantity')::numeric END) qty FROM cancelled,jsonb_array_elements(cancelled.data->'items') item GROUP BY 1) source
        WHERE product.id=source.id AND product.market_id=${user.market_id} AND product.entity='products'
      ), audit AS (
        INSERT INTO records(market_id,entity,data) SELECT ${user.market_id},'general_audits',jsonb_build_object('action_type','venda_cancelada','entity_type','sale','entity_id',cancelled.id,'user_id',${user.id},'user_name',${user.full_name || user.email},'description','Venda #' || (cancelled.data->>'sale_number') || ' cancelada','details',jsonb_build_object('reason',${body.reason || ''},'total',cancelled.data->'total')) FROM cancelled
      ) SELECT id,data FROM cancelled`;
    return send(res, sale ? 200 : 409, sale ? { id:sale.id,...sale.data } : { message:'A venda não existe ou já foi cancelada.' });
  }
  if (path[0] === 'sales' && path[1] && !path[2] && req.method === 'DELETE') {
    if (user.role !== 'admin') return send(res, 403, { message: 'Apenas administradores podem excluir vendas.' });
    const [removed] = await sql`WITH deleted AS (DELETE FROM records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='sales' AND data->>'status'='cancelada' RETURNING id,data), audit AS (INSERT INTO records(market_id,entity,data) SELECT ${user.market_id},'general_audits',jsonb_build_object('action_type','venda_excluida','entity_type','sale','entity_id',deleted.id,'user_id',${user.id},'user_name',${user.full_name || user.email},'description','Venda #' || (deleted.data->>'sale_number') || ' excluída') FROM deleted) SELECT id FROM deleted`;
    return send(res, removed ? 200 : 409, removed ? { ok:true } : { message:'Cancele a venda antes de excluí-la.' });
  }
  if (path[0] === 'stock' && path[1] === 'import' && req.method === 'POST') {
    if (!user.market_id || !['admin','gerente','vendedor'].includes(user.role)) return send(res, 403, { message: 'Sem permissão para alterar o estoque.' });
    if (!Array.isArray(body.products) || body.products.length > 5000) return send(res, 400, { message: 'Planilha inválida ou muito grande.' });
    for (const product of body.products) if (!product.name?.trim() || Number(product.sale_price) < 0 || Number(product.quantity) < 0) return send(res, 400, { message: `Produto inválido: ${product.name || 'sem nome'}.` });
    const ids = body.products.filter(product => product.id).map(product => product.id);
    if (ids.length) { const owned=await sql`SELECT id FROM records WHERE market_id=${user.market_id} AND entity='products' AND id=ANY(${ids}::uuid[])`; if(owned.length!==new Set(ids).size)return send(res,404,{message:'A planilha contém produtos inexistentes ou de outro mercado.'}); }
    const payload = JSON.stringify(body.products);
    await sql`WITH input AS (SELECT item FROM jsonb_array_elements(${payload}::jsonb) item), updated AS (UPDATE records record SET data=record.data || (input.item-'id'),updated_date=now() FROM input WHERE input.item?'id' AND record.id=(input.item->>'id')::uuid AND record.market_id=${user.market_id} AND record.entity='products') INSERT INTO records(market_id,entity,data) SELECT ${user.market_id},'products',item FROM input WHERE NOT item?'id'`;
    return send(res, 200, { updated: body.products?.length || 0 });
  }
  if (path[0] === 'entities') {
    const table = ENTITIES[path[1]];
    if (!table) return send(res, 404, { message: 'Entidade desconhecida.' });
    const id = path[2];
    if (table === 'users') {
      if (!['admin','gerente'].includes(user.role)) return send(res, 403, { message: 'Sem permissão para gerenciar usuários.' });
      if (req.method === 'GET') return send(res, 200, await sql`SELECT id,email,full_name,role,photo_url,active,created_date,updated_date FROM users WHERE market_id=${user.market_id}`);
      if (req.method === 'PATCH') { const [u] = await sql`UPDATE users SET role=COALESCE(${body.role || null},role),full_name=COALESCE(${body.full_name || null},full_name),photo_url=COALESCE(${body.photo_url ?? null},photo_url),active=COALESCE(${typeof body.active === 'boolean' ? body.active : null},active),updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING id,email,full_name,role,photo_url,active`; return send(res, u ? 200 : 404, u || { message:'Usuário não encontrado.' }); }
    }
    if (table === 'markets') return send(res, 403, { message: 'Use o painel geral.' });
    if (['general_audits','product_audits'].includes(table) && !['admin','gerente'].includes(user.role) && req.method === 'GET') return send(res, 403, { message: 'Sem permissão para consultar auditorias.' });
    if (table === 'system_configs' && !['admin','gerente'].includes(user.role) && req.method !== 'GET') return send(res, 403, { message: 'Sem permissão para alterar configurações.' });
    if (table === 'sales' && ['PATCH','DELETE'].includes(req.method)) return send(res, 405, { message: 'Use as operações próprias de vendas.' });
    if (req.method === 'GET' && id) { const rows = await sql`SELECT id,data,created_date,updated_date FROM records WHERE id=${id} AND market_id=${user.market_id} AND entity=${table}`; const record=rows[0]?{id:rows[0].id,...rows[0].data,created_date:rows[0].created_date,updated_date:rows[0].updated_date}:null; if(record&&user.role==='vendedor'&&['sales','fiado_records'].includes(table)&&record.seller_id!==user.id)return send(res,403,{message:'Sem permissão para acessar este registro.'}); return send(res,record?200:404,record||{message:'Registro não encontrado.'}); }
    if (req.method === 'GET') {
      const limit = Math.min(Number(req.query.limit) || 500, 1000); const rows = await sql`SELECT id,data,created_date,updated_date FROM records WHERE market_id=${user.market_id} AND entity=${table} ORDER BY updated_date DESC LIMIT ${limit}`;
      let out = rows.map(r => ({ id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date }));
      if (user.role === 'vendedor' && ['sales','fiado_records'].includes(table)) out=out.filter(record=>record.seller_id===user.id);
      if (req.query.filters) { const f=JSON.parse(req.query.filters); out=out.filter(r=>Object.entries(f).every(([k,v])=>r[k]===v)); }
      const sort=req.query.sort; if(sort){const desc=sort.startsWith('-'),key=sort.replace(/^-/,'');out.sort((a,b)=>(a[key]>b[key]?1:-1)*(desc?-1:1));}
      return send(res, 200, out);
    }
    if (req.method === 'POST') {
      if (table === 'system_configs' && body.key) { const [existing]=await sql`UPDATE records SET data=data || ${JSON.stringify(body)}::jsonb,updated_date=now() WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key'=${body.key} RETURNING id,data,created_date,updated_date`; if(existing)return send(res,200,{id:existing.id,...existing.data,created_date:existing.created_date,updated_date:existing.updated_date}); }
      const [r]=await sql`INSERT INTO records(market_id,entity,data) VALUES(${user.market_id},${table},${JSON.stringify(body)}::jsonb) RETURNING id,data,created_date,updated_date`; return send(res,201,{id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date});
    }
    if (req.method === 'PATCH') { const sellerOnly=table==='fiado_records'&&user.role==='vendedor'; const [r]=await sql`UPDATE records SET data=data || ${JSON.stringify(body)}::jsonb,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND entity=${table} AND (${!sellerOnly} OR data->>'seller_id'=${user.id}) RETURNING id,data,created_date,updated_date`; return send(res,r?200:404,r?{id:r.id,...r.data,created_date:r.created_date,updated_date:r.updated_date}:{message:'Registro não encontrado ou sem permissão.'}); }
    if (req.method === 'DELETE') { await sql`DELETE FROM records WHERE id=${id} AND market_id=${user.market_id} AND entity=${table}`; return send(res,200,{ok:true}); }
  }
  return send(res, 404, { message: 'Rota não encontrada.' });
}

export default async function handler(req, res) {
  try { return await routeHandler(req, res); }
  catch (error) {
    console.error('API error', {
      code: error?.code,
      stage: error?.nexoStage,
      message: error?.message,
      detail: error?.detail,
    });
    if (error?.code === '23505') return send(res, 409, { message: 'Já existe um registro com esses dados.' });
    if (error?.code === '23503') return send(res, 409, { message: 'O registro está em uso e não pode ser removido.' });
    const detail = String(error?.message || '');
    const stage = error?.nexoStage || 'request';
    const extra = process.env.API_DEBUG === 'true' ? { detail } : {};
    if (/ENOTFOUND|fetch failed|invalid.*url|connection string/i.test(detail)) return send(res, 503, { code:'DATABASE_CONNECTION', stage, message:'A DATABASE_URL é inválida ou o servidor do banco não está acessível.', ...extra });
    if (error?.code === '28P01' || /password authentication failed/i.test(detail)) return send(res, 503, { code:'DATABASE_AUTH', stage, message:'O PostgreSQL recusou o usuário ou a senha da DATABASE_URL.', ...extra });
    if (error?.code === '3D000') return send(res, 503, { code:'DATABASE_NOT_FOUND', stage, message:'O banco informado na DATABASE_URL não existe.', ...extra });
    if (error?.code === '42501') return send(res, 503, { code:'DATABASE_PERMISSION', stage, message:'O usuário do PostgreSQL não possui permissão para preparar as tabelas.', ...extra });
    if (error?.code === '42703') return send(res, 500, { code:'DATABASE_SCHEMA_COLUMN', stage, message:'O banco possui uma estrutura antiga ou incompleta. A migração automática não conseguiu localizar uma coluna necessária.', ...extra });
    if (error?.code === '42804') return send(res, 500, { code:'DATABASE_SCHEMA_TYPE', stage, message:'Uma coluna existente possui um tipo incompatível com o Nexo PDV.', ...extra });
    if (error?.code === '42P01') return send(res, 500, { code:'DATABASE_SCHEMA_TABLE', stage, message:'Uma tabela necessária não foi encontrada durante a preparação do banco.', ...extra });
    if (error?.code === '42883' || /gen_random_uuid/i.test(detail)) return send(res, 500, { code:'DATABASE_UUID', stage, message:'O PostgreSQL não disponibilizou a função necessária para gerar identificadores UUID.', ...extra });
    return send(res, 500, { code:'INTERNAL_ERROR', stage, message:'Não foi possível preparar o banco de dados. Consulte os logs da função api/index.', ...extra });
  }
}
