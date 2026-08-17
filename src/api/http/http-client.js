import { buildApiError, buildConnectionError } from './api-error.js';
import { createResponseCache } from './cache-policy.js';

function requestSignal(externalSignal, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const signal = externalSignal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([externalSignal, controller.signal])
    : externalSignal || controller.signal;
  return { signal, controller, timeoutId };
}

function requestBody(body) {
  if (body instanceof FormData) return body;
  return body ? JSON.stringify(body) : undefined;
}

function requestHeaders(body) {
  return body instanceof FormData
    ? { Accept: 'application/json' }
    : { Accept: 'application/json', 'Content-Type': 'application/json' };
}

export function createHttpClient({ baseUrl = '/api', fetchImpl = fetch } = {}) {
  const cache = createResponseCache();
  const inFlight = new Map();
  const latestControllers = new Map();

  async function perform(path, options) {
    const activeSignal = requestSignal(options.signal, options.timeout || 30_000);
    const { cacheTTL: _cacheTTL, timeout: _timeout, latestKey: _latestKey, signal: _signal, ...fetchOptions } = options;
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        credentials: 'include',
        headers: requestHeaders(options.body),
        ...fetchOptions,
        signal: activeSignal.signal,
        body: requestBody(options.body),
      });
    } catch (cause) {
      throw buildConnectionError(cause, cause?.name === 'AbortError' && activeSignal.controller.signal.aborted);
    } finally {
      clearTimeout(activeSignal.timeoutId);
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
    if (!response.ok) {
      const expired = response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/me') && typeof window !== 'undefined';
      if (expired) {
        cache.clear();
        window.dispatchEvent(new CustomEvent('nexo:session-expired'));
      }
      throw buildApiError({ response, data, path });
    }
    return data;
  }

  function latestOptions(options) {
    if (!options.latestKey) return { options, controller: null };
    latestControllers.get(options.latestKey)?.abort();
    const controller = new AbortController();
    latestControllers.set(options.latestKey, controller);
    return { options: { ...options, signal: controller.signal }, controller };
  }

  function request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const ttl = method === 'GET' ? Number(options.cacheTTL || 0) : 0;
    const key = `${method}:${path}`;
    if (ttl > 0) {
      const cached = cache.get(key);
      if (cached !== undefined) return Promise.resolve(cached);
      if (inFlight.has(key)) return inFlight.get(key);
    }

    const latest = latestOptions(options);
    const promise = perform(path, latest.options)
      .then((data) => {
        if (ttl > 0) cache.set(key, data, ttl);
        if (method !== 'GET') cache.clear(path);
        return data;
      })
      .finally(() => {
        inFlight.delete(key);
        if (options.latestKey && latestControllers.get(options.latestKey) === latest.controller) latestControllers.delete(options.latestKey);
      });
    if (ttl > 0) inFlight.set(key, promise);
    return promise;
  }

  return { request, cache };
}
