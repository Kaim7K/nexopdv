import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpClient } from '../src/api/http/http-client.js';

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

test('deduplica leituras concorrentes e reutiliza o cache', async () => {
  let calls = 0;
  const client = createHttpClient({
    baseUrl: '',
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ calls });
    },
  });

  const [first, concurrent] = await Promise.all([
    client.request('/products', { cacheTTL: 5_000 }),
    client.request('/products', { cacheTTL: 5_000 }),
  ]);
  const cached = await client.request('/products', { cacheTTL: 5_000 });

  assert.equal(calls, 1);
  assert.deepEqual(first, concurrent);
  assert.deepEqual(first, cached);
});

test('invalida apenas os escopos relacionados após uma mutação', async () => {
  const calls = new Map();
  const client = createHttpClient({
    baseUrl: '',
    fetchImpl: async (url) => {
      calls.set(url, (calls.get(url) || 0) + 1);
      return jsonResponse({ url, call: calls.get(url) });
    },
  });

  await client.request('/products', { cacheTTL: 5_000 });
  await client.request('/cash/current', { cacheTTL: 5_000 });
  await client.request('/products/1', { method: 'PATCH', body: { name: 'Novo' } });
  await client.request('/products', { cacheTTL: 5_000 });
  await client.request('/cash/current', { cacheTTL: 5_000 });

  assert.equal(calls.get('/products'), 2);
  assert.equal(calls.get('/cash/current'), 1);
});

test('cancela a busca anterior que usa a mesma latestKey', async () => {
  const client = createHttpClient({
    baseUrl: '',
    fetchImpl: (url, options) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(jsonResponse({ url })), 20);
        options.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Abortado', 'AbortError'));
        });
      }),
  });

  const replaced = client.request('/sales?search=a', { latestKey: 'sales' });
  const latest = client.request('/sales?search=ab', { latestKey: 'sales' });

  await assert.rejects(replaced, (error) => error.code === 'REQUEST_REPLACED');
  assert.deepEqual(await latest, { url: '/sales?search=ab' });
});

test('normaliza erros HTTP no contrato público do cliente', async () => {
  const client = createHttpClient({
    baseUrl: '',
    fetchImpl: async () => jsonResponse({ code: 'CONFLICT', message: 'Conflito' }, 409),
  });

  await assert.rejects(
    client.request('/sales', { method: 'POST', body: {} }),
    (error) =>
      error.status === 409 &&
      error.code === 'CONFLICT' &&
      error.message === 'Conflito' &&
      error.path === '/sales',
  );
});
