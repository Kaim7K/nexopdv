export class AppError extends Error {
  constructor(status, code, message, options = {}) {
    super(message, options);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.expose = options.expose ?? true;
  }
}

export function mapDatabaseError(error) {
  if (error instanceof AppError) return error;

  const detail = String(error?.message || '');
  if (error instanceof SyntaxError) {
    return new AppError(400, 'INVALID_INPUT', 'Os dados enviados são inválidos.');
  }
  if (error?.code === '22P02') {
    return new AppError(400, 'INVALID_IDENTIFIER', 'Um identificador enviado não é válido.');
  }
  if (error?.code === '23505') {
    return new AppError(409, 'DUPLICATE_RECORD', 'Já existe um registro com esses dados.');
  }
  if (error?.code === '23503') {
    return new AppError(409, 'RECORD_IN_USE', 'O registro está em uso e não pode ser removido.');
  }
  if (error?.code === '28P01' || /password authentication failed/i.test(detail)) {
    return new AppError(503, 'DATABASE_AUTH', 'O banco recusou as credenciais configuradas na DATABASE_URL.');
  }
  if (error?.code === '3D000') {
    return new AppError(503, 'DATABASE_NOT_FOUND', 'O banco configurado na DATABASE_URL não existe.');
  }
  if (error?.code === '42501') {
    return new AppError(503, 'DATABASE_PERMISSION', 'O usuário do banco não possui as permissões necessárias.');
  }
  if (/ENOTFOUND|fetch failed|invalid.*url|connection string|Failed to connect/i.test(detail)) {
    return new AppError(503, 'DATABASE_CONNECTION', 'Não foi possível conectar ao banco de dados configurado.');
  }

  return new AppError(500, 'INTERNAL_ERROR', 'O servidor encontrou um erro interno.', {
    cause: error,
    expose: false,
  });
}
