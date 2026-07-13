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
  const connectionCodes = new Set(['28P01', '3D000', '3F000', '42501', 'ECONNREFUSED', 'ENOTFOUND']);
  if (connectionCodes.has(error?.code) || /connection|database_url|authentication|password/i.test(String(error?.message || ''))) {
    console.error('Revise DATABASE_URL, DATABASE_URL_UNPOOLED e as variáveis de ambiente da Vercel.');
  } else if (String(error?.code || '').startsWith('42')) {
    console.error('A conexão funcionou, mas uma migração contém SQL inválido. Revise o código e a mensagem acima.');
  } else {
    console.error('A conexão foi iniciada, mas a preparação falhou. Revise o código e a mensagem acima antes de alterar credenciais.');
  }
  process.exit(1);
}
