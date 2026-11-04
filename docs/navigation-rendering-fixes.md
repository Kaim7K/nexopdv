# Correções de renderização da navegação

O checkpoint desta etapa é `85c775f`, que contém o diagnóstico. As mudanças afetam a apresentação e o trabalho do navegador; não alteram API, consultas de dados de relatórios, cálculos ou banco.

- Estoque monta somente a tabela ou a lista, usando o mesmo breakpoint de 1280 px do CSS. O modo grade permanece disponível. Antes da troca de apresentação, o campo focado dentro da tabela recebe blur para confirmar seu rascunho no estado pai. Isso preserva a edição antes que o campo seja desmontado; o salvamento automático existente continua responsável por gravar o registro.
- Vendas monta somente cards ou tabela. Um `ResizeObserver` acompanha a largura do contêiner, mantendo o limite de 1080 px do CSS. A troca funciona também ao recolher o menu, sem depender apenas da largura da janela. Filtros, paginação, detalhes e ações continuam no componente pai.
- Relatórios deixou de repetir `ManagementPanel` e sua consulta de gestão. Esse painel permanece na Visão geral. Os indicadores, rankings, exportações e limites históricos do relatório não foram reduzidos.
- Gráficos de Relatórios e Financeiro usam `isAnimationActive={false}` em áreas, barras, linhas e pizza. Os valores aparecem diretamente; os dados, legendas e tooltips permanecem. Sombras e blur gerais não foram removidos, pois a investigação não demonstrou ganho consistente com sua retirada.

## Verificação e tamanho da árvore renderizada

`npm run test:navigation-rendering` compila o checkpoint e a versão atual. Compara os produtos visíveis e o conteúdo das vendas em 390, 1024, 1279, 1280, 1440 e 1920 px, filtro do estoque, detalhes de venda, troca de apresentação ao recolher o menu e indicadores/rankings de relatórios. Os textos dos SVGs são excluídos dessa última comparação porque os rótulos de pizza agora aparecem imediatamente, enquanto antes dependiam da animação; os cálculos continuam cobertos pela suíte existente.

O banco local é comparado integralmente antes de uma edição explícita do teste. Depois, um nome é digitado na tabela, a janela é reduzida sem desfocar manualmente, a lista mostra o nome revisado e o retorno à tabela mantém o valor. O teste espera o salvamento automático e confirma que todos os outros produtos permanecem idênticos. Essa gravação usa somente o contexto de demonstração descartável.

Contagem de elementos dentro de `main`, com os mesmos dados de demonstração:

| Tela e largura | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| Estoque, 390 px | 2.762 | 997 | 64% |
| Estoque, 1440 px | 2.762 | 2.014 | 27% |
| Vendas, 390 px | 1.942 | 1.314 | 32% |
| Vendas, 1440 px | 1.942 | 804 | 59% |

A consulta de gestão na abertura de Relatórios passou de uma para zero. As contagens medem a árvore montada, não garantem a mesma redução percentual no tempo de navegação. O resultado completo fica em `artifacts/refactor/navigation-rendering/comparison.json` e as capturas inspecionadas em `artifacts/refactor/navigation-rendering/visual/`.

As alterações foram preparadas no código local. Não houve publicação nem alteração de dados de produção nesta etapa.

A suíte existente, tipos, lint, build, comparação de navegador e verificação do bundle passaram. As capturas de Estoque, Vendas e Relatórios foram conferidas em desktop e celular. O JavaScript inicial continua com aproximadamente 335 KB antes da compressão, com as bibliotecas pesadas fora da árvore inicial.
