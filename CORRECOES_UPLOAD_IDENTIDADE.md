# Correções de upload, busca de imagens e identidade

## Upload de imagens

- Logo do mercado, foto de perfil e imagem de produto não dependem mais do Vercel Blob.
- O arquivo é redimensionado e convertido para WebP no navegador antes de ser salvo.
- O processamento possui limite de tempo e sempre encerra o indicador de progresso em caso de sucesso ou erro.
- JPG, PNG, WEBP e AVIF continuam aceitos, com limite original de 8 MB.
- URLs externas continuam disponíveis como alternativa.

## Busca de imagens de produtos

1. Pesquisa qualquer imagem usando somente o código de barras.
2. Quando não encontra resultado, pesquisa usando somente o nome do produto.
3. Não elimina imagens por dimensão, proporção, fundo, similaridade ou “adequação”.
4. Imagens com apenas o nome do produto também podem aparecer e ser selecionadas.
5. Sem Vercel Blob, a imagem selecionada é vinculada pela URL validada. Com Blob, uma cópia própria é armazenada.

## Identidade visual

- Fonte global: Montserrat.
- Pesos permitidos: Regular, Medium, Semibold e Bold; peso máximo 700.
- Verde principal: `#17A06A`.
- Grafite principal: `#1E2532`.
- Logos SVG oficiais aplicadas na landing page, login, menu lateral, favicon e PWA.
- Migração 004 atualiza somente mercados que ainda utilizavam as cores-padrão anteriores, preservando personalizações próprias.
