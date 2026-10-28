# Recuperação de produtos e contenção da limpeza antiga

## Incidente e bloqueio

A antiga ação `POST /api/products/delete-inactive` executava exclusão física usando `last_sale_at` ou `created_date` anteriores a dois meses. Não exigia `status = inativo`, estoque zerado ou revisão dos IDs. A confirmação mostrava uma lista calculada no navegador, mas a API recalculava todo o mercado. A auditoria gravava somente a quantidade removida, sem IDs nem cópias dos produtos. O mock tinha um critério diferente do servidor.

A operação antiga retorna **410 UNSAFE_PRODUCT_CLEANUP_DISABLED**, inclusive para telas antigas ainda abertas. Seu botão foi removido. Não há substituição por outra exclusão automática baseada apenas em tempo sem venda.

## Exclusões futuras e lixeira

A exclusão individual passa a mover o registro para `entity = product_trash`, mantendo o UUID e uma cópia integral do produto, imagens, preços, custos, quantidades e datas. A mudança e a auditoria são atômicas; se a auditoria falhar, o produto permanece no estoque. Não há alteração de schema nem exclusão física nesse fluxo.

No Estoque, **Lixeira / recuperar produtos** lista as cópias disponíveis e permite restaurá-las. A restauração não sobrescreve um cadastro existente, verifica código/nome e limite de produtos e é idempotente. Ela exige administrador/gerente com módulo de estoque, restrito ao próprio mercado. Vendas e lançamentos financeiros não são revertidos.

Exclusões feitas pela função antiga **não aparecem magicamente na lixeira**: não há snapshot para desfazê-las no aplicativo. A interface mostra os incidentes antigos da auditoria e informa a necessidade de backup.

## Recuperação seletiva de exclusões antigas

É necessário acesso autorizado ao banco e à janela histórica/backup. Sem isso, o código não consegue reconstruir com segurança as quantidades, custos e cadastros apagados.

O procedimento recomendado é criar uma branch histórica imediatamente anterior ao incidente, sem apontar a aplicação para ela, e copiar somente os produtos faltantes do mercado afetado. **Não restaurar todo o banco de produção**, pois isso pode perder vendas e alterações posteriores. Referência: [recuperação seletiva documentada pelo Neon](https://neon.com/blog/recover-production-database).

Foi preparado `scripts/recover-products-from-backup.mjs`:

1. Configurar privadamente `RECOVERY_TARGET_DATABASE_URL`. Não versionar nem publicar credenciais.
2. `node scripts/recover-products-from-backup.mjs inspect --market "nome do mercado"` identifica um único mercado e lista IDs/horários dos incidentes, sem escrever no banco.
3. Criar e verificar a branch histórica no provedor; configurar sua conexão em `RECOVERY_SOURCE_DATABASE_URL`. Usar um ponto anterior de até 60 segundos do incidente. Confirmar que os produtos estão presentes nessa cópia.
4. `node scripts/recover-products-from-backup.mjs plan --market-id UUID --incident-id UUID --snapshot-at ISO` exige correspondência exata entre o total de candidatos no backup e a quantidade da auditoria antiga. Diferenças ou códigos recadastrados bloqueiam a recuperação automática. O manifesto completo fica somente em `artifacts/recovery/`, ignorado pelo Git. A etapa é somente leitura em produção.
5. Conferir o manifesto, o mercado, o horário de origem e a lista dos itens faltantes. Depois executar `node scripts/recover-products-from-backup.mjs apply --manifest artifacts/recovery/INCIDENTE.json --market-id UUID`.

O `apply` valida o incidente/mercado e a integridade do manifesto, bloqueia a linha do mercado e insere somente UUIDs ausentes. Nunca usa `UPDATE` em produtos atuais nem altera vendas, permissões ou assinaturas. Conflitos são ignorados sem sobrescrita e informados no resumo. A inserção e sua auditoria ficam na mesma transação. Reexecutar não duplica produtos. Se o backup não corresponder ao incidente, é necessária revisão específica, sem estimar quantidades.

**Preparar o utilitário ou publicar a lixeira não significa recuperar o incidente antigo.** Confirmar o total efetivamente restaurado no banco e na tela do mercado antes de declarar a recuperação concluída.

## Testes

- `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.
- `node tests/product-trash-browser.test.mjs`: servidor local mock isolado, confirmação de envio à lixeira e recuperação pela interface, conferindo o payload original.
- Para testar as consultas em PostgreSQL isolado, sem credenciais de produção: `npm install --prefix artifacts/recovery-sql --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.13`, seguido de `node tests/product-trash-sql.test.mjs`. Verifica snapshot integral, rollback por falha de auditoria, isolamento entre mercados, permissões, conflitos e repetição de restauração.

Nenhum desses testes acessa ou recupera o banco oficial. O utilitário de recuperação só deve ser aplicado à origem histórica e ao destino explicitamente verificados.
