const MAX_DATA_URL_LENGTH = 1_650_000;


function withTimeout(promise, milliseconds = 15000) {
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('O processamento da imagem demorou demais. Tente outro arquivo.')), milliseconds);
    }),
  ]).finally(() => clearTimeout(timeoutId));
}

const PROFILES = {
  user: { maxWidth: 360, maxHeight: 360, quality: 0.8 },
  market: { maxWidth: 1000, maxHeight: 520, quality: 0.84 },
  product: { maxWidth: 560, maxHeight: 560, quality: 0.8 },
  default: { maxWidth: 720, maxHeight: 720, quality: 0.82 },
};

function loadImage(file) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadWithImageElement(file));
  }
  return loadWithImageElement(file);
}

function loadWithImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível ler a imagem selecionada.'));
    };
    image.src = objectUrl;
  });
}

function calculateSize(width, height, maxWidth, maxHeight, scale = 1) {
  const ratio = Math.min(1, maxWidth / width, maxHeight / height) * scale;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function renderDataUrl(source, size, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('Seu navegador não conseguiu processar a imagem.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/webp', quality);
}

export async function optimizeImageFile(file, { kind = 'default', onProgress } = {}) {
  const profile = PROFILES[kind] || PROFILES.default;
  onProgress?.(12);
  const source = await withTimeout(loadImage(file));
  onProgress?.(42);

  const sourceWidth = Number(source.width || source.naturalWidth || 0);
  const sourceHeight = Number(source.height || source.naturalHeight || 0);
  if (!sourceWidth || !sourceHeight) throw new Error('A imagem selecionada não possui dimensões válidas.');

  let scale = 1;
  let quality = profile.quality;
  let dataUrl = '';

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const size = calculateSize(sourceWidth, sourceHeight, profile.maxWidth, profile.maxHeight, scale);
    dataUrl = renderDataUrl(source, size, quality);
    onProgress?.(55 + attempt * 6);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) break;
    quality = Math.max(0.58, quality - 0.07);
    scale *= 0.84;
  }

  source.close?.();
  if (!dataUrl || dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error('A imagem continua muito pesada após a otimização. Escolha um arquivo menor.');
  }

  onProgress?.(100);
  return dataUrl;
}

export function isSupportedImageFile(file) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file?.type);
}
