# Correção do cabeçalho comprimido

O título e a descrição do Estoque podiam ficar com largura quase nula em telas de notebook: a barra de ações não quebrava linha em `xl`, seu contêiner não encolhia e o bloco de texto usava uma base flexível de zero. O texto herdava a quebra de palavras do corpo, resultando na descrição vertical mostrada no relato.

O `PageHeader` compartilhado agora permite quebra de linha, limita seus filhos à largura disponível e reserva uma base de 18 rem para a área de título no desktop. As ações do Estoque também podem ocupar mais de uma linha. O texto mantém espaço para leitura e os botões continuam disponíveis.

A revisão visual identificou ainda colunas estreitas na tabela do Estoque. O preço passou a ter 140 px, as ações 185 px e a largura mínima da tabela acompanha a soma das colunas, em 1140 px. A rolagem horizontal interna existente permanece; os botões não ultrapassam sua célula. Não houve alteração de formatação, valores, cálculos, permissões ou operações de estoque.

`npm run test:page-header` compila uma versão mock e testa os perfis Administrador, Gerente e Vendedor em 320, 390, 768, 1024, 1279, 1280, 1366, 1440 e 1920 px. Mede largura e altura da descrição, limites dos botões, espaço do campo de preço e contenção das ações nas células. Abre os formulários de produto e recuperação sem gravar dados. Também verifica os cabeçalhos de Vendas, Fiados, Relatórios, Usuários e Configurações em três larguras. O banco de demonstração é comparado integralmente antes e depois.

Os resultados ficam em `artifacts/refactor/page-header/measurements.json`, com capturas do perfil Gerente em 390, 1280 e 1366 px, inspecionadas visualmente. As alterações são locais; não houve publicação nem alteração de dados de produção.

A suíte existente, tipos, lint, build, verificação do bundle e teste de navegador passaram. O ambiente local permanece ativo com os três simuladores de cargo.
