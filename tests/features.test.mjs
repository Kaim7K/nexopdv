import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [api, form, imageUpload, stock, users, settings, receipt, receiptPdf, payment, minimized, pdv, reports, layout, search, imageSearchUi, css] = await Promise.all([
  read('api/index.js'),
  read('src/components/stock/ProductForm.jsx'),
  read('src/components/ImageUploadField.jsx'),
  read('src/pages/Estoque.jsx'),
  read('src/pages/Usuarios.jsx'),
  read('src/pages/Configuracoes.jsx'),
  read('src/components/pdv/ReceiptModal.jsx'),
  read('src/lib/sales-pdf.js'),
  read('src/components/pdv/PaymentModal.jsx'),
  read('src/components/pdv/MinimizedSalesBar.jsx'),
  read('src/pages/PDV.jsx'),
  read('src/pages/Relatorios.jsx'),
  read('src/components/Layout.jsx'),
  read('src/lib/google-image-search.js'),
  read('src/components/stock/ProductImageSearch.jsx'),
  read('src/index.css'),
]);

assert.match(api, /product-images.*config/s, 'A API deve expor a configuração pública da busca de imagens.');
assert.match(form, /ImageUploadField/, 'O formulário deve usar o campo compartilhado de upload.');
assert.match(imageUpload, /optimizeImageFile/, 'O campo de imagem deve otimizar o arquivo local antes de salvar.');
assert.doesNotMatch(imageUpload, /@vercel\/blob\/client/, 'O upload local não deve depender do Vercel Blob.');
assert.match(form, /Criar e duplicar/, 'O cadastro completo deve permitir criar e duplicar.');
assert.match(stock, /toggleSort/, 'O estoque deve permitir ordenação de colunas.');
assert.match(stock, /openProductModal\('duplicate'/, 'O estoque deve permitir duplicar produtos.');
assert.match(stock, /handleDeleteProduct/, 'O estoque deve permitir excluir produtos.');
assert.match(stock, /Atualizar estoque/, 'Produtos zerados devem exibir um alerta destacado para atualização.');
assert.match(stock, /bg-red-500\/10/, 'Produtos sem estoque devem receber destaque vermelho.');
assert.match(stock, /entities\.Product\.delete/, 'A exclusão do produto deve usar a API protegida.');
assert.match(users, /removeUser/, 'A tela de usuários deve permitir exclusão controlada.');
assert.match(users, /entities\.User\.delete/, 'A exclusão de usuário deve usar a API protegida.');
assert.match(api, /Você não pode excluir o próprio usuário/, 'O backend deve impedir a exclusão do próprio usuário.');
assert.match(api, /Mantenha pelo menos um administrador ativo/, 'O backend deve preservar ao menos um administrador.');
assert.match(settings, /Zerar dados de uma tela/, 'Configurações deve oferecer limpeza seletiva de dados.');
assert.match(settings, /Digite ZERAR/, 'A limpeza seletiva deve exigir confirmação explícita.');
assert.match(api, /path\[0\] === 'maintenance' && path\[1\] === 'reset'/, 'A API deve expor a operação protegida de limpeza seletiva.');
assert.match(receipt, /downloadSaleReceiptPdf/, 'O modal deve usar o gerador compartilhado de recibos.');
assert.match(receiptPdf, /loadLogoForPdf/, 'A geração do PDF deve carregar a logo do mercado.');
assert.match(receiptPdf, /doc\.addImage/, 'A logo deve ser inserida no PDF.');
assert.match(payment, /input\.focus\(\)/, 'O campo de valor deve receber foco ao escolher o pagamento.');
assert.match(payment, /text-4xl/, 'O total do pagamento deve ter destaque visual.');
assert.match(minimized, /DragDropContext/, 'Vendas minimizadas devem permitir reordenação vertical.');
assert.match(pdv, /nextMinimized = minimizedSales\.map/, 'A venda atual deve ser trocada sem exigir nova minimização manual.');
assert.match(pdv, /CashRegisterModal/, 'O PDV deve controlar abertura e fechamento do caixa.');
assert.match(pdv, /Finalize ou descarte as vendas abertas antes de fechar o caixa/, 'O caixa não deve fechar enquanto houver vendas locais abertas.');
assert.match(layout, /config\.logo_url \|\| user\.logo_url/, 'A barra lateral deve usar a logo enviada pelo mercado.');
assert.doesNotMatch(reports, /bg-white/, 'Relatórios não devem forçar cartões brancos no tema escuro.');
assert.doesNotMatch(layout, /active \? 'text-sidebar-primary'/, 'O ícone ativo não pode perder contraste no menu.');
assert.match(search, /searchGoogleProductImages/, 'A busca deve consultar o termo informado no modal pelo Google.');
assert.match(search, /image_dominantcolor:\s*'white'/, 'A pesquisa deve priorizar fundo branco sem alterar a consulta visível.');
assert.match(imageSearchUi, /Pesquisar novamente/, 'O usuário deve poder refazer a pesquisa sem fechar o modal.');
assert.doesNotMatch(search, /imageGeometryScore|productSimilarity|openfoodfacts/i, 'A busca não deve usar filtros próprios nem Open Food Facts.');
assert.doesNotMatch(imageSearchUi, /Google Imagens indisponível|GOOGLE_CSE_API_KEY|GOOGLE_CSE_ID/, 'A interface não deve exibir erro exigindo configuração do Google.');
assert.match(css, /--market-primary:\s*#16a06a/, 'A identidade deve voltar à cor principal antiga.');
assert.match(css, /--sidebar-background:\s*165 30% 9%/, 'A paleta antiga da barra lateral deve ser preservada.');
assert.match(css, /--font-body:\s*'Montserrat'/, 'A fonte Montserrat deve continuar aplicada.');

console.log('Teste das novas funcionalidades aprovado.');
