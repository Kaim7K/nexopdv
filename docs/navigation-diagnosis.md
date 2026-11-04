# Diagnóstico de navegação — 4 de novembro de 2026

O relato se refere ao site publicado. O projeto ligado a este repositório publica em `https://nexopdvnovo.vercel.app`. A consulta à Vercel mostrou produção no commit `d93d5aa`, com funções na região `iad1`. A correção local posterior `4f52e93` ainda não estava nessa implantação. Não houve publicação durante a análise.

## Medições de produção

Leituras públicas realizadas neste ambiente, sem uma sessão autenticada:

| Pedido | Tempo total | Observação |
| --- | ---: | --- |
| Login HTML | 205 ms | Cache HIT, entrada por gru1 |
| API pública de planos, tentativa 1 | 526 ms | Função iad1 |
| API pública de planos, tentativa 2 | 378 ms | Função iad1 |
| API pública de planos, tentativa 3 | 297 ms | Função iad1 |

Isso não mede o tempo das consultas autenticadas de estoque, vendas e financeiro. A consulta de logs dos últimos quinze minutos não encontrou registros; isso não comprova ausência de lentidão. Não há base para atribuir todo o atraso à região da função ou ao banco. Antes de mudar a região, é necessário confirmar também a região do banco e medir as requisições autenticadas. As medições públicas brutas estão em `artifacts/diagnostics/navigation/production-public.json`.

## Medições controladas da interface

`node scripts/profile-navigation.mjs` compila a aplicação mock, serve um preview e navega pelo menu. Os contextos são descartáveis. Usa os dados pequenos de demonstração, com atraso artificial de 80 ms na API. Compara primeira visita e retorno, um desktop normal e uma simulação de viewport de 390 px com CPU quatro vezes mais lenta, latência de rede de 80 ms e vazão de 200 KB/s. O teste utiliza cliques de mouse; não é uma medição de um telefone real.

O tempo é contado a partir do evento de clique, separado da espera do Playwright por um botão estável. Assim, o deslocamento do link ao passar o mouse não é confundido com tempo real de navegação. A disponibilidade é aproximada por montagem da rota, consultas encerradas e dois frames. Não equivale a uma medição de pintura completa ou interação real em produção. Os testes de gráficos observam também 1,7 segundo posterior para capturar tarefas longas das animações. Os imports antecipados pelo hover podem terminar antes do clique.

Uma amostra de retorno às telas, com módulos já carregados:

| Tela | Desktop | CPU lenta simulada | Tarefas longas na simulação |
| --- | ---: | ---: | ---: |
| PDV | 214 ms | 483 ms | 0 ms |
| Estoque | 187 ms | 592 ms | 214 ms |
| Vendas | 170 ms | 473 ms | 184 ms |
| Relatórios | 258 ms | 799 ms | 277 ms |
| Financeiro | 263 ms | 490 ms | 155 ms |
| Visão geral | 146 ms | 242 ms | 0 ms |

São amostras únicas por cenário, sem garantia estatística. No cenário sem efeitos CSS, os retornos de Estoque, Vendas, Relatórios e Financeiro foram 595, 546, 1.024 e 676 ms: não houve melhora consistente. Não há evidência para recomendar retirar todo o acabamento visual como principal correção. Esses testes não desativam as animações JavaScript dos gráficos. O JSON completo está em `artifacts/diagnostics/navigation/profile.json`.

## Pesos concretos encontrados no código

1. **Duas apresentações montadas ao mesmo tempo.** `StockProductViews` renderiza `StockMobileList` e `StockTable`; `Vendas` renderiza cards e tabela para os mesmos registros. CSS esconde uma versão, mas ambas criam componentes e elementos. A amostra de Estoque teve 2.762 elementos no conteúdo e Vendas 1.942, mesmo com poucos registros. Corrigir renderizando somente a apresentação correspondente ao tamanho da tela, preservando estado de edição, paginação, ações e permissões ao redimensionar.
2. **Relatórios repete o painel da página inicial.** A rota monta outro `ManagementPanel`, com uma consulta adicional de gestão e suas listas. Além disso, `loadReportData` solicita até 5.000 vendas, 500 fiados e 2.000 produtos, processados no navegador. Esse volume é um risco que cresce com a loja, não um volume observado na conta de produção. Priorizar a remoção da duplicação visual e medir o payload autenticado. Agregação no servidor é uma etapa posterior que deve preservar cobertura histórica e totais, sem simplesmente diminuir limites.
3. **Animações de gráficos reaparecem ao montar a tela.** Os componentes não definem `isAnimationActive`; o Recharts instalado usa até 1.500 ms para áreas e pizza e 400 ms para barras. Isso pode prolongar a sensação de que a tela está se formando, embora os dados já tenham chegado. Testar gráficos estáticos ou uma animação curta e respeitar a preferência por movimento reduzido. A investigação de CSS não mede esse custo isoladamente.
4. **As rotas remontam e repetem a fase de carregamento.** No mock, o retorno ao PDV chama quatro métodos da API; Relatórios quatro; Financeiro dois. Esses números são chamadas de métodos, não necessariamente pedidos reais ao servidor: o cliente HTTP de produção já tem cache e deduplicação. Medir acertos de cache e o tempo dos endpoints reais antes de acrescentar cache. Manter verificações de caixa e invalidações de venda, estoque e permissões.
5. **Latência de API e diferença entre fonte e implantação.** O pedido simples público já apresentou centenas de milissegundos. É preciso medir as rotas autenticadas e o caminho função–banco. A implantação atual também não contém a última proteção local contra respostas antigas do Financeiro.

## Ordem recomendada

Primeiro eliminar as apresentações duplicadas de Estoque e Vendas; depois simplificar a montagem de Relatórios e reduzir as animações dos gráficos. Em paralelo, medir os endpoints autenticados no site publicado, incluindo TTFB, duração, tamanho da resposta e cache. Só então decidir mudanças de consultas, região ou cache adicional. A análise não alterou dados, telas do produto ou a implantação.
