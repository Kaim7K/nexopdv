# Carregamento por período no Financeiro

O checkpoint desta etapa é `d93d5aa`. O cliente HTTP já compartilha consultas iguais e mantém os prazos de cache existentes; esta etapa não acrescenta outro cache nem altera esses prazos.

O resumo principal usa uma sequência de solicitações para publicar somente a resposta da carga mais recente. Respostas e falhas antigas não substituem os valores atuais, o erro ou o estado de carregamento. A sequência também é invalidada ao sair da página. Bootstrap e dashboard continuam sendo consultados em paralelo e publicados juntos.

Movimentações, recebíveis e conciliação compartilham `useFinancePeriodData`. Cada efeito ignora a própria resposta após troca de datas ou desmontagem, incluindo mensagens de erro tardias. Uma falha atual continua exibindo sua mensagem. O tratamento de consultas substituídas respeita o código `REQUEST_REPLACED` já usado pelo cliente.

Os quatro carregamentos dependem dos valores `from` e `to`, em vez da identidade do objeto de período. Selecionar novamente as mesmas datas não inicia outra carga. O botão de atualização do resumo e as revisões após operações continuam executando a carga explícita. Não foram alterados filtros, limites, cálculos, contratos de API ou operações financeiras.

`npm run test:finance-period` usa o servidor local mock e contextos descartáveis em 1366 e 390 px. Controla a ordem das respostas para verificar que o período mais recente prevalece, erros antigos e erros após sair do painel são ignorados, falhas atuais são exibidas e a nova tentativa recupera os dados. Também verifica repetição das mesmas datas, atualização manual e igualdade integral do banco local antes e depois. Os registros ficam em `artifacts/refactor/finance-period/races.json`.

## Estabilidade do ambiente local

Durante a validação foi reproduzido um `504 Outdated Optimize Dep` no módulo de login, que impedia a abertura da página. O pré-renderizador SSR de produção utilizava a pasta padrão de cache do Vite, compartilhada com o servidor local. Seu cache agora fica separado em `artifacts/vite-prerender-cache`. A descoberta de dependências foi limitada a `index.html`, evitando varrer HTML dos builds descartáveis dos testes. O cache gerado anterior foi preservado em uma pasta de artefatos e o servidor foi reiniciado; dados do navegador não foram apagados.

Essa correção trata uma falha reproduzida no ambiente local. Não confirma a causa do relato anterior de tela branca, cujo endereço e sessão não foram identificados.

A suíte existente, tipos, lint, build, verificação do bundle, comparação normal dos painéis e os testes de concorrência passaram. O hash do manifesto de dependências de desenvolvimento permaneceu idêntico antes e depois do build de produção, registrado em `artifacts/refactor/finance-period/cache-isolation.json`. Os testes de navegador foram repetidos após esse build e passaram nas duas larguras. O servidor local permanece ativo com os três simuladores de cargo.
