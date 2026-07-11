import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { getRuntimeConfig } from './config.js';
import { AppError } from './errors.js';

const SESSION_COOKIE = 'nexo_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 12;
const ISSUER = 'nexo-pdv';
const AUDIENCE = 'nexo-web';

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(256),
});

const secret = () => new TextEncoder().encode(getRuntimeConfig().jwtSecret);

function readCookie(req, name) {
  const entry = String(req.headers.cookie || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    photo_url: user.photo_url,
    market_id: user.market_id,
    market_name: user.market_name,
    logo_url: user.logo_url,
    primary_color: user.primary_color,
    secondary_color: user.secondary_color,
    enabled_modules: user.enabled_modules || [],
    require_cash_register: Boolean(user.require_cash_register),
  };
}

export async function authenticateCredentials(sql, input) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_CREDENTIALS_FORMAT', 'Informe um e-mail e uma senha válidos.');
  }

  const rows = await sql`
    SELECT
      u.id, u.email, u.password_hash, u.full_name, u.role, u.photo_url, u.market_id,
      m.name AS market_name, m.logo_url, m.primary_color, m.secondary_color, m.enabled_modules, m.require_cash_register
    FROM nexo.users u
    LEFT JOIN nexo.markets m ON m.id = u.market_id
    WHERE lower(u.email) = ${parsed.data.email}
      AND u.active = true
      AND (u.role = 'super_admin' OR m.active = true)
    LIMIT 1
  `;

  const user = rows[0];
  const validHash = typeof user?.password_hash === 'string' && user.password_hash.startsWith('$2');
  const passwordMatches = validHash ? await bcrypt.compare(parsed.data.password, user.password_hash) : false;
  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }

  return user;
}

export async function createSession(user, res) {
  const config = getRuntimeConfig();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(String(user.id))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret());

  const secure = config.isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_SECONDS}${secure}`
  );
}

export function clearSession(res) {
  const secure = getRuntimeConfig().isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export async function currentUser(req, sql) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE });
    if (!payload.sub) return null;

    const rows = await sql`
      SELECT
        u.id, u.email, u.full_name, u.role, u.photo_url, u.market_id,
        m.name AS market_name, m.logo_url, m.primary_color, m.secondary_color, m.enabled_modules, m.require_cash_register
      FROM nexo.users u
      LEFT JOIN nexo.markets m ON m.id = u.market_id
      WHERE u.id = ${payload.sub}
        AND u.active = true
        AND (u.role = 'super_admin' OR m.active = true)
      LIMIT 1
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}
