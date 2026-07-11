import { neon } from '@neondatabase/serverless';
import { getMigrationConfig } from '../server/config.js';
import { CURRENT_SCHEMA_VERSION } from '../server/db.js';

const { databaseUrl, superAdminEmail } = getMigrationConfig();
const sql = neon(databaseUrl);
const [state] = await sql`
  SELECT
    (SELECT COALESCE(MAX(version), 0)::int FROM nexo.schema_migrations) AS version,
    EXISTS(
      SELECT 1 FROM nexo.users
      WHERE lower(email) = ${superAdminEmail} AND role = 'super_admin' AND active = true
    ) AS super_admin_ready
`;

if (Number(state.version) !== CURRENT_SCHEMA_VERSION || !state.super_admin_ready) {
  throw new Error(`Banco inválido: versão=${state.version}, superAdmin=${state.super_admin_ready}`);
}
console.log(JSON.stringify({ ok: true, schemaVersion: state.version, superAdmin: true }));
