# Alterações finais — Nexo PDV

## 1. Cores antigas restauradas

- A interface voltou para a paleta anterior do projeto.
- Verde principal: `#16A06A`.
- Verde escuro de apoio: `#0F5132`.
- Textos principais da identidade: `#0F172A`.
- Barra lateral e tema escuro voltaram à composição verde original.
- A fonte Montserrat, a nova logo e as melhorias de interface foram mantidas.
- Os SVGs da marca foram ajustados para a paleta antiga.
- Foi adicionada a migração `005_restore_original_colors.sql` para corrigir mercados que já receberam as cores novas.

## 2. Exclusão de produtos

- Administradores e gerentes agora possuem um botão de exclusão na coluna **Ações** do estoque.
- A exclusão exige confirmação.
- O produto é removido do cadastro e do estoque.
- Vendas antigas continuam com os dados do item preservados no histórico.
- A operação é registrada na auditoria.
- A API valida o mercado e a permissão antes de excluir.

## 3. Exclusão de usuários

- A tela **Usuários** agora possui uma ação de exclusão.
- Administradores podem excluir usuários do próprio mercado.
- Gerentes podem excluir somente vendedores.
- O usuário atual não pode excluir a própria conta.
- O sistema impede a exclusão do último administrador ativo.
- A operação é registrada na auditoria.

## 4. Logo no recibo em PDF

- O PDF agora carrega a logo configurada para o mercado.
- A imagem é convertida para PNG antes de ser inserida no PDF, inclusive quando a logo original é SVG, WebP ou uma imagem otimizada.
- A proporção é preservada e a logo é centralizada no cabeçalho.
- Caso a imagem esteja indisponível, o PDF continua sendo gerado e exibe uma mensagem clara.
- O PDV utiliza a logo da sessão como alternativa quando ainda não existe um registro separado em configurações.

## 5. Limpeza seletiva de dados

Foi criada a seção **Zerar dados de uma tela** em Configurações, disponível apenas para administradores.

Áreas disponíveis:

- Estoque e produtos;
- Vendas fiadas;
- Histórico de vendas;
- Auditoria;
- Todos os dados operacionais.

Proteções aplicadas:

- seleção explícita da área;
- digitação obrigatória de `ZERAR`;
- confirmação adicional no navegador;
- validação de administrador no servidor;
- separação por mercado;
- usuários e configurações nunca são apagados pela limpeza operacional.

Ao limpar somente o histórico de vendas, os fiados e a sequência de numeração são mantidos para evitar conflitos com registros pendentes. Ao limpar todos os dados operacionais, a numeração das vendas volta para 1.

## 6. Busca de imagens sem erro do Google

- A mensagem que exigia `GOOGLE_CSE_API_KEY` e `GOOGLE_CSE_ID` foi removida.
- As chaves do Google agora são completamente opcionais.
- A busca consulta primeiro o código de barras.
- Sem imagem pelo código, consulta o nome do produto exatamente como informado.
- A busca aceita imagens válidas sem aplicar filtro de “adequação”, similaridade, fundo ou formato visual.
- Foram mantidos o catálogo de produtos e o Google opcional, com o Wikimedia Commons como fonte adicional sem chave.
- Um nome simples como `pipoca` já pode gerar resultados mesmo sem código de barras e sem Google CSE configurado.

## 7. Arquivos principais alterados

- `api/index.js`
- `server/product-images.js`
- `server/db.js`
- `src/api/nexoApi.js`
- `src/index.css`
- `src/pages/Estoque.jsx`
- `src/pages/Usuarios.jsx`
- `src/pages/Configuracoes.jsx`
- `src/pages/PDV.jsx`
- `src/pages/AdminMercados.jsx`
- `src/pages/Landing.jsx`
- `src/components/pdv/ReceiptModal.jsx`
- `src/components/stock/ProductImageSearch.jsx`
- `public/brand/*.svg`
- `public/nexo-icon.svg`
- `public/manifest.json`
- `index.html`
- `database/migrations/001_core_schema.sql`
- `database/migrations/005_restore_original_colors.sql`
- `.env.example`
- `package.json`
- `tests/features.test.mjs`
- `tests/product-images.test.mjs`
- `tests/regressions.test.mjs`

## 8. Validações executadas

Aprovadas:

- verificação de sintaxe do backend e scripts;
- análise de parse de 120 arquivos JavaScript, JSX, TypeScript e TSX;
- transpilação isolada de 119 arquivos;
- validação de todos os arquivos JSON;
- testes de funcionalidades;
- teste funcional da ordem de busca de imagens;
- testes de regressão.

O build completo com Vite, ESLint e os testes que dependem dos pacotes instalados não foi executado neste ambiente porque o registro do npm estava inacessível e as dependências não estavam disponíveis localmente. O projeto não inclui `node_modules`; a Vercel instalará as dependências durante o deploy.
