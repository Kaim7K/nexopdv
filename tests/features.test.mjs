import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [api, form, imageUpload, stock, payment, minimized, pdv, reports, layout, search] = await Promise.all([
  read('api/index.js'),
  read('src/components/stock/ProductForm.jsx'),
  read('src/components/ImageUploadField.jsx'),
  read('src/pages/Estoque.jsx'),
  read('src/components/pdv/PaymentModal.jsx'),
  read('src/components/pdv/MinimizedSalesBar.jsx'),
  read('src/pages/PDV.jsx'),
  read('src/pages/Relatorios.jsx'),
  read('src/components/Layout.jsx'),
  read('server/product-images.js'),
]);

assert.match(api, /product-images.*search/s, 'A API deve expor busca de imagens.');
assert.match(form, /ImageUploadField/, 'O formulário deve usar o campo compartilhado de upload.');
assert.match(imageUpload, /optimizeImageFile/, 'O campo de imagem deve otimizar o arquivo local antes de salvar.');
assert.doesNotMatch(imageUpload, /@vercel\/blob\/client/, 'O upload local não deve depender do Vercel Blob.');
assert.match(form, /Criar e duplicar/, 'O cadastro completo deve permitir criar e duplicar.');
assert.match(stock, /toggleSort/, 'O estoque deve permitir ordenação de colunas.');
assert.match(stock, /mode: 'duplicate'/, 'O estoque deve permitir duplicar produtos.');
assert.match(payment, /input\.focus\(\)/, 'O campo de valor deve receber foco ao escolher o pagamento.');
assert.match(payment, /text-4xl/, 'O total do pagamento deve ter destaque visual.');
assert.match(minimized, /DragDropContext/, 'Vendas minimizadas devem permitir reordenação vertical.');
assert.match(pdv, /nextMinimized = minimizedSales\.map/, 'A venda atual deve ser trocada sem exigir nova minimização manual.');
assert.doesNotMatch(reports, /bg-white/, 'Relatórios não devem forçar cartões brancos no tema escuro.');
assert.doesNotMatch(layout, /active \? 'text-sidebar-primary'/, 'O ícone ativo não pode perder contraste no menu.');
assert.match(search, /searchGoogleImages\(context\.barcode/, 'A busca deve consultar primeiro o código de barras.');
assert.match(search, /searchGoogleImages\(context\.name/, 'Sem resultado pelo código, a busca deve consultar o nome do produto.');
assert.doesNotMatch(search, /imageGeometryScore|productSimilarity/, 'A busca não deve filtrar imagens por adequação, formato ou similaridade.');

console.log('Teste das novas funcionalidades aprovado.');
