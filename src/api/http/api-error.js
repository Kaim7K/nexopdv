const STATUS_MESSAGES = {
  400: 'Revise os dados informados e tente novamente.',
  401: 'Sua sessão expirou. Faça login novamente.',
  403: 'Seu usuário não tem permissão para esta ação.',
  404: 'A informação solicitada não foi encontrada.',
  409: 'Não foi possível concluir porque há dados conflitantes.',
  413: 'O arquivo ou solicitação ultrapassa o tamanho permitido.',
  429: 'Há muitas tentativas em sequência. Aguarde um instante.',
  500: 'O servidor encontrou um problema. Tente novamente em instantes.',
  503: 'O sistema está temporariamente indisponível. Tente novamente em instantes.',
};

export function buildApiError({ response, data, path }) {
  return Object.assign(
    new Error(data?.message || STATUS_MESSAGES[response.status] || 'Erro ao acessar o servidor.'),
    {
      status: response.status,
      code: data?.code || `HTTP_${response.status}`,
      requestId: data?.requestId,
      data,
      path,
      retryable: response.status >= 500 || response.status === 429,
    },
  );
}

export function buildConnectionError(cause, timedOut) {
  const aborted = cause?.name === 'AbortError';
  const code = timedOut ? 'REQUEST_TIMEOUT' : aborted ? 'REQUEST_REPLACED' : 'NETWORK_ERROR';
  const message = timedOut
    ? 'O servidor demorou para responder. Tente novamente.'
    : aborted
      ? 'A busca anterior foi substituída.'
      : 'Não foi possível conectar ao servidor.';
  return Object.assign(new Error(message), { code, cause });
}
