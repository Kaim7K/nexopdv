# Nexo PDV

Sistema PDV multiempresa preparado para Vercel e PostgreSQL. Cada mercado mantém produtos, vendas, funcionários, identidade visual e módulos isolados.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local`.
2. Preencha as variáveis obrigatórias.
3. Execute `npm install`.
4. Execute `npm run db:setup` para preparar o banco.
5. Execute `npm run dev`.

## Publicação na Vercel

O comando `npm run vercel-build` aplica as migrações, sincroniza o superadministrador e gera o frontend. O login não executa migrações em tempo real.

Variáveis obrigatórias:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED` (recomendada para migrações)
- `JWT_SECRET`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

Imagens de produtos:

- Conecte um Vercel Blob ao projeto. A integração cria `BLOB_READ_WRITE_TOKEN`.
- `GOOGLE_CSE_API_KEY` e `GOOGLE_CSE_ID` são opcionais e ampliam a busca automática.
- Sem Google CSE, a busca por código de barras e catálogo continua funcionando pelo Open Food Facts.

Depois de alterar variáveis, faça um novo deploy sem reutilizar o cache antigo.

## Validação

```bash
npm run check
```

Esse comando executa testes arquiteturais, testes de autenticação, TypeScript, ESLint e build de produção.
