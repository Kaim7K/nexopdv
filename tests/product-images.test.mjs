import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGoogleImagesUrl } from '../src/lib/google-images.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [form, quickModal, api, env, vercel] = await Promise.all([
  read('src/components/stock/ProductForm.jsx'),
  read('src/components/pdv/QuickProductModal.jsx'),
  read('api/index.js'),
  read('.env.example'),
  read('vercel.json'),
]);

const barcodeUrl = new URL(buildGoogleImagesUrl({ barcode: '7894900011517', productName: 'Coca-Cola 2L' }));
assert.equal(barcodeUrl.hostname, 'www.google.com');
assert.equal(barcodeUrl.pathname, '/search');
assert.equal(barcodeUrl.searchParams.get('q'), '7894900011517 fundo branco', 'O código de barras deve ter prioridade e solicitar fundo branco.');
assert.equal(barcodeUrl.searchParams.get('tbm'), 'isch', 'A pesquisa deve abrir diretamente em Imagens.');
assert(barcodeUrl.searchParams.get('q').includes('fundo branco'), 'A consulta deve explicitar a preferência por fundo branco.');

const nameUrl = new URL(buildGoogleImagesUrl({ productName: 'Pipoca Doce' }));
assert.equal(nameUrl.searchParams.get('q'), 'Pipoca Doce fundo branco');

assert.match(form, /openGoogleImages/, 'O cadastro completo deve abrir o Google Imagens.');
assert.match(form, /Buscar no Google Imagens/, 'O cadastro deve exibir a ação de pesquisa.');
assert.match(quickModal, /Pesquisar no Google Imagens/, 'O cadastro rápido deve usar o mesmo fluxo.');
assert.match(quickModal, /Cole aqui o endereço https:\/\//, 'O usuário deve poder colar o endereço escolhido.');
assert.match(api, /searchProductImages/, 'A API deve usar o serviço atual de pesquisa de imagens.');
assert.doesNotMatch(api + env, /GOOGLE_CSE_ID|GOOGLE_CSE_API_KEY/, 'A busca não deve exigir credenciais do Google.');
assert.doesNotMatch(vercel, /cse\.google\.com/, 'A CSP não deve carregar o mecanismo antigo do Google.');
assert.doesNotMatch(api + form + quickModal, /openfoodfacts|Open Food Facts/i, 'O sistema não deve usar Open Food Facts.');

console.log('Teste do fluxo Google Imagens em nova aba aprovado.');
