import { migrateDatabase } from './migrate.mjs';
import { syncSuperAdmin } from './seed-super-admin.mjs';

try {
  console.log('Iniciando preparação do banco...');

  console.log('Aplicando migrações...');
  const migration = await migrateDatabase();
  console.log(`Migrações concluídas. Versão do banco: ${migration.version}.`);

  console.log('Sincronizando superadministrador...');
  await syncSuperAdmin();

  console.log('Banco preparado e autenticação pronta.');
} catch (error) {
  console.error('\nDEPLOY INTERROMPIDO: o banco não pôde ser preparado.');
  console.error({
    name: error?.name,
    message: error?.message,
    code: error?.code,
    cause: error?.cause?.message,
  });
  console.error('Revise DATABASE_URL, DATABASE_URL_UNPOOLED e as variáveis de ambiente da Vercel.');
  process.exit(1);
}
