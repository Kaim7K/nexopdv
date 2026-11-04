# Visões gerais da loja e do Financeiro

A página inicial destaca vendas concluídas hoje, quantidade de fiados pendentes e quantidade de contas vencidas ou a vencer em sete dias. Os cards e links continuam condicionados aos dados autorizados pela API. As listas de produtos preservam nomes, quantidades e destinos, com estados vazios explícitos. A indicação de queda de margem passou a usar o sinal de menos e a unidade p.p. no lugar dos caracteres incorretos anteriores.

O checklist foi colocado depois do resumo operacional, com progresso e itens expansíveis. Abre inicialmente para lojas sem vendas; a marcação de conferência mantém a mesma chave local por loja e usuário. Não há migração nem limpeza de armazenamento.

No Financeiro, os quatro indicadores receberam maior destaque, os compromissos passaram a ficar visíveis também no celular e o gráfico usa uma única árvore de componentes responsiva. Uma série vazia mostra uma mensagem em vez de um gráfico vazio. Todos os alertas recebidos são exibidos, sem o corte anterior em três itens. Os valores, ações, cálculos e contratos da API foram preservados. Os componentes de indicadores usados nas demais seções mantêm sua apresentação anterior.

`npm run test:overview` usa o servidor local mock em `http://127.0.0.1:5177` (ou `NEXO_TEST_URL`) e contextos de navegador descartáveis. Verifica as duas telas em 1440, 768, 390 e 320 px, valores, nomes de produtos, ausência de transbordamento horizontal, persistência do checklist após recarga, requisição pendente, falha e nova tentativa, abertura do formulário de entrada, série vazia e quarto alerta visível. Confere a igualdade integral do banco local antes e depois. Gera capturas em `artifacts/refactor/overview/`, incluindo tema escuro no Financeiro. Não executa gravações financeiras nem usa dados de produção.

A suíte existente, tipos, lint e a verificação das duas telas nas quatro larguras passaram. As capturas de desktop e celular foram inspecionadas visualmente.
