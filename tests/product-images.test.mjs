import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [client, modal, api, env, vercel] = await Promise.all([
  read('src/lib/google-image-search.js'),
  read('src/components/stock/ProductImageSearch.jsx'),
  read('api/index.js'),
  read('.env.example'),
  read('vercel.json'),
]);

assert.match(client, /cse\.google\.com\/cse\.js\?cx=/, 'A pesquisa deve usar o Google Programmable Search no navegador.');
assert.match(client, /image_dominantcolor:\s*'white'/, 'O filtro de fundo branco deve ser aplicado por trás da busca.');
assert.match(client, /defaultToImageSearch:\s*true/, 'O mecanismo deve abrir diretamente nos resultados de imagem.');
assert.match(client, /disableWebSearch:\s*true/, 'A busca deve retornar somente imagens.');
assert.match(client, /result\?\.image\?\.url/, 'A URL original da imagem deve ser extraída dos resultados do Google.');
assert.match(modal, /onSelect\(target\.url\)/, 'A seleção deve salvar somente o endereço da imagem.');
assert.match(modal, /Pesquisar novamente/, 'A pesquisa deve poder ser refeita dentro do mesmo modal.');
assert.match(modal, /barcode \|\| productName/, 'A busca automática deve priorizar o código e usar o nome como alternativa.');
assert.doesNotMatch(modal, /setQuery\([^)]*fundo branco|automaticQuery[^;]*fundo branco/i, 'O termo fundo branco não pode ser inserido no campo visível.');
assert.doesNotMatch(client + modal + api, /openfoodfacts|Open Food Facts/i, 'O sistema não deve consultar o Open Food Facts.');
assert.match(api, /path\[0\] === 'product-images' && path\[1\] === 'config'/, 'A API deve entregar somente o ID público do mecanismo do Google.');
assert.doesNotMatch(api, /GOOGLE_CSE_API_KEY/, 'A busca do navegador não deve exigir chave da JSON API.');
assert.match(env, /GOOGLE_CSE_ID=/, 'O ambiente deve documentar o ID do Google Programmable Search.');
assert.match(vercel, /cse\.google\.com/, 'A CSP deve permitir o script oficial de busca do Google.');

console.log('Teste da busca Google Imagens aprovado.');
