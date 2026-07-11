import { migrateDatabase } from './migrate.mjs';
import { syncSuperAdmin } from './seed-super-admin.mjs';

try {
  await migrateDatabase();
  await syncSuperAdmin();
  console.log('Banco preparado e autenticação pronta.');
} catch (error) {
  console.error('\nDEPLOY INTERROMPIDO: o banco não pôde ser preparado.');
  console.error('Revise DATABASE_URL e as variáveis de ambiente da Vercel.');
  console.error(error);
  process.exit(1);
}
