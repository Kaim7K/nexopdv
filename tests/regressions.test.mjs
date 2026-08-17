import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [api, http, media, app, sales, fiados, audits, stock, users, settings, adminMarkets, layout, receipt, receiptPdf, metadata, robots, vercel, cashContext, pdv, cashModal, login] = await Promise.all([
  Promise.all([
    read('api/index.js'),
    read('server/entities/routes.js'),
    read('server/sales/routes.js'),
    read('server/cash/routes.js'),
    read('server/platform/routes.js'),
    read('server/request-context.js'),
    read('server/module-access.js'),
  ]).then(files => files.join('\n')),
  read('server/http.js'),
  read('server/media.js'),
  read('src/App.jsx'),
  read('src/pages/Vendas.jsx'),
  read('src/pages/Fiados.jsx'),
  read('src/pages/AuditoriaGeral.jsx'),
  read('src/pages/Estoque.jsx'),
  read('src/pages/Usuarios.jsx'),
  read('src/pages/Configuracoes.jsx'),
  read('src/pages/AdminMercados.jsx'),
  read('src/components/Layout.jsx'),
  read('src/components/pdv/ReceiptModal.jsx'),
  read('src/lib/sales-pdf.js'),
  read('src/hooks/use-page-metadata.js'),
  read('public/robots.txt'),
  read('vercel.json'),
  read('src/lib/CashRegisterContext.jsx'),
  read('src/pages/PDV.jsx'),
  read('src/components/pdv/CashRegisterModal.jsx'),
  read('src/pages/Login.jsx'),
]);

