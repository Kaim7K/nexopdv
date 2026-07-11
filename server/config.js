import { AppError } from './errors.js';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError(503, 'CONFIG_MISSING', `A variável ${name} não está configurada.`);
  return value;
};

export function getRuntimeConfig() {
  const databaseUrl = required('DATABASE_URL');
  const jwtSecret = required('JWT_SECRET');

  if (jwtSecret.length < 32) {
    throw new AppError(503, 'CONFIG_INVALID', 'JWT_SECRET deve possuir pelo menos 32 caracteres.');
  }

  try {
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('protocol');
  } catch {
    throw new AppError(503, 'CONFIG_INVALID', 'DATABASE_URL não é uma conexão PostgreSQL válida.');
  }

  return {
    databaseUrl,
    jwtSecret,
    isProduction: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production',
  };
}

export function getBootstrapConfig() {
  const runtime = getRuntimeConfig();
  const email = required('SUPER_ADMIN_EMAIL').toLowerCase();
  const password = required('SUPER_ADMIN_PASSWORD');

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new AppError(503, 'CONFIG_INVALID', 'SUPER_ADMIN_EMAIL não é válido.');
  }
  if (password.length < 12) {
    throw new AppError(503, 'CONFIG_INVALID', 'SUPER_ADMIN_PASSWORD deve possuir pelo menos 12 caracteres.');
  }

  return { ...runtime, superAdminEmail: email, superAdminPassword: password };
}

export function getMigrationConfig() {
  const bootstrap = getBootstrapConfig();
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED?.trim() || bootstrap.databaseUrl;

  try {
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('protocol');
  } catch {
    throw new AppError(503, 'CONFIG_INVALID', 'DATABASE_URL_UNPOOLED não é uma conexão PostgreSQL válida.');
  }

  return { ...bootstrap, databaseUrl };
}
