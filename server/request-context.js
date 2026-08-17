import { getDb } from './db.js';
import { assertSameOriginRequest, readJsonBody } from './http.js';

function parsePath(req, requestUrl) {
  const routedPath =
    req.query.path || requestUrl.pathname.replace(/^\/api(?:\/index)?/, '');
  return String(routedPath || '/')
    .split('/')
    .filter(Boolean);
}

export async function createRequestContext(req) {
  const requestUrl = new URL(req.url, 'http://localhost');
  req.query = {
    ...Object.fromEntries(requestUrl.searchParams.entries()),
    ...(req.query || {}),
  };
  assertSameOriginRequest(req);
  req.body = await readJsonBody(req);

  return {
    sql: getDb(),
    path: parsePath(req, requestUrl),
  };
}