assert.match(api, /WITH existing AS MATERIALIZED[\s\S]*sale_number AS[\s\S]*INSERT INTO nexo\.records[\s\S]*UPDATE nexo\.records product[\s\S]*INSERT INTO nexo\.records\(market_id, entity, data\)/, 'A conclusão da venda deve manter idempotência, numeração, venda, estoque e fiado na mesma instrução atômica.');
assert.match(api, /sql\.transaction\(\(?tx\)?\s*=>\s*\[/, 'O cancelamento deve executar venda, estoque, fiado e auditoria em transação.');
assert.match(api, /fiado\.data->>'sale_id'=\$\{saleId\}[\s\S]*fiado\.data->>'status' IN \('pendente','quitado'\)/, 'Cancelar uma venda deve cancelar e estornar o fiado relacionado.');
assert.match(api, /cancellation_operation_id/, 'O cancelamento deve impedir devolução duplicada do estoque.');
assert.match(api, /const cancellationReason = text\(req\.body\.reason, 500\)/, 'O motivo do cancelamento deve ser limitado e normalizado.');
assert.match(api, /DUPLICATE_BARCODE/, 'O backend deve rejeitar códigos de barras duplicados.');
assert.match(api, /PRODUCT_PRICE_CHANGED/, 'O backend deve rejeitar uma venda com preço desatualizado ou manipulado.');
assert.match(api, /assertSameOriginRequest\(req\)/, 'A API deve validar a origem das operações de escrita.');
assert.match(http, /REQUEST_TOO_LARGE/, 'A API deve limitar o tamanho do corpo JSON.');
assert.match(http, /content-length/, 'A API deve rejeitar corpos grandes antes de acumular em memoria.');
assert.match(http, /!res\.getHeader\('Cache-Control'\)/, 'Rotas com cache explicito nao devem ser sobrescritas pelo helper JSON.');
assert.match(media, /isPrivateAddress/, 'A importação remota de imagens deve bloquear endereços privados.');
assert.match(media, /lookup\(parsed\.hostname/, 'O host remoto deve ter seus endereços DNS validados.');
assert.match(media, /redirect: 'manual'/, 'Redirecionamentos de imagens remotas devem ser validados manualmente.');

assert.match(app, /isLoadingAuth && !isPublicRoute/, 'Landing e login não devem aguardar a consulta de sessão para aparecer.');
assert.match(sales, /nexoApi\.sales\.list/, 'O histórico de vendas deve usar paginação e filtros no servidor.');
assert.match(sales, /downloadSaleReceiptPdf/, 'O histórico deve permitir baixar o recibo de uma venda.');
assert.match(sales, /downloadDailySalesReportPdf/, 'A tela de vendas deve gerar relatório diário em PDF.');
assert.match(fiados, /usePagination\(filtered, 20\)/, 'Fiados devem paginar resultados renderizados.');
assert.match(audits, /usePagination\(filtered, 25\)/, 'Auditoria deve paginar resultados renderizados.');
assert.match(stock, /usePagination\(filtered, pageSize\)/, 'Estoque deve paginar resultados conforme a quantidade escolhida.');
assert.match(stock, /entities\.Product\.delete/, 'Produtos devem poder ser excluídos pela tela de estoque.');
assert.match(users, /entities\.User\.delete/, 'Usuários devem poder ser excluídos pela tela administrativa.');
assert.match(settings, /maintenance\.reset/, 'A limpeza seletiva deve usar uma rota de manutenção protegida.');
assert.match(settings, /Exigir abertura para vendedores/, 'O administrador do mercado deve controlar a exigência de caixa.');
assert.match(adminMarkets, /require_cash_register/, 'O superadministrador deve configurar a exigência de caixa por mercado.');
assert.match(layout, /config\.logo_url \|\| user\.logo_url/, 'A sidebar deve usar a logo enviada pelo mercado.');
assert.match(layout, /CashRegisterProvider/, 'O layout deve fornecer uma fonte unica para o estado do caixa.');
assert.match(receipt, /downloadSaleReceiptPdf/, 'O modal de recibo deve usar o gerador compartilhado.');
assert.match(receiptPdf, /doc\.addImage/, 'O recibo em PDF deve inserir a logo do mercado.');
assert.match(api, /user\.role !== 'admin'.*zerar dados do mercado/s, 'Somente administradores podem zerar dados.');
assert.match(api, /CASH_REGISTER_REQUIRED/, 'O backend deve impedir venda obrigatória sem caixa aberto.');
assert.match(cashContext, /status = cashState\.session \? 'aberto' : 'fechado'/, 'O status do caixa deve ser centralizado como aberto ou fechado.');
assert.match(pdv, /cashPromptDismissed/, 'O PDV nao deve reabrir o modal de caixa apos o usuario continuar sem caixa.');
assert.doesNotMatch(pdv, /onClose=\{\s*cashState\.required && !cashState\.session/s, 'O modal de abertura nao deve impedir logout ou navegacao com caixa fechado.');
assert.match(pdv, /discardLocalDraft\(\{ notifyWhenVisible: false \}\)/, 'Fechar caixa deve limpar rascunhos e vendas temporarias do PDV.');
assert.match(cashModal, /Continuar no sistema/, 'O resumo final do fechamento deve permitir continuar navegando.');
assert.match(cashModal, /> Sair/, 'O resumo final do fechamento deve oferecer sair da conta.');
assert.match(login, /<span>Lembrar-me<\/span>/, 'O login deve manter a opcao de lembrar compacta.');
assert.doesNotMatch(login, /Manter conectado|continuar.{0,20}logado/s, 'O login nao deve exibir explicacao longa sobre lembrar sessao.');
assert.match(api, /deletionAudit[\s\S]*target AS MATERIALIZED[\s\S]*FROM target[\s\S]*EXISTS \(SELECT 1 FROM audit\)/, 'A exclusão definitiva deve bloquear a venda e registrar auditoria atomicamente antes de removê-la.');
assert.match(api, /path\[0\] === 'sales' && path\[1\] === 'report'/, 'A API deve oferecer relatório diário de vendas.');
assert.match(api, /path\[0\] === 'products' && path\[1\] === 'catalog'/, 'O catálogo leve deve evitar carregar imagens completas junto com os produtos.');
assert.match(api, /parseFiltersQuery/, 'Filtros JSON invalidos devem retornar erro controlado.');
assert.match(api, /INVALID_FILTERS/, 'Filtros invalidos da API generica devem retornar 400 em vez de erro interno.');
assert.match(api, /path\[0\] === 'auth' && path\[1\] === 'logout'[\s\S]*await assertDatabaseReady/, 'Logout deve limpar a sessao mesmo quando o banco nao estiver disponivel.');
assert.match(stock, /Última venda/, 'O estoque deve mostrar a última venda de cada produto.');
assert.match(stock, /Apagar inativos/, 'O estoque deve permitir apagar produtos sem venda há dois meses.');
assert.match(receiptPdf, /Vendas do período/, 'O relatório deve detalhar as vendas do período.');

assert.match(metadata, /og:title/, 'Metadados Open Graph devem acompanhar a página atual.');
assert.match(metadata, /twitter:description/, 'Metadados do Twitter devem acompanhar a página atual.');
assert.match(robots, /Disallow: \/pdv/, 'Páginas privadas não devem ser indexadas.');
assert.match(vercel, /X-Robots-Tag/, 'Rotas privadas devem receber cabeçalho noindex.');
assert.match(vercel, /Content-Security-Policy/, 'A produção deve aplicar uma política de segurança de conteúdo.');
assert.match(vercel, /sitemap\.xml/, 'A configuração deve expor o sitemap público.');

console.log('Teste de regressões aprovado.');
