import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from './errors.js';
import { send } from './http.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const emailSchema = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const resetSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(10).max(72) });
const accepted = { message: 'Se houver uma conta ativa para este e-mail, você receberá um link válido por 30 minutos. Confira também o spam. Se não chegar, aguarde alguns minutos ou procure o administrador da loja.' };

export function recoveryConfiguration() {
  let origin;
  try { origin = new URL(process.env.PUBLIC_APP_URL || ''); } catch { /* Report one configuration error for every email. */ }
  const from = String(process.env.EMAIL_FROM || '').trim();
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(from);
  const email = String(match?.[2] || from).trim();
  if (!origin || origin.protocol !== 'https:' || origin.username || origin.password || !process.env.BREVO_API_KEY || !emailSchema.safeParse(email).success)
    throw new AppError(503, 'RECOVERY_UNAVAILABLE', 'A recuperação por e-mail ainda não está disponível. Procure o administrador da loja para recuperar o acesso.');
  return { origin: origin.origin, sender: { name: match?.[1]?.trim() || 'Nexo PDV', email }, key: process.env.BREVO_API_KEY };
}

export async function handlePasswordRecovery({ req, res, sql, path }, { deliver = fetch } = {}) {
  if (req.method !== 'POST') return send(res, 405, { message: 'Método não permitido.' });
  if (path[1] === 'forgot-password') {
    const parsed = emailSchema.safeParse(req.body?.email);
    if (!parsed.success) throw new AppError(400, 'INVALID_EMAIL', 'Informe um e-mail válido.');
    const config = recoveryConfiguration();
    const bucket = Math.floor(Date.now() / 3600000);
    // Persistent limits work across serverless instances. Store only hashes.
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    const keys = [`email:${digest(parsed.data)}:${bucket}`, `ip:${digest(ip)}:${bucket}`];
    for (const [index, key] of keys.entries()) {
      const rows = await sql`INSERT INTO nexo.password_reset_limits(key,expires_at) VALUES(${key},now()+interval '1 hour') ON CONFLICT(key) DO UPDATE SET attempts=nexo.password_reset_limits.attempts+1 WHERE nexo.password_reset_limits.attempts < ${index === 0 ? 5 : 30} RETURNING key`;
      if (!rows.length) return send(res, 200, accepted);
    }
    const [user] = await sql`SELECT u.id,u.email,u.password_hash FROM nexo.users u LEFT JOIN nexo.markets m ON m.id=u.market_id WHERE lower(u.email)=${parsed.data} AND u.active AND (u.role='super_admin' OR m.active) LIMIT 1`;
    if (!user) return send(res, 200, accepted);
    const token = randomBytes(32).toString('hex');
    const tokenHash = digest(token);
    await sql`INSERT INTO nexo.password_reset_tokens(token_hash,user_id,password_fingerprint,expires_at) VALUES(${tokenHash},${user.id},${digest(user.password_hash)},now()+interval '30 minutes')`;
    // Fragment keeps the secret out of HTTP request URLs and referrer headers.
    const url = `${config.origin}/recuperar-acesso#token=${token}`;
    try {
      const response = await deliver('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'api-key': config.key, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: config.sender, to: [{ email: user.email }], subject: 'Recuperar acesso ao Nexo PDV',
          textContent: `Para criar uma nova senha, abra este link em até 30 minutos: ${url}\nSe você não solicitou, ignore esta mensagem. Sua senha permanece a mesma.` }),
      });
      if (!response.ok) throw new Error('Email provider rejected password recovery');
    } catch {
      await sql`DELETE FROM nexo.password_reset_tokens WHERE token_hash=${tokenHash}`;
      // Do not reveal account existence via delivery errors.
      console.error('Password recovery email delivery failed');
    }
    return send(res, 200, accepted);
  }
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success || Buffer.byteLength(parsed.data?.password || '', 'utf8') > 72)
    throw new AppError(400, 'INVALID_PASSWORD_RESET', 'Use o link recebido e uma senha de 10 a 72 caracteres (até 72 bytes).');
  const tokenHash = digest(parsed.data.token);
  const [token] = await sql`SELECT token.user_id,token.password_fingerprint,u.password_hash FROM nexo.password_reset_tokens token JOIN nexo.users u ON u.id=token.user_id LEFT JOIN nexo.markets m ON m.id=u.market_id WHERE token.token_hash=${tokenHash} AND token.used_at IS NULL AND token.expires_at>now() AND u.active AND (u.role='super_admin' OR m.active)`;
  if (!token || token.password_fingerprint !== digest(token.password_hash))
    throw new AppError(400, 'RESET_LINK_EXPIRED', 'Este link expirou ou já foi utilizado. Solicite um novo link.');
  const hash = await bcrypt.hash(parsed.data.password, 12);
  const rows = await sql`WITH claimed AS (
    UPDATE nexo.password_reset_tokens SET used_at=now()
    WHERE token_hash=${tokenHash} AND used_at IS NULL AND expires_at>now() RETURNING user_id
  ) UPDATE nexo.users u SET password_hash=${hash},password_reset_at=now(),updated_date=now()
    FROM claimed WHERE u.id=claimed.user_id AND u.active AND u.password_hash=${token.password_hash} RETURNING u.id`;
  if (!rows.length) throw new AppError(400, 'RESET_LINK_EXPIRED', 'Este link expirou ou já foi utilizado. Solicite um novo link.');
  return send(res, 200, { message: 'Senha atualizada. Entre com sua nova senha.' });
}
