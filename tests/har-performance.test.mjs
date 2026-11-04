import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpClient } from '../src/api/http/http-client.js';
import { createResponseCache } from '../src/api/http/cache-policy.js';
import { assertDatabaseReady, CURRENT_SCHEMA_VERSION } from '../server/db.js';
import { publicUser } from '../server/auth.js';
import { compactAccountImage, handleAccountMedia, handleAppearance, mediaVersion } from '../server/account-media.js';
import { attachServerTiming } from '../server/server-timing.js';

const json = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = () => ({ headers: {}, headersSent: false, setHeader(key, value) { this.headers[key] = value; }, getHeader(key) { return this.headers[key]; }, status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; }, send(data) { this.body = data; return this; }, end() { this.ended = true; } });

test('complete 761-product catalog serves 1200 and 2000 without another request', async () => {
  let calls = 0;
  const data = Array.from({ length: 761 }, (_, id) => ({ id }));
  const client = createHttpClient({ fetchImpl: async () => { calls++; return json(data); } });
  const first = await client.request('/products/catalog?limit=1200', { cacheTTL: 20000 });
  const larger = await client.request('/products/catalog?limit=2000', { cacheTTL: 20000 });
  assert.equal(calls, 1);
  assert.deepEqual(larger, first);
  assert.deepEqual(await client.request('/products/catalog?limit=5', { cacheTTL: 20000 }), first.slice(0, 5));
  await client.request('/sales/complete', { method: 'POST', body: {} });
  await client.request('/products/catalog?limit=2000', { cacheTTL: 20000 });
  assert.equal(calls, 3, 'sale must invalidate cached quantity and sales counts');
});

test('partial catalogs cannot satisfy a larger limit, or refresh an old entry TTL', () => {
  const cache = createResponseCache();
  cache.set('GET:/products/catalog?limit=2', [{ id: 1 }, { id: 2 }], 20000);
  assert.equal(cache.getCatalog('/products/catalog?limit=3'), undefined);
  assert.equal(cache.getCatalog('/products/catalog?limit=3001'), undefined);
  cache.set('GET:/products/catalog?limit=2000', [{ id: 1 }], -1);
  assert.equal(cache.getCatalog('/products/catalog?limit=3'), undefined);
  cache.clear('/auth/logout');
  assert.equal(cache.getCatalog('/products/catalog?limit=1'), undefined);
});

test('late GET cannot restore cache invalidated by a write or replace a newer pending GET', async () => {
  const old = deferred(), fresh = deferred(); let gets = 0;
  const client = createHttpClient({ fetchImpl: async (_url, options) => options.method === 'POST' ? json({ ok: true }) : (++gets === 1 ? old.promise : fresh.promise) });
  const stale = client.request('/products/catalog?limit=1200', { cacheTTL: 20000 });
  await client.request('/sales/complete', { method: 'POST', body: {} });
  const current = client.request('/products/catalog?limit=1200', { cacheTTL: 20000 });
  old.resolve(json([{ quantity: 20 }])); await stale;
  const concurrent = client.request('/products/catalog?limit=1200', { cacheTTL: 20000 });
  fresh.resolve(json([{ quantity: 19 }]));
  assert.deepEqual(await current, [{ quantity: 19 }]);
  assert.deepEqual(await concurrent, [{ quantity: 19 }]);
  assert.equal(gets, 2);
  assert.deepEqual(await client.request('/products/catalog?limit=2000', { cacheTTL: 20000 }), [{ quantity: 19 }]);
});

