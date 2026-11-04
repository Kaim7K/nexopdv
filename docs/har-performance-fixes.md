# Otimizações orientadas pelo HAR

Implementação local, sem migração, alteração de registros ou publicação automática.

## Mudanças

- Um catálogo comprovadamente completo atende leituras com outro limite durante o TTL existente. Resultados parciais não atendem limites maiores. Vendas invalidam o catálogo, e respostas anteriores à invalidação não repovoam o cache.
- A inicialização compartilha `/system/appearance`. Logo e avatar embutidos passam a referências autenticadas e versionadas. As imagens originais permanecem no banco e nas APIs usadas pelos formulários de edição.
- A consulta de autenticação projeta referências no PostgreSQL, evitando transportar as imagens também entre banco e função. A autenticação continua consultando permissões e estado atual da conta.
- Imagens são limitadas ao usuário/mercado autenticado, sem aceitar outro mercado por parâmetro. Cache privado, `Vary: Cookie`, ETag e versão derivada do conteúdo; nenhuma imagem ganha cache público.
- Consultas simultâneas de prontidão do banco compartilham a mesma execução por cliente na instância, mantendo os 60 segundos existentes.
- `Server-Timing` separa `schema`, `auth`, `catalog` quando aplicável, e `other`, além do total `handler`. Não inclui rede ou inicialização anterior à entrada do handler.

## Evidências

Recalculando apenas os formatos das respostas do HAR fornecido: sessão 57.404 → 1.148 bytes; configuração inicial 49.361 → 588 bytes de JSON sem compressão. Os arquivos de imagem são carregados separadamente e podem ser reutilizados pelo navegador; não foram eliminados. Nenhum conteúdo sensível do HAR foi incluído no repositório.

O caso de 761 produtos com limites 1200 e 2000 agora usa uma resposta dentro do cache válido. Não há promessa de redução específica da latência do backend: requer publicação e nova captura com os cabeçalhos de medição.

## Validação

- `npm test`, `npm run typecheck`, `npm run lint`.
- `npm run test:pdv-performance`: desktop e celular, configuração compartilhada, venda, estoque e recuperação de vendas minimizadas.
- `npm run test:account-media-browser`: imagens decodificadas, edição com imagem original, PDF com logo e registros preservados.
- `npm run test:account-media-sql`: PostgreSQL isolado via PGlite, login/sessão, versões, isolamento por mercado e preservação dos valores originais. Dependência opcional externa indicada por `PGLITE_MODULE`.
- Build e orçamento do JavaScript inicial.

Próxima medição no site publicado: comparar o mesmo percurso e observar principalmente `auth`, `catalog`, `other` e o tempo total de espera no navegador.
