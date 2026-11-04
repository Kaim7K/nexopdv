# Menos trabalho repetido no PDV

O checkpoint desta etapa é `53ecd71`. A alteração preserva busca, seleção, carrinho, estoque, pagamentos e limites do plano.

`ProductGrid` já usava `React.memo`, mas a função de seleção era recriada pelo PDV a cada atualização do carrinho. A função agora usa `useCallback` e mantém a mesma identidade enquanto suas dependências não mudam. A grade continua recebendo produtos atualizados e volta a renderizar quando o estoque muda após uma venda. Nenhum comparador personalizado ignora mudanças nos dados.

O limite de vendas minimizadas passa a ser obtido da mesma consulta `SystemConfig.list()` usada pelo layout. O cliente HTTP existente compartilha a consulta em andamento e seu cache de 45 segundos, evitando uma chamada filtrada adicional. A conversão do valor, o padrão de três vendas e o tratamento de falha permanecem. Não foi criado um cache de caixa, estoque ou pagamentos.

| Cenário medido em 1366 e 390 px | Antes | Depois |
| --- | ---: | ---: |
| Novas renderizações da grade ao adicionar dez vezes o mesmo produto | 10 | 0 |
| Requisições HTTP de configuração em uma abertura do PDV sem cache em memória | 2 | 1 |

Os números são contagens desses cenários, não uma garantia de redução percentual do tempo total ou do consumo de memória.

`npm run test:pdv-performance` compila o checkpoint e a versão atual e compara as duas larguras. O contador de renderização é inserido somente nos builds descartáveis de teste. As consultas de configuração usam o cliente HTTP real, com respostas interceptadas no navegador. Os demais serviços usam o banco local de demonstração de cada contexto. O teste compara catálogo, carrinho e total, seleciona um produto pela busca, verifica o limite configurado de duas vendas minimizadas, restaura uma venda com outro carrinho ativo e conclui um pagamento em dinheiro. Confere a inclusão de uma única venda e a baixa exata das quantidades, preservando produtos não vendidos. Também confirma que a grade atualiza após a mudança real de estoque. As gravações ocorrem somente nesses contextos descartáveis.

Os registros ficam em `artifacts/refactor/pdv-performance/comparison.json`. Não houve mudança de API, SQL, regras de pagamento ou dados de produção.

A suíte existente, tipos, lint, build, comparação de navegador e `check:bundle` passaram. A árvore inicial permanece em 335.330 bytes de JavaScript antes da compressão, com as bibliotecas pesadas carregadas sob demanda. O servidor local de demonstração e os três simuladores de cargo permaneceram disponíveis.
