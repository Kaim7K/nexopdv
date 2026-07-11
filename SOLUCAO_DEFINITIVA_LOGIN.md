# Solução definitiva da autenticação do Nexo PDV

## O problema estrutural removido

A versão anterior executava `CREATE TABLE`, `ALTER TABLE` e a criação do superadministrador dentro da rota da API. Por isso, toda tentativa de login também tentava instalar ou alterar o banco. Qualquer diferença de esquema, permissão ou conexão transformava o login em erro 500.

Nesta versão, autenticação e instalação do banco são processos separados.

## Arquitetura implantada

- A API não cria nem altera tabelas.
- O banco utiliza o schema isolado `nexo`, evitando conflito com tabelas antigas em `public`.
- As migrações possuem versões registradas em `nexo.schema_migrations`.
- As migrações são aplicadas pelo build da Vercel antes da publicação.
- Se o banco ou as variáveis estiverem incorretos, o deploy falha e a versão defeituosa não é publicada.
- A conta `SUPER_ADMIN_EMAIL` é criada ou atualizada durante cada deploy.
- O login valida os dados, compara a senha, cria o cookie e devolve o usuário em uma única requisição.
- A API verifica a versão do banco sem executar DDL em produção.
- O schema antigo em `public` é importado automaticamente quando for compatível e o novo schema ainda estiver vazio.

## Variáveis obrigatórias na Vercel

Configure em **Settings > Environment Variables**:

```text
DATABASE_URL
JWT_SECRET
SUPER_ADMIN_EMAIL
SUPER_ADMIN_PASSWORD
VITE_WHATSAPP_NUMBER
```

Opcional e recomendado para migrações:

```text
DATABASE_URL_UNPOOLED
```

Requisitos:

- `JWT_SECRET`: no mínimo 32 caracteres.
- `SUPER_ADMIN_PASSWORD`: no mínimo 12 caracteres.
- As variáveis devem estar habilitadas no ambiente **Production**.
- `DATABASE_URL` deve apontar para um banco PostgreSQL existente e ativo.

## Publicação

1. Envie este projeto para a Vercel.
2. Configure todas as variáveis.
3. Faça um novo deploy de produção.
4. O comando `npm run vercel-build` executará as migrações e sincronizará o administrador antes de gerar o site.
5. Depois do deploy, acesse `/api/health`.

Resposta esperada:

```json
{
  "ok": true,
  "database": "connected",
  "schemaVersion": 3,
  "requiredSchemaVersion": 3,
  "superAdmin": true
}
```

## Credenciais

O login principal utiliza exatamente:

- E-mail definido em `SUPER_ADMIN_EMAIL`.
- Senha definida em `SUPER_ADMIN_PASSWORD`.

Ao alterar essas variáveis, faça um novo deploy. A conta principal será sincronizada com os novos valores.

## Comandos disponíveis

```bash
npm run db:migrate
npm run db:seed
npm run db:setup
npm run db:check
npm run test
npm run check
```

## Diagnóstico definitivo

O sistema não publica uma nova versão quando:

- o endereço do banco está inválido;
- o banco foi removido ou está inacessível;
- as credenciais do PostgreSQL estão erradas;
- faltam permissões para migração;
- alguma variável obrigatória está ausente;
- uma migração falha.

Isso elimina o cenário em que o site parece ter sido publicado normalmente, mas o usuário só descobre o problema ao tentar entrar.
