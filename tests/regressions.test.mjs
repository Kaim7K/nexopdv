import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [api, http, media, app, sales, fiados, audits, stock, users, settings, receipt, metadata, robots, vercel] = await Promise.all([
  read('api/index.js'),
  read('server/http.js'),
  read('server/media.js'),
  read('src/App.jsx'),
  read('src/pages/Vendas.jsx'),
  read('src/pages/Fiados.jsx'),
  read('src/pages/AuditoriaGeral.jsx'),
  read('src/pages/Estoque.jsx'),
  read('src/pages/Usuarios.jsx'),
  read('src/pages/Configuracoes.jsx'),
  read('src/components/pdv/ReceiptModal.jsx'),
  read('src/hooks/use-page-metadata.js'),
  read('public/robots.txt'),
  read('vercel.json'),
]);

assert.match(api, /WITH sale_number AS[\s\S]*INSERT INTO nexo\.records[\s\S]*UPDATE nexo\.records product[\s\S]*INSERT INTO nexo\.records\(market_id, entity, data\)/, 'A conclusão da venda deve manter numeração, venda, estoque e fiado na mesma instrução atômica.');
assert.match(api, /record\.data->>'sale_id'=cancelled\.id::text[\s\S]*record\.data->>'status'='pendente'/, 'Cancelar uma venda deve cancelar o fiado pendente relacionado.');
assert.match(api, /const cancellationReason = text\(req\.body\.reason, 500\)/, 'O motivo do cancelamento deve ser limitado e normalizado.');
assert.match(api, /DUPLICATE_BARCODE/, 'O backend deve rejeitar códigos de barras duplicados.');
assert.match(api, /PRODUCT_PRICE_CHANGED/, 'O backend deve rejeitar uma venda com preço desatualizado ou manipulado.');
assert.match(api, /assertSameOriginRequest\(req\)/, 'A API deve validar a origem das operações de escrita.');
assert.match(http, /REQUEST_TOO_LARGE/, 'A API deve limitar o tamanho do corpo JSON.');
assert.match(media, /isPrivateAddress/, 'A importação remota de imagens deve bloquear endereços privados.');
assert.match(media, /lookup\(parsed\.hostname/, 'O host remoto deve ter seus endereços DNS validados.');
assert.match(media, /redirect: 'manual'/, 'Redirecionamentos de imagens remotas devem ser validados manualmente.');

assert.match(app, /isLoadingAuth && !isPublicRoute/, 'Landing e login não devem aguardar a consulta de sessão para aparecer.');
assert.match(sales, /usePagination\(filtered, 20\)/, 'O histórico de vendas deve paginar resultados renderizados.');
assert.match(fiados, /usePagination\(filtered, 20\)/, 'Fiados devem paginar resultados renderizados.');
assert.match(audits, /usePagination\(filtered, 25\)/, 'Auditoria deve paginar resultados renderizados.');
assert.match(stock, /usePagination\(filtered, 50\)/, 'Estoque deve paginar resultados renderizados.');
assert.match(stock, /entities\.Product\.delete/, 'Produtos devem poder ser excluídos pela tela de estoque.');
assert.match(users, /entities\.User\.delete/, 'Usuários devem poder ser excluídos pela tela administrativa.');
assert.match(settings, /maintenance\.reset/, 'A limpeza seletiva deve usar uma rota de manutenção protegida.');
assert.match(receipt, /doc\.addImage/, 'O recibo em PDF deve inserir a logo do mercado.');
assert.match(api, /user\.role !== 'admin'.*zerar dados do mercado/s, 'Somente administradores podem zerar dados.');

assert.match(metadata, /og:title/, 'Metadados Open Graph devem acompanhar a página atual.');
assert.match(metadata, /twitter:description/, 'Metadados do Twitter devem acompanhar a página atual.');
assert.match(robots, /Disallow: \/pdv/, 'Páginas privadas não devem ser indexadas.');
assert.match(vercel, /X-Robots-Tag/, 'Rotas privadas devem receber cabeçalho noindex.');
assert.match(vercel, /Content-Security-Policy/, 'A produção deve aplicar uma política de segurança de conteúdo.');
assert.match(vercel, /sitemap\.xml/, 'A configuração deve expor o sitemap público.');

console.log('Teste de regressões aprovado.');
