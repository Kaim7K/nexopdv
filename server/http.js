import { AppError, mapDatabaseError } from './errors.js';

export const send = (res, status, data) => {
  res.setHeader('Cache-Control', 'no-store');
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
    stack: error?.stack,
  }));

  return send(res, mapped.status, {
    code: mapped.code,
    message: mapped.expose ? mapped.message : 'O servidor encontrou um erro interno.',
    requestId,
  });
}
