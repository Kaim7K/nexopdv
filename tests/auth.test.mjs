import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { authenticateCredentials } from '../server/auth.js';

const password = 'SenhaForte-123';
const password_hash = await bcrypt.hash(password, 4);
const storedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@nexopdv.com.br',
  password_hash,
  full_name: 'Administrador Nexo',
  role: 'super_admin',
  photo_url: null,
  market_id: null,
  market_name: null,
  logo_url: null,
  primary_color: null,
  secondary_color: null,
  enabled_modules: [],
};

const sql = async () => [storedUser];

const authenticated = await authenticateCredentials(sql, {
  email: ' ADMIN@NEXOPDV.COM.BR ',
  password,
});
assert.equal(authenticated.id, storedUser.id);

await assert.rejects(
  authenticateCredentials(sql, { email: storedUser.email, password: 'senha-errada' }),
  error => error.code === 'INVALID_CREDENTIALS' && error.status === 401,
);

await assert.rejects(
  authenticateCredentials(sql, { email: 'email-invalido', password }),
  error => error.code === 'INVALID_CREDENTIALS_FORMAT' && error.status === 400,
);

console.log('Teste de autenticação aprovado.');
