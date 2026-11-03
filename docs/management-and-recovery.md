# Painel de gestão e recuperação de acesso

## Comportamento

- Gerentes e administradores entram em `/inicio`; vendedores continuam em `/pdv` e superadministradores em `/admin/mercados`.
- O painel usa os módulos e o plano efetivamente habilitados. Contas a pagar e margens respeitam também as permissões financeiras individuais. O endpoint recusa vendedores e consultas sem mercado.
- O resumo diário considera o horário de `America/Bahia`. As consultas não limitam a contagem de vendas ou produtos aos primeiros registros de uma página. As listas de ações exibem até cinco registros e informam a contagem total.
- Reposição usa o limite configurado na loja. Produtos inativos, arquivados ou sem controle de estoque não entram na reposição. Produtos parados têm saldo positivo e nenhum registro de venda nos últimos 30 dias; sem histórico, considera-se a criação do cadastro.
- Margem atual abaixo de 10% considera preço e custo cadastrados, sem despesas/taxas. Queda de margem compara dois períodos consecutivos de 30 dias e sinaliza redução de pelo menos um ponto percentual. Usa custos registrados nas vendas e rateia descontos com a mesma função dos relatórios. Vendas legadas sem custo não recebem custos inventados.
- Fiados sem vencimento são apresentados como pendentes, sem classificá-los como atrasados. Contas a pagar incluem valores vencidos e vencimentos nos próximos sete dias.
- O roteiro inicial detecta configuração, produtos e vendas existentes. A conferência manual de preços fica em uma chave nova do navegador, separada por usuário e mercado. Nenhum cadastro é criado automaticamente pelo roteiro.

## Finalização de vendas

Antes do envio, o PDV salva uma cópia do pagamento e dos itens em `nexo:pdv:pending:<mercado>:<usuario>`. Essa chave é independente do rascunho comum e não expira por inatividade. Enquanto a resposta estiver incerta, a operação não pode ser editada e outra venda não é iniciada nessa tela.

Em falhas de conexão ou erros 5xx, o cliente consulta a operação no servidor. Se ela já foi registrada, abre o recibo. Se não puder confirmar, preserva a operação para conferência e nova tentativa com o mesmo identificador, inclusive após recarregar a página. A consulta é restrita ao mercado e ao vendedor. A conclusão devolve uma venda já existente antes de validar preços e caixa que possam ter mudado; a restrição única e a escrita atômica existentes continuam protegendo estoque, fiado e auditoria.

O navegador precisa permitir o armazenamento da operação. Se o armazenamento falhar antes do envio, a interface informa que a venda não foi enviada. Este recurso não oferece vendas offline nem protege contra limpeza manual dos dados do navegador.

## Migração e configuração

A migração `021_password_recovery.sql` adiciona uma coluna anulável aos usuários e duas tabelas próprias para tokens e limites de solicitação. Não apaga registros operacionais, não troca senhas e não altera planos ou contratos. Migrações anteriores permanecem intactas. A versão exigida passa a ser 21.

Antes de executar a aplicação atualizada contra um banco existente, aplicar as migrações com `npm run db:migrate`. O fluxo de deploy existente já executa migrações antes do build. A implementação não executou migrações contra produção.

Configurar no servidor:

- `PUBLIC_APP_URL`: origem HTTPS pública e confiável da aplicação, por exemplo `https://seu-dominio.com.br`.
- `BREVO_API_KEY` e `EMAIL_FROM`: configuração de envio já utilizada pelo projeto, com remetente verificado.

Sem configuração, o formulário orienta a procurar o administrador. No ambiente mock, nenhum e-mail é enviado. A entrega real pelo Brevo depende da configuração e não foi acionada nos testes.

Os links expiram em 30 minutos, usam 32 bytes aleatórios e são armazenados apenas como SHA-256. O segredo fica no fragmento da URL, fora das URLs das requisições HTTP. O consumo e a atualização da senha são atômicos, com comparação da senha anterior para impedir reutilização e concorrência. Trocar a senha invalida sessões anteriores e outros links emitidos para a senha antiga. Contas inexistentes e solicitações limitadas recebem a mesma resposta pública. Há limites persistentes por e-mail e IP, armazenados como hashes, por hora. Os registros de limite e tokens expirados podem ser removidos periodicamente das duas tabelas novas; a aplicação ignora tokens expirados.

## Validação

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run test:management`: testes das regras, recuperação de senha com envio simulado, isolamento de acesso e teste de navegador com perda da resposta após uma venda efetivamente registrada no mock. Confere que recarregar e tentar novamente não cria outra venda nem baixa o estoque duas vezes.
- `npm run test:launch`: vendas e recibos nos três planos, em desktop e celular; requer servidor mock em `127.0.0.1:5177`.
- `node tests/management-sql.test.mjs <caminho-absoluto-do-modulo-PGlite>`: validação opcional com PostgreSQL WASM instalado fora das dependências da aplicação. Recria um banco descartável, aplica o schema legado e a migração 21 duas vezes, confere preservação dos dados e executa o SQL real de venda, painel e recuperação. Exclui somente as extensões/índices de desempenho que não são necessários ao teste. Não usa `DATABASE_URL`.

As validações locais não substituem a conferência do ambiente de produção nem o teste de entrega de e-mail com o remetente configurado.
