import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { authenticateCredentials, createSession, currentUser, publicUser } from '../server/auth.js';
import { handleAccountMedia, handleAppearance, mediaVersion } from '../server/account-media.js';

// Actual PostgreSQL in memory. Optional test dependency, never connects to production.
const { PGlite } = await import(pathToFileURL(path.resolve(process.env.PGLITE_MODULE || 'artifacts/media-sql/node_modules/@electric-sql/pglite/dist/index.js')).href);
process.env.DATABASE_URL = 'postgresql://test:test@localhost/isolated';
process.env.JWT_SECRET = 'isolated-account-media-test-secret-123456789';
const db = new PGlite();
try {
  await db.exec(`CREATE SCHEMA nexo;
    CREATE TABLE nexo.markets(id uuid PRIMARY KEY, name text, logo_url text, primary_color text, secondary_color text, enabled_modules jsonb DEFAULT '[]', enabled_features jsonb DEFAULT '[]', require_cash_register boolean DEFAULT false, active boolean DEFAULT true);
    CREATE TABLE nexo.users(id uuid PRIMARY KEY, email text, password_hash text, full_name text, role text, photo_url text, avatar_color text, market_id uuid, unit_id uuid, password_reset_at timestamptz, cash_closing_time_enabled boolean DEFAULT false, cash_closing_min_time time, cash_closing_schedule jsonb DEFAULT '{}', active boolean DEFAULT true);
    CREATE TABLE nexo.market_units(id uuid, name text);
    CREATE TABLE nexo.platform_settings(key text, value jsonb);
    CREATE TABLE nexo.records(id uuid PRIMARY KEY, market_id uuid, entity text, data jsonb, created_date timestamptz DEFAULT now());`);
  const market = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002', id = '20000000-0000-4000-8000-000000000001';
  const image = 'data:image/png;base64,aGVsbG8=', different = 'data:image/png;base64,b3RoZXI=';
  const password = 'Test-only-password-123';
  await db.query('INSERT INTO nexo.markets(id,name,logo_url) VALUES ($1,$2,$3),($4,$5,$6)', [market, 'Own store', image, other, 'Other store', different]);
  await db.query('INSERT INTO nexo.users(id,email,password_hash,full_name,role,photo_url,market_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, 'local@example.invalid', await bcrypt.hash(password, 4), 'Local', 'admin', image, market]);
  await db.query("INSERT INTO nexo.records VALUES ('30000000-0000-4000-8000-000000000001',$1,'system_configs',$2,now()),('30000000-0000-4000-8000-000000000002',$3,'system_configs',$4,now())", [market, JSON.stringify({ key: 'logo_url', value: image }), other, JSON.stringify({ key: 'logo_url', value: different })]);
  const sql = async (strings, ...values) => (await db.query(strings.map((part, index) => part + (index < values.length ? `$${index + 1}` : '')).join(''), values)).rows;
  const response = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, getHeader(key) { return this.headers[key]; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; }, end() {} });
  const before = await db.query('SELECT * FROM nexo.records ORDER BY id');
  const user = await authenticateCredentials(sql, { email: 'local@example.invalid', password });
  assert.equal(user.logo_url, `/api/account-media/logo?v=${mediaVersion(market, image)}`);
  assert.equal(user.photo_url, `/api/account-media/avatar?v=${mediaVersion(id, image)}`);
  const session = response(); await createSession(user, session);
  const authenticated = await currentUser({ headers: { cookie: session.headers['Set-Cookie'] } }, sql);
  assert.equal(publicUser(authenticated).logo_url, user.logo_url);
  const appearance = response(); await handleAppearance({ req: { method: 'GET' }, res: appearance, sql, user });
  assert.equal(appearance.body.logo_url, user.logo_url, 'identical branding uses one browser image URL');
  for (const kind of ['avatar', 'logo', 'config-logo']) {
    const media = response(); await handleAccountMedia({ req: { method: 'GET', query: { market_id: other }, headers: {} }, res: media, sql, user, kind });
    assert.equal(media.code, 200); assert.equal(media.body.toString(), 'hello');
  }
  assert.deepEqual(await db.query('SELECT * FROM nexo.records ORDER BY id'), before);
  assert.equal((await db.query('SELECT logo_url FROM nexo.markets WHERE id=$1', [market])).rows[0].logo_url, image);
  assert.equal((await db.query('SELECT photo_url FROM nexo.users WHERE id=$1', [id])).rows[0].photo_url, image);
  console.log('Actual PostgreSQL: login/session projections, appearance versions, media ownership and original image preservation passed.');
} finally { await db.close(); }
