# Nexo PDV

Sistema de ponto de venda multiempresa preparado para Vercel. Cada mercado possui dados, funcionários, identidade visual e módulos isolados no PostgreSQL.

## Configuração

1. Crie um PostgreSQL (Neon, Vercel Postgres ou equivalente).
2. Copie `.env.example` para `.env.local` e preencha as variáveis.
3. Execute `npm install` e `npm run dev`.
4. Publique na Vercel e cadastre as mesmas variáveis no projeto.

As tabelas e o primeiro superadministrador são criados automaticamente no primeiro acesso à API. Depois disso, use **Mercados** para criar cada cliente e sua conta administrativa. Troque a senha inicial por uma senha forte.

## Variáveis

- `DATABASE_URL`: conexão PostgreSQL com SSL.
- `JWT_SECRET`: segredo longo e aleatório usado nas sessões.
- `SUPER_ADMIN_EMAIL` e `SUPER_ADMIN_PASSWORD`: credenciais iniciais do painel geral.
- `VITE_WHATSAPP_NUMBER`: WhatsApp da landing page, somente números com DDI e DDD.

Os tokens ficam em cookies HTTP-only. Nenhum dado de negócio ou sessão é armazenado em `localStorage`.
