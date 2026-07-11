import { put } from '@vercel/blob';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from './errors.js';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function isPrivateAddress(address) {
  const host = String(address || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.local') || host === '::1' || host === '::') return true;
  const mappedIpv4 = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateAddress(mappedIpv4[1]);
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|192\.0\.0\.|198\.18\.|198\.19\.)/.test(host)) return true;
  const cgnat = host.match(/^100\.(\d+)\./);
  if (cgnat && Number(cgnat[1]) >= 64 && Number(cgnat[1]) <= 127) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

async function safeRemoteUrl(value) {
  let parsed;
  if (String(value || '').length > 2048) throw new AppError(400, 'INVALID_IMAGE_URL', 'O endereço da imagem é muito longo.');
  try { parsed = new URL(value); }
  catch { throw new AppError(400, 'INVALID_IMAGE_URL', 'A imagem selecionada possui um endereço inválido.'); }
  if (parsed.protocol !== 'https:' || isPrivateAddress(parsed.hostname)) {
    throw new AppError(400, 'INVALID_IMAGE_URL', 'A imagem selecionada não pode ser importada.');
  }

  if (!isIP(parsed.hostname)) {
    let addresses;
    let timeoutId;
    try {
      addresses = await Promise.race([
        lookup(parsed.hostname, { all: true, verbatim: true }),
        new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error('DNS timeout')), 3000); }),
      ]);
    } catch {
      throw new AppError(422, 'IMAGE_HOST_UNAVAILABLE', 'Não foi possível validar o servidor da imagem.');
    } finally {
      clearTimeout(timeoutId);
    }
    if (!addresses.length || addresses.some(record => isPrivateAddress(record.address))) {
      throw new AppError(400, 'INVALID_IMAGE_URL', 'A imagem selecionada não pode ser importada.');
    }
  }
  return parsed;
}



async function fetchRemoteImage(url, signal) {
  let current = await safeRemoteUrl(url);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const response = await fetch(current, {
      signal,
      redirect: 'manual',
      headers: { 'User-Agent': 'NexoPDV/1.0 (product-image-import)' },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new AppError(422, 'IMAGE_DOWNLOAD_FAILED', 'O servidor da imagem retornou um redirecionamento inválido.');
    current = await safeRemoteUrl(new URL(location, current).toString());
  }
  throw new AppError(422, 'IMAGE_REDIRECT_LIMIT', 'A imagem possui redirecionamentos em excesso.');
}

function matchesImageSignature(body, contentType) {
  if (contentType === 'image/jpeg') return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  if (contentType === 'image/png') return body.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (contentType === 'image/webp') return body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WEBP';
  if (contentType === 'image/avif') return body.subarray(4, 12).toString('ascii').includes('ftyp') && body.subarray(8, 24).toString('ascii').includes('avif');
  return false;
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
  const remote = await safeRemoteUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchRemoteImage(remote, controller.signal);
    if (!response.ok) throw new AppError(422, 'IMAGE_DOWNLOAD_FAILED', 'Não foi possível baixar a imagem selecionada.');
    const contentType = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Use imagens JPG, PNG, WEBP ou AVIF.');
    }
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_IMAGE_SIZE) throw new AppError(413, 'IMAGE_TOO_LARGE', 'A imagem deve ter no máximo 8 MB.');
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > MAX_IMAGE_SIZE) throw new AppError(413, 'IMAGE_TOO_LARGE', 'A imagem deve ter no máximo 8 MB.');
    if (!matchesImageSignature(body, contentType)) throw new AppError(415, 'INVALID_IMAGE_CONTENT', 'O arquivo recebido não corresponde a uma imagem válida.');

    if (!isBlobConfigured()) {
      return {
        url: response.url || remote.toString(),
        pathname: null,
        contentType,
        external: true,
      };
    }

    const pathname = `products/${marketId}/${Date.now()}-${safeName(productName)}.${extensionFor(contentType)}`;
    const blob = await put(pathname, body, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return { url: blob.url, pathname: blob.pathname, contentType: blob.contentType, external: false };
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
