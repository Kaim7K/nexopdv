# Ajustes de produtos e PDV

## Implementado

- Upload de imagens de produtos em JPG, PNG, WEBP ou AVIF, com limite de 8 MB.
- Armazenamento das imagens no Vercel Blob, sem depender de URLs externas temporárias.
- Busca de imagens por código de barras, nome e nome com categoria.
- Cinco sugestões por página, botão “Buscar mais imagens”, visualização ampliada, fonte e seleção.
- Priorização de catálogo exato, transparência e fundo branco, com filtros contra banners, anúncios, lojas, prateleiras, pessoas e montagens.
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

## Configuração necessária na Vercel

1. Abra o projeto e acesse **Storage**.
2. Crie ou conecte um **Blob Store** ao projeto.
3. Confirme em **Settings → Environment Variables** a variável `BLOB_READ_WRITE_TOKEN`.
4. Para busca ampliada, adicione `GOOGLE_CSE_API_KEY` e `GOOGLE_CSE_ID` em **Production**.
5. Faça um novo deploy sem usar o cache anterior.

A busca do Google é complementar. Falhas de cota ou indisponibilidade não impedem cadastro, edição ou venda do produto.
