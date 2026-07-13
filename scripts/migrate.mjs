import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { getMigrationConfig } from '../server/config.js';
import { CURRENT_SCHEMA_VERSION } from '../server/db.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'database', 'migrations');

function parseMigrationVersion(filename) {
  const match = /^(\d+)_/.exec(filename);
  return match ? Number(match[1]) : null;
}

export async function migrateDatabase() {
  const { databaseUrl } = getMigrationConfig();
  const sql = neon(databaseUrl);

  await sql.query('CREATE SCHEMA IF NOT EXISTS nexo');
  await sql.query(`
    CREATE TABLE IF NOT EXISTS nexo.schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(migrationsDir))
    .filter(name => /^\d+_.+\.sql$/.test(name))
    .sort((a, b) => parseMigrationVersion(a) - parseMigrationVersion(b));

  const versions = files.map(parseMigrationVersion);
  if (versions.at(-1) !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`A última migração é ${versions.at(-1) || 0}, mas CURRENT_SCHEMA_VERSION é ${CURRENT_SCHEMA_VERSION}.`);
  }
  versions.forEach((version, index) => {
    if (version !== index + 1) throw new Error(`Sequência de migrações inválida: esperado ${index + 1}, encontrado ${version}.`);
  });

  const appliedRows = await sql`SELECT version FROM nexo.schema_migrations ORDER BY version`;
  const applied = new Set(appliedRows.map(row => Number(row.version)));

  for (const filename of files) {
    const version = parseMigrationVersion(filename);
    if (applied.has(version)) continue;

    const source = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
    const statements = source
      .split(/^\s*-- statement-breakpoint\s*$/m)
      .map(statement => statement.trim())
      .filter(Boolean);

    try {
      await sql.transaction(tx => [
        ...statements.map(statement => tx.query(statement)),
        tx`
          INSERT INTO nexo.schema_migrations(version, name)
          VALUES (${version}, ${filename})
          ON CONFLICT (version) DO NOTHING
        `,
      ]);
    } catch (cause) {
      const databaseMessage = cause?.message || 'erro desconhecido do banco';
      throw new Error(
        `Falha na migração ${filename} (${statements.length} instruções): ${databaseMessage}`,
        { cause },
      );
    }
    console.log(`Migração ${filename} aplicada.`);
  }

  const [state] = await sql`
    SELECT COALESCE(MAX(version), 0)::int AS version
    FROM nexo.schema_migrations
  `;
  if (Number(state?.version) !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Banco permaneceu na versão ${state?.version || 0}.`);
  }

  return { version: CURRENT_SCHEMA_VERSION };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateDatabase().catch(error => {
    console.error('Falha ao aplicar migrações:', error);
    process.exitCode = 1;
  });
}
