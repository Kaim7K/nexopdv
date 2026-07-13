import { neon } from '@neondatabase/serverless';
import { getRuntimeConfig } from './config.js';
import { AppError } from './errors.js';

export const CURRENT_SCHEMA_VERSION = 11;
const READY_CACHE_MS = 60_000;

let client;
let checkedAt = 0;
let checkedVersion = 0;

export function getDb() {
  if (!client) client = neon(getRuntimeConfig().databaseUrl);
  return client;
}

export async function assertDatabaseReady(sql = getDb()) {
  if (Date.now() - checkedAt < READY_CACHE_MS) return checkedVersion;

  try {
    const rows = await sql`
      SELECT COALESCE(MAX(version), 0)::int AS version
      FROM nexo.schema_migrations
    `;
    const version = Number(rows[0]?.version || 0);
    if (version < CURRENT_SCHEMA_VERSION) {
      throw new AppError(
        503,
        'DATABASE_SCHEMA_OUTDATED',
        `Banco na versão ${version}; aplicação exige a versão ${CURRENT_SCHEMA_VERSION}. Faça um novo deploy.`
      );
    }
    checkedVersion = version;
    checkedAt = Date.now();
    return version;
  } catch (error) {
    checkedAt = 0;
    checkedVersion = 0;
    if (error instanceof AppError) throw error;
    if (error?.code === '42P01' || error?.code === '3F000') {
      throw new AppError(503, 'DATABASE_NOT_MIGRATED', 'O banco ainda não foi preparado. Faça um novo deploy.');
    }
    throw error;
  }
}