test('concurrent readiness checks share one query, retry failures, and isolate database clients', async () => {
  const waiting = deferred(); let calls = 0;
  const sql = () => { calls++; return waiting.promise; };
  const all = Promise.all(Array.from({ length: 8 }, () => assertDatabaseReady(sql)));
  assert.equal(calls, 1);
  waiting.resolve([{ version: CURRENT_SCHEMA_VERSION }]);
  assert.deepEqual(await all, Array(8).fill(CURRENT_SCHEMA_VERSION));
  await assertDatabaseReady(sql); assert.equal(calls, 1);
  let retries = 0;
  const failing = async () => { if (++retries === 1) throw new Error('offline'); return [{ version: CURRENT_SCHEMA_VERSION }]; };
  await assert.rejects(assertDatabaseReady(failing), /offline/);
  assert.equal(await assertDatabaseReady(failing), CURRENT_SCHEMA_VERSION);
  await assert.rejects(assertDatabaseReady(async () => [{ version: 0 }]), error => error.code === 'DATABASE_SCHEMA_OUTDATED');
});

test('session images become tenant-versioned URLs without modifying stored data', () => {
  const logo = 'data:image/png;base64,' + 'a'.repeat(47000);
  const avatar = 'data:image/webp;base64,' + 'b'.repeat(9000);
  const user = Object.freeze({ id: 'user-a', market_id: 'market-a', logo_url: logo, photo_url: avatar });
  const result = publicUser(user);
  assert.ok(JSON.stringify(result).length < 1500);
  assert.match(result.logo_url, /^\/api\/account-media\/logo\?v=[a-f0-9]{32}$/);
  assert.notEqual(result.logo_url, compactAccountImage(logo, 'logo', 'market-b'));
  assert.equal(user.logo_url, logo);
  assert.equal(user.photo_url, avatar);
  assert.equal(compactAccountImage('https://example.com/logo.png', 'logo', 'market-a'), 'https://example.com/logo.png');
});

test('appearance uses the authenticated market and media serves only its own stored image', async () => {
  const user = { id: 'own-user', market_id: 'own-market' };
  let values;
  const sql = async (_strings, ...args) => { values = args; return [{ key: 'nome_mercado', value: 'Loja' }]; };
  const res = response();
  await handleAppearance({ req: { method: 'GET' }, res, sql, user });
  assert.deepEqual(values, ['own-market']); assert.deepEqual(res.body, { nome_mercado: 'Loja' });
  const image = 'data:image/png;base64,aGVsbG8=';
  const mediaSql = async (_strings, ...args) => { values = args; return [{ image }]; };
  const served = response(); const version = mediaVersion(user.market_id, image);
  await handleAccountMedia({ req: { method: 'GET', query: { v: version, market_id: 'other' }, headers: {} }, res: served, sql: mediaSql, user, kind: 'logo' });
  assert.deepEqual(values, ['own-market']); assert.equal(served.body.toString(), 'hello');
  assert.equal(served.headers['Cache-Control'], 'private, max-age=86400');
  const notModified = response();
  await handleAccountMedia({ req: { method: 'GET', query: { v: version }, headers: { 'if-none-match': `"${version}"` } }, res: notModified, sql: mediaSql, user, kind: 'logo' });
  assert.equal(notModified.code, 304);
  const stale = response();
  await handleAccountMedia({ req: { method: 'GET', query: { v: 'old' }, headers: {} }, res: stale, sql: mediaSql, user, kind: 'logo' });
  assert.equal(stale.headers['Cache-Control'], 'private, no-cache');
  const missing = response();
  await handleAccountMedia({ req: { method: 'GET', query: {}, headers: {} }, res: missing, sql: mediaSql, user: { id: 'own-user' }, kind: 'logo' });
  assert.equal(missing.code, 404);
});

test('Server-Timing separates schema, auth and other work, including errors', async () => {
  let clock = 0; const res = response(); const timing = attachServerTiming(res, () => clock);
  await timing.measure('schema', async () => { clock += 10; });
  await timing.measure('auth', async () => { clock += 20; });
  clock += 30; res.end();
  assert.match(res.headers['Server-Timing'], /handler;dur=60.0, schema;dur=10.0, auth;dur=20.0, other;dur=30.0/);
  await assert.rejects(timing.measure('query', async () => { clock += 5; throw new Error('failure'); }), /failure/);
  assert.match(res.headers['Server-Timing'], /query;dur=5.0/);
});
