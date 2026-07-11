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

Imagens:

- Uploads de logo, perfil e produto são otimizados no navegador e salvos sem exigir Vercel Blob.
- Um Blob Store é opcional. Quando conectado, imagens escolhidas na busca externa podem ser copiadas para o armazenamento próprio.
- `GOOGLE_CSE_API_KEY` e `GOOGLE_CSE_ID` são opcionais e ampliam a busca automática.
- A busca tenta primeiro o código de barras e, quando não encontra resultado, usa o nome do produto sem filtro de adequação.


Administração:

- Administradores e gerentes podem excluir produtos pelo estoque.
- A exclusão de usuários respeita o perfil de acesso e protege a conta atual e o último administrador.
- Administradores podem zerar separadamente estoque, fiados, vendas ou auditoria em **Configurações**.
- O recibo em PDF inclui a logo configurada para o mercado.

Depois de alterar variáveis, faça um novo deploy sem reutilizar o cache antigo.

## Validação

```bash
npm run check
```

Esse comando executa testes arquiteturais, testes de autenticação, TypeScript, ESLint e build de produção.
