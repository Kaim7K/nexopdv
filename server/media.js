import { put } from '@vercel/blob';
import { AppError } from './errors.js';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function assertBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)) {
    throw new AppError(503, 'BLOB_NOT_CONFIGURED', 'O armazenamento de imagens ainda não foi conectado ao projeto na Vercel.');
  }
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function safeRemoteUrl(value) {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new AppError(400, 'INVALID_IMAGE_URL', 'A imagem selecionada possui um endereço inválido.'); }
  if (parsed.protocol !== 'https:' || isPrivateHostname(parsed.hostname)) {
    throw new AppError(400, 'INVALID_IMAGE_URL', 'A imagem selecionada não pode ser importada.');
  }
  return parsed;
}

function extensionFor(contentType) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  }[contentType] || 'jpg';
}

export function safeName(value = 'imagem') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'produto';
}

export async function importRemoteProductImage({ url, productName, marketId }) {
  assertBlobConfigured();
  const remote = safeRemoteUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(remote, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'NexoPDV/1.0 (product-image-import)' },
    });
    if (!response.ok) throw new AppError(422, 'IMAGE_DOWNLOAD_FAILED', 'Não foi possível baixar a imagem selecionada.');
    safeRemoteUrl(response.url);
    const contentType = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Use imagens JPG, PNG, WEBP ou AVIF.');
    }
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_IMAGE_SIZE) throw new AppError(413, 'IMAGE_TOO_LARGE', 'A imagem deve ter no máximo 8 MB.');
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > MAX_IMAGE_SIZE) throw new AppError(413, 'IMAGE_TOO_LARGE', 'A imagem deve ter no máximo 8 MB.');

    const pathname = `products/${marketId}/${Date.now()}-${safeName(productName)}.${extensionFor(contentType)}`;
    const blob = await put(pathname, body, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return { url: blob.url, pathname: blob.pathname, contentType: blob.contentType };
  } finally {
    clearTimeout(timeout);
  }
}

export const IMAGE_UPLOAD_KINDS = {
  product: 'products',
  market: 'markets',
  user: 'users',
};

export const PRODUCT_IMAGE_UPLOAD_RULES = {
  allowedContentTypes: [...ALLOWED_TYPES],
  maximumSizeInBytes: MAX_IMAGE_SIZE,
};
