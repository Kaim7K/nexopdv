# Lançamento: planos, produto e landing

## O que foi implementado

A definição comercial está em `src/lib/plan-catalog.js`, compartilhada pelo servidor e pela interface:

| Modelo       | Mensalidade proposta | Usuários ativos | Operação                                                                                              |
| ------------ | -------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| Essencial    | R$ 29,90             | 1               | Vendas, recibos, produtos, importação/exportação, relatórios básicos e receitas/despesas pagas        |
| Profissional | R$ 59,90             | 5               | Essencial + vendas simultâneas, fiados, edição em lote, fornecedores, contas e análises avançadas     |
| Completo     | R$ 99,90             | 15              | Profissional + caixa, DRE, metas, conciliação, permissões financeiras avançadas, compras e automações |

Os modelos são identificados por marcadores internos em `enabled_features`, campo JSON já existente. Não há migração de schema, alteração de autenticação ou atualização automática de contratos. Planos antigos sem marcador mantêm seus módulos e recursos contratados. Segurança básica, recibos e responsividade não são bloqueados por plano.

As restrições são verificadas na API e refletidas na interface. O Essencial oferece telas próprias para relatórios básicos e lançamentos pagos; vendas não exigem abertura de caixa no Essencial/Profissional, mesmo com uma configuração antiga de caixa obrigatório. A criação e a reativação de usuários usam transação com bloqueio da linha do mercado e verificação de capacidade no próprio comando de escrita. A troca administrativa para um novo modelo é bloqueada se exceder o limite de usuários ou deixar caixas abertos inacessíveis.

## Ativação comercial em produção

1. Publicar o código e entrar como Super Admin em Planos.
2. Criar um novo plano e escolher um dos três **Modelos de lançamento**. Conferir e salvar. Repetir para os outros modelos desejados. Isso cria ofertas novas; não modifica as assinaturas existentes.
3. A rota pública `GET /api/public/plans` retorna somente nome, chave, preço e limite dos modelos ativos que correspondem integralmente à definição comercial. Configurações divergentes, planos antigos e rascunhos não são publicados.
4. A landing exibe os preços somente após essa confirmação; em indisponibilidade, ausência de configuração ou sem JavaScript, apresenta **Sob consulta**, com contratação assistida pelo WhatsApp. O HTML principal continua estático e indexável. O JSON-LD não anuncia valores ainda não confirmados.
5. Vincular um cliente a um novo modelo continua sendo uma ação administrativa explícita pelo fluxo existente. Essa ação utiliza o comportamento de assinatura já existente no sistema; deve ser feita apenas para a contratação ou mudança efetivamente combinada com o cliente.

Nenhum registro do banco de produção foi consultado ou alterado nesta execução: o workspace não possui `DATABASE_URL`/`JWT_SECRET` configurados. A ativação dos registros comerciais, a publicação e a conferência de persistência no PostgreSQL de produção permanecem etapas operacionais. Os preços propostos não são cobrados automaticamente por estas alterações.

Não foi implementado cadastro público, checkout, teste de sete dias ou desconto anual. O briefing permite solicitação de demonstração quando não existe teste público. Os CTAs de demonstração e plano abrem o WhatsApp **+55 71 98479-3504** com mensagem contextual, sem envio automático.

## Capturas do produto

`public/landing/product/` contém capturas da interface React atual, com o banco local de demonstração do aplicativo. Não são imagens geradas nem reconstruções do software. Uma venda foi concluída no ambiente local para capturar pagamento e recibo; o fluxo foi verificado também em viewport mobile. As imagens são identificadas como dados de demonstração. O controle exclusivo de simulação de cargos, que não existe em produção, é ocultado durante a captura.

Para atualizar o material, iniciar um dev server isolado com `VITE_MOCK_API=true` em `127.0.0.1:5177` e executar `npm run capture:landing`. O script recusa operações se o banco mock local não existir. Não usa credenciais nem dados reais de usuários.

## Mensuração e privacidade

A landing emite o evento DOM `nexo:marketing`, sem requisições, armazenamento ou identificadores. `detail` contém somente `action`, `placement` e, quando aplicável, `plan`. Ações disponíveis: `request_demo`, `view_product`, `select_plan` e `whatsapp`. Nenhum evento de cadastro é inventado: não há cadastro público.

Uma ferramenta de analytics poderá escutar esses eventos após ser configurada e obter o consentimento aplicável. Nenhum Google Analytics, pixel ou serviço externo de coleta foi ativado. Os testes impedem a abertura real do WhatsApp durante a validação dos cliques.

## Validação

- `npm run build`: build Vite e pré-renderização isolada da landing.
- `npm test`: suítes existentes e testes das regras comerciais, bloqueios de endpoints, campos públicos e preservação de contratos antigos.
- `npm run typecheck` e `npm run lint`.
- `npm run test:seo`: HTTP/XML, robots, metadados, Google Search Console, HTML sem JavaScript, imagens, navegação, comparativo responsivo, preços condicionais, eventos e redirecionamentos privados sem autenticação.
- `npm run test:launch`: regras e testes de navegador com três modelos em 1366px/390px, vendas concluídas, recibos, controles restritos e despesa básica. Requer o dev server mock isolado descrito acima.

Os testes de navegador usam dados locais, não substituem uma homologação com PostgreSQL/serviços externos reais. Não confirmam entrega de e-mails, compatibilidade de um leitor físico, políticas comerciais de cancelamento ou emissão fiscal. A landing não promete operação offline nem NFC-e/NF-e.
