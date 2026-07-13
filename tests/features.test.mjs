import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  api,
  form,
  imageUpload,
  stock,
  users,
  settings,
  receipt,
  receiptPdf,
  payment,
  minimized,
  pdv,
  reports,
  layout,
  googleImages,
  css,
] = await Promise.all([
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
  read('src/lib/google-images.js'),
  read('src/index.css'),
]);

assert.match(
  form,
  /ImageUploadField/,
  'O formulário deve usar o campo compartilhado de upload.',
);
assert.match(
  imageUpload,
  /optimizeImageFile/,
  'O campo de imagem deve otimizar arquivos locais.',
);
assert.match(
  form,
  /openGoogleImages/,
  'O formulário deve abrir a pesquisa do Google em nova aba.',
);
assert.match(
  googleImages,
  /tbm:\s*'isch'/,
  'A busca deve abrir diretamente em imagens.',
);
assert.match(
  googleImages,
  /fundo branco/,
  'A busca deve solicitar fundo branco preservando o termo principal.',
);
assert.match(
  api,
  /searchProductImages/,
  'A API deve usar o serviço atual de pesquisa de imagens.',
);
assert.match(
  stock,
  /handleDeleteProduct/,
  'O estoque deve permitir excluir produtos.',
);
assert.match(
  stock,
  /Atualizar estoque/,
  'Produtos zerados devem permitir atualização.',
);
assert.match(
  users,
  /removeUser/,
  'A tela de usuários deve permitir exclusão controlada.',
);
assert.match(
  api,
  /revokedPasswordHash/,
  'A exclusão deve revogar a senha anterior.',
);
assert.match(
  api,
  /sql\.transaction\(\(?tx\)?\s*=>\s*\[/,
  'Operações críticas devem usar transação.',
);
assert.match(
  settings,
  /Zerar dados de uma tela/,
  'Configurações deve oferecer limpeza seletiva.',
);
assert.match(
  receipt,
  /downloadSaleReceiptPdf/,
  'O modal deve usar o gerador compartilhado de recibos.',
);
assert.match(
  receiptPdf,
  /Unitário:/,
  'O recibo deve exibir preço unitário sem caracteres quebrados.',
);
assert.doesNotMatch(
  receiptPdf,
  /→/,
  'O PDF não deve usar o símbolo que gerava falhas visuais.',
);
assert.match(
  payment,
  /input\.focus\(\)/,
  'O campo de valor deve receber foco.',
);
assert.match(
  minimized,
  /DragDropContext/,
  'Vendas minimizadas devem permitir reordenação.',
);
assert.match(
  pdv,
  /PDV_DRAFT_INACTIVITY_MS/,
  'O PDV deve controlar o limite de inatividade.',
);
assert.match(
  pdv,
  /visibilitychange/,
  'O descarte deve considerar a visibilidade da tela.',
);
assert.match(
  pdv,
  /5 minutos fora do PDV/,
  'O usuário deve receber uma mensagem clara.',
);
assert.match(
  pdv,
  /CashRegisterModal/,
  'O PDV deve controlar abertura e fechamento do caixa.',
);
assert.match(
  pdv,
  /Continuar sem caixa/,
  'O vendedor deve poder acessar outros módulos sem abrir o caixa.',
);
assert.match(
  layout,
  /config\.logo_url \|\| user\.logo_url/,
  'A sidebar deve usar a logo do mercado.',
);
assert.doesNotMatch(
  reports,
  /bg-white/,
  'Relatórios não devem forçar fundo branco no tema escuro.',
);
assert.match(
  css,
  /--background:\s*220 8% 8%/,
  'O tema escuro deve usar fundo grafite.',
);
assert.match(
  css,
  /--font-body:\s*'Montserrat'/,
  'A fonte Montserrat deve permanecer aplicada.',
);

console.log('Teste das funcionalidades principais aprovado.');
