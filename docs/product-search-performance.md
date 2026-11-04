# Busca de produtos com menos processamento

O checkpoint desta etapa é `39a34af`. A busca mantém a normalização de acentos, a tolerância a erros de digitação, as prioridades de código de barras e código interno, o desempate por vendas e nome, os limites e as referências dos produtos retornados.

A consulta agora é normalizada e separada em palavras uma vez por busca. A melhor pontuação de cada palavra é usada tanto no total quanto na cobertura de palavras, eliminando a segunda rodada de comparações. A distância de edição não é calculada quando a diferença de comprimento já excede a tolerância; as regras de prefixo e trecho continuam sendo aplicadas antes dessa condição. O comparador de nomes com ordenação numérica é reutilizado.

Não foi criado um índice persistente nem um cache por produto. Mudanças de nome, código, categoria ou quantidade de vendas são lidas na próxima busca, sem invalidação adicional e sem alterar os registros.

## Medição local

`npm run benchmark:product-search` executa doze consultas em um catálogo sintético de 1.200 produtos. Confere primeiro a igualdade dos resultados, aquece as duas implementações e coleta sete amostras, alternando a ordem de execução. A mediana da rodada registrada foi:

| Implementação | Mediana das 12 consultas |
| --- | ---: |
| Checkpoint | 382,88 ms |
| Otimizada | 82,79 ms |

A redução foi de 78,4% nesse cenário. O benchmark mede a função em Node no computador local, sem rede ou renderização. Não representa uma redução equivalente do tempo total do sistema. Os resultados brutos ficam em `artifacts/refactor/search/benchmark.json`.

## Verificação

A implementação anterior está congelada em `tests/fixtures/product-search-baseline.mjs`. Os testes comparam pontuação e ordem para 162 produtos, 29 consultas e seis limites, incluindo acentos, códigos, termos incompletos, erro de digitação, valores ausentes e texto longo. Também verificam identidade dos produtos, ausência de alteração do catálogo e buscas após edição dos campos.

`npm run test:product-search` acrescenta uma comparação de builds no navegador em 1366 e 390 px. Confere sugestões e ordem, seleção pela busca, captura de código de barras pelo teclado, carrinho e total. No desktop, compara também o filtro local da grade. O banco de demonstração é comparado integralmente antes e depois; os contextos são descartáveis. Os resultados ficam em `artifacts/refactor/search/browser-comparison.json`.

Não houve alteração visual, de API, SQL, estoque, pagamento ou dados de produção.

A suíte existente, os novos testes, tipos, lint, build, comparação de navegador e verificação do bundle passaram. O JavaScript inicial permanece em 335.330 bytes antes da compressão. A versão local e os três simuladores de cargo continuam disponíveis.
