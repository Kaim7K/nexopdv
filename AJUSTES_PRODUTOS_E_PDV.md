# Ajustes de produtos e PDV

## Implementado

- Upload de imagens de produtos em JPG, PNG, WEBP ou AVIF, com limite de 8 MB.
- Upload local otimizado e salvo no próprio cadastro, sem exigir Vercel Blob.
- Busca de qualquer imagem pelo código de barras; quando não há resultado, busca pelo nome do produto.
- Cinco sugestões por página, botão “Buscar mais imagens”, visualização ampliada, fonte e seleção.
- Resultados sem filtro de adequação, formato, fundo ou similaridade, permitindo inclusive imagens apenas com o nome do produto.
- Busca opcional no cadastro rápido; produto pode ser salvo e vendido sem imagem.
- Modal completo para criar, editar e duplicar produtos.
- Botão “Criar e duplicar” no cadastro completo.
- Ordenação crescente e decrescente em todas as colunas do estoque.
- Quantidade e peso editáveis diretamente na lista da venda.
- Modal de pagamento maior, valores destacados e foco automático no campo de valor.
- Total da venda destacado em verde no resumo e no pagamento.
- Troca direta entre vendas minimizadas, preservando a venda atual.
- Reordenação vertical das vendas minimizadas, mantendo-as presas à lateral.
- Correções de contraste e componentes no tema escuro.
- Ícones, botões e indicadores de atalhos ampliados.

## Configuração opcional na Vercel

1. Para ampliar os resultados da busca, adicione `GOOGLE_CSE_API_KEY` e `GOOGLE_CSE_ID` em **Production**.
2. Um Blob Store é opcional e não é necessário para enviar logo, foto de perfil ou imagem de produto.
3. Faça um novo deploy sem usar o cache anterior após alterar variáveis.

A busca do Google é complementar. Falhas de cota ou indisponibilidade não impedem cadastro, edição ou venda do produto.
