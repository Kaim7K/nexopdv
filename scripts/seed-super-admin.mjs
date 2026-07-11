import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { getMigrationConfig } from '../server/config.js';

export async function syncSuperAdmin() {
  const { databaseUrl, superAdminEmail, superAdminPassword } = getMigrationConfig();
  const sql = neon(databaseUrl);
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  const rows = await sql`
    SELECT id
    FROM nexo.users
    WHERE lower(email) = ${superAdminEmail}
    LIMIT 1
  `;

  if (rows[0]) {
    await sql`
      UPDATE nexo.users
      SET email = ${superAdminEmail},
          password_hash = ${passwordHash},
          full_name = COALESCE(NULLIF(full_name, ''), 'Administrador Nexo'),
          role = 'super_admin',
          market_id = NULL,
          active = true,
          updated_date = now()
      WHERE id = ${rows[0].id}
    `;
  } else {
    await sql`
      INSERT INTO nexo.users(email, password_hash, full_name, role, active)
      VALUES (${superAdminEmail}, ${passwordHash}, 'Administrador Nexo', 'super_admin', true)
    `;
  }

  console.log(`Superadministrador sincronizado: ${superAdminEmail}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncSuperAdmin().catch(error => {
    console.error('Falha ao sincronizar o superadministrador:', error);
    process.exitCode = 1;
  });
}
