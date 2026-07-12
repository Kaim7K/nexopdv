const GOOGLE_IMAGES_BASE_URL = 'https://www.google.com/search';

export function buildGoogleImagesUrl({ barcode = '', productName = '' } = {}) {
  const baseQuery = String(barcode || productName || '').trim();
  if (!baseQuery) throw new Error('Informe o código de barras ou o nome do produto.');
  const query = `${baseQuery} fundo branco`.trim();

  const params = new URLSearchParams({
    q: query,
    tbm: 'isch',
    safe: 'active',
  });

  return `${GOOGLE_IMAGES_BASE_URL}?${params.toString()}`;
}

export function openGoogleImages(options = {}) {
  const url = buildGoogleImagesUrl(options);

  // Abrir primeiro uma aba vazia mantém a ação ligada ao clique do usuário e
  // evita falso positivo de bloqueio causado pelo recurso `noopener`.
  const popup = window.open('about:blank', '_blank');
  if (!popup) throw new Error('O navegador bloqueou a nova aba. Permita pop-ups para pesquisar imagens.');
  popup.opener = null;
  popup.location.replace(url);
  return url;
}
