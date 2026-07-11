# Correção do login — Nexo PDV

## O que foi corrigido

- A inicialização do banco deixou de ser repetida em cada operação da mesma função.
- O sistema agora adiciona colunas ausentes de versões anteriores.
- A criação inicial não depende de chaves estrangeiras que podem conflitar com um banco antigo.
- A rota `/api/health` verifica conexão, estrutura do banco e criação do superadministrador.
- Os erros agora mostram um código e a etapa em que ocorreram.
- O frontend diferencia falha de rede, credenciais inválidas e falha no banco.

## Publicação na Vercel

1. Publique este projeto novamente.
2. Em **Settings > Environment Variables**, configure para Production:
   - `DATABASE_URL`
   - `JWT_SECRET` com no mínimo 32 caracteres
   - `SUPER_ADMIN_EMAIL`
   - `SUPER_ADMIN_PASSWORD`
   - `VITE_WHATSAPP_NUMBER`
3. Faça um novo deploy sem reutilizar o build anterior.
4. Abra `/api/health` no domínio publicado.

Resposta esperada:

```json
{
  "ok": true,
  "database": "connected",
  "schema": "ready",
  "jwt": "configured",
  "superAdmin": true
}
```

Depois, entre usando `SUPER_ADMIN_EMAIL` e `SUPER_ADMIN_PASSWORD`.

## Diagnóstico

Caso ainda ocorra erro, a tela mostrará algo semelhante a:

```text
[DATABASE_SCHEMA_TYPE: migrate_users]
```

Esse código identifica a origem do problema. Os detalhes completos também aparecem nos logs da função `api/index` na Vercel.

A variável `API_DEBUG=true` pode ser usada temporariamente para incluir mais detalhes técnicos na resposta. Volte para `false` depois do diagnóstico.
