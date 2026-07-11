import assert from 'node:assert/strict';
import { searchProductImages } from '../server/product-images.js';

const originalFetch = globalThis.fetch;
const originalKey = process.env.GOOGLE_CSE_API_KEY;
const originalId = process.env.GOOGLE_CSE_ID;
delete process.env.GOOGLE_CSE_API_KEY;
delete process.env.GOOGLE_CSE_ID;

const calls = [];
globalThis.fetch = async input => {
  const url = new URL(String(input));
  calls.push(url);

  if (url.hostname.includes('openfoodfacts.org') && url.pathname.includes('/api/v2/product/')) {
    return { ok: true, status: 200, json: async () => ({ status: 0 }) };
  }
  if (url.hostname.includes('openfoodfacts.org')) {
    return { ok: true, status: 200, json: async () => ({ products: [] }) };
  }
  if (url.hostname === 'commons.wikimedia.org') {
    const query = url.searchParams.get('gsrsearch');
    if (query === 'pipoca') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          query: {
            pages: [{
              title: 'File:Pipoca.jpg',
              imageinfo: [{
                url: 'https://upload.wikimedia.org/example/pipoca.jpg',
                thumburl: 'https://upload.wikimedia.org/example/pipoca-thumb.jpg',
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Pipoca.jpg',
                mime: 'image/jpeg',
                width: 1200,
                height: 900,
              }],
            }],
          },
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ query: { pages: [] } }) };
  }
  throw new Error(`URL inesperada no teste: ${url}`);
};

try {
  const result = await searchProductImages({ barcode: '7891234567890', name: 'pipoca', page: 1 });
  assert.equal(result.queryMode, 'name', 'Sem imagem pelo código, a busca deve usar o nome.');
  assert.equal(result.results.length, 1, 'A busca pelo nome deve aceitar qualquer imagem válida encontrada.');
  assert.equal(result.results[0].title, 'Pipoca.jpg');
  assert(calls.some(url => url.searchParams.get('gsrsearch') === '7891234567890'), 'O código de barras deve ser consultado primeiro.');
  assert(calls.some(url => url.searchParams.get('gsrsearch') === 'pipoca'), 'O nome deve ser consultado quando o código não retornar imagem.');
  assert.equal(result.providers.googleCustomSearch, false, 'A busca deve funcionar sem configurar o Google CSE.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GOOGLE_CSE_API_KEY; else process.env.GOOGLE_CSE_API_KEY = originalKey;
  if (originalId === undefined) delete process.env.GOOGLE_CSE_ID; else process.env.GOOGLE_CSE_ID = originalId;
}

console.log('Teste da busca de imagens aprovado.');
