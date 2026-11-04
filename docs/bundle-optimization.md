# Redução do carregamento inicial

O checkpoint desta etapa é `30e4c74`. A medição usa o manifesto do build de produção: percorre o arquivo de entrada e suas dependências estáticas, sem percorrer imports dinâmicos. Soma os bytes dos arquivos JavaScript, sem compressão. Não inclui CSS, fontes, imagens nem os módulos específicos de cada página.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| JavaScript na árvore estática inicial | 1.236.659 bytes | 335.330 bytes |
| Gráficos, arrastar e soltar e PDF nessa árvore | Presentes | Ausentes |

A redução é de 72,9% nessa medida. Não significa uma redução equivalente no tamanho total da aplicação ou no tempo de carregamento de toda página. As bibliotecas continuam disponíveis e são transferidas quando a função correspondente é aberta.

A configuração anterior de `manualChunks` permitia incorporar dependências compartilhadas aos blocos de funcionalidades. Isso criava relações que faziam o arquivo inicial depender dos blocos de gráficos, PDF e arrastar e soltar, apesar dos imports dinâmicos nas telas. `onlyExplicitManualChunks` restringe a inclusão aos módulos escolhidos. A seleção do bloco React também passou a identificar os pacotes pelo nome completo, incluindo suas dependências compartilhadas, em vez de agrupar qualquer pacote cujo nome começasse com `react`. Isso mantém bibliotecas específicas fora desse bloco e evita o ciclo encontrado na primeira tentativa de configuração.

`npm run build` gera o build e o HTML público. Depois, `npm run check:bundle` verifica a árvore inicial e rejeita dependências estáticas dos blocos `charts`, `dnd`, `pdf` e `xlsx`. O resultado fica em `artifacts/refactor/bundle/initial-bundle.json`.

`npm run test:bundle-loading` compila uma versão de demonstração e a serve com preview, usando armazenamento descartável. Confere a ausência das quatro bibliotecas no login e na Visão geral, a carga dos gráficos no Financeiro, a minimização e restauração de uma venda, o download de Excel no Estoque e o download de PDF em Vendas. Confere que os registros do banco local permanecem iguais e que não ocorreram erros de JavaScript. O teste usa os caminhos de exportação reais do cliente, com dados locais de demonstração.

Nenhuma funcionalidade ou conteúdo do usuário foi removido. Não houve alterações de API, banco, regras financeiras ou implantação. O ambiente local e os simuladores de cargo foram preservados.

A suíte existente, tipos, lint, build, verificação do manifesto e teste de navegador do build passaram. Os arquivos JavaScript solicitados pelo teste ficam registrados em `artifacts/refactor/bundle/browser-requests.json`.
