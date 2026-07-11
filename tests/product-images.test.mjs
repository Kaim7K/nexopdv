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

  if (url.hostname.includes('openfoodfacts.org')) {
    assert.equal(url.searchParams.get('search_terms'), 'Coca-Cola Original 2L PET', 'O catálogo deve remover apenas o termo visual fundo branco.');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        products: [{
          product_name: 'Coca-Cola Original 2L PET',
          image_front_url: 'https://images.openfoodfacts.org/coca-cola.jpg',
          image_front_small_url: 'https://images.openfoodfacts.org/coca-cola-small.jpg',
        }],
      }),
    };
  }
  if (url.hostname === 'commons.wikimedia.org') {
    assert.equal(url.searchParams.get('gsrsearch'), 'Coca-Cola Original 2L PET fundo branco');
    return { ok: true, status: 200, json: async () => ({ query: { pages: [] } }) };
  }
  throw new Error(`URL inesperada no teste: ${url}`);
};

try {
  const result = await searchProductImages({ query: 'Coca-Cola Original 2L PET fundo branco', page: 1 });
  assert.equal(result.query, 'Coca-Cola Original 2L PET fundo branco');
  assert.equal(result.results.length, 1, 'A busca pelo nome deve retornar imagens válidas sem exigir o Google.');
  assert.equal(result.results[0].title, 'Coca-Cola Original 2L PET');
  assert(calls.some(url => url.hostname.includes('openfoodfacts.org')), 'O catálogo de produtos deve ser consultado.');
  assert(calls.some(url => url.hostname === 'commons.wikimedia.org'), 'A busca visual deve ser consultada com fundo branco.');
  assert.equal(result.providers.googleCustomSearch, false, 'A busca deve continuar funcionando sem configurar o Google CSE.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GOOGLE_CSE_API_KEY; else process.env.GOOGLE_CSE_API_KEY = originalKey;
  if (originalId === undefined) delete process.env.GOOGLE_CSE_ID; else process.env.GOOGLE_CSE_ID = originalId;
}

console.log('Teste da busca de imagens aprovado.');
