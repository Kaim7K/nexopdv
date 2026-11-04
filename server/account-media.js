import { createHash } from 'node:crypto';
import { send } from './http.js';

export function mediaVersion(subject, value) {
  return createHash('md5').update(`${subject}:${value}`).digest('hex');
}

export function compactAccountImage(value, kind, subject) {
  if (!subject || typeof value !== 'string' || !/^data:image\//i.test(value)) return value;
  return `/api/account-media/${kind}?v=${mediaVersion(subject, value)}`;
}

export async function handleAppearance({ req, res, sql, user }) {
  if (req.method !== 'GET') return send(res, 405, { message: 'Método não permitido.' });
  if (!user.market_id) return send(res, 200, {});
  const rows = await sql`
    SELECT data->>'key' AS key,
      CASE WHEN data->>'key'='logo_url' AND data->>'value' LIKE 'data:image/%'
        THEN to_jsonb('/api/account-media/config-logo?v=' || md5(market_id::text || ':' || (data->>'value')))
        ELSE data->'value' END AS value
    FROM nexo.records
    WHERE market_id=${user.market_id} AND entity='system_configs'
    ORDER BY created_date DESC, id DESC LIMIT 500
  `;
  const appearance = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const logo = compactAccountImage(user.logo_url, 'logo', user.market_id);
  if (typeof logo === 'string' && logo.startsWith('/api/account-media/logo?') && appearance.logo_url === logo.replace('/logo?', '/config-logo?')) appearance.logo_url = logo;
  return send(res, 200, appearance);
}

export async function handleAccountMedia({ req, res, sql, user, kind }) {
  if (req.method !== 'GET') return send(res, 405, { message: 'Método não permitido.' });
  let rows, subject;
  if (kind === 'avatar') {
    subject = user.id;
    rows = await sql`SELECT photo_url AS image FROM nexo.users WHERE id=${user.id} AND active=true`;
  } else if (kind === 'logo' && user.market_id) {
    subject = user.market_id;
    rows = await sql`SELECT logo_url AS image FROM nexo.markets WHERE id=${user.market_id} AND active=true`;
  } else if (kind === 'config-logo' && user.market_id) {
    subject = user.market_id;
    rows = await sql`SELECT data->>'value' AS image FROM nexo.records WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key'='logo_url' ORDER BY created_date ASC, id ASC LIMIT 1`;
  } else return send(res, 404, { message: 'Imagem não encontrada.' });
  const image = rows[0]?.image;
  const match = typeof image === 'string' && image.match(/^data:image\/(jpeg|png|webp|avif);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return send(res, 404, { message: 'Imagem não encontrada.' });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return send(res, 404, { message: 'Imagem não encontrada.' });
  const version = mediaVersion(subject, image);
  const tag = `"${version}"`;
  res.setHeader('Content-Type', `image/${match[1].toLowerCase()}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('Cache-Control', req.query?.v === version ? 'private, max-age=86400' : 'private, no-cache');
  res.setHeader('ETag', tag);
  if (req.headers['if-none-match'] === tag) return res.status(304).end();
  res.setHeader('Content-Length', String(buffer.length));
  return res.status(200).send(buffer);
}
