import { AppError, mapDatabaseError } from './errors.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function assertSameOriginRequest(req) {
  if (!STATE_CHANGING_METHODS.has(String(req.method || '').toUpperCase())) return;

  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    throw new AppError(403, 'CROSS_SITE_REQUEST_BLOCKED', 'A requisição foi bloqueada por segurança. Atualize a página e tente novamente.');
  }

  const origin = req.headers.origin;
  if (!origin) return;
  if (/^chrome-extension:\/\//i.test(origin)) return;
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.host || '').trim();
  if (!host) return;

  try {
    if (new URL(origin).host !== host) {
      throw new AppError(403, 'INVALID_REQUEST_ORIGIN', 'A origem da requisição não é permitida.');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(403, 'INVALID_REQUEST_ORIGIN', 'A origem da requisição não é válida.');
  }
}

export const send = (res, status, data) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res.status(status).json(data);
};

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw && !['GET', 'HEAD'].includes(req.method)) {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (!raw) return {};
  if (Buffer.byteLength(raw, 'utf8') > 2 * 1024 * 1024) {
    throw new AppError(413, 'REQUEST_TOO_LARGE', 'A requisição ultrapassa o tamanho permitido.');
  }

  try { return JSON.parse(raw); }
  catch { throw new AppError(400, 'INVALID_JSON', 'O corpo da requisição não contém um JSON válido.'); }
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido para esta rota.' });
}

export function handleError(error, res) {
  const mapped = mapDatabaseError(error);
  const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  console.error(JSON.stringify({
    level: 'error',
    requestId,
    code: mapped.code,
    status: mapped.status,
    message: error?.message,
    databaseCode: error?.code,
    stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
  }));

  return send(res, mapped.status, {
    code: mapped.code,
    message: mapped.expose ? mapped.message : 'O servidor encontrou um erro interno.',
    requestId,
  });
}
