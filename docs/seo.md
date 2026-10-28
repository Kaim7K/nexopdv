# SEO da landing

URL oficial: `https://nexopdvnovo.vercel.app/`.

- `public/sitemap.xml` é estático e inclui apenas `/`. Não passa pela API ou pelo banco.
- `public/robots.txt` permite a landing, restringe login, API e módulos internos e referencia o sitemap oficial.
- `npm run build` executa o Vite e depois a renderização estática isolada de `Landing`, com os mesmos textos, JSX e CSS do navegador. Não importa `App`, autenticação ou módulos privados. Apenas variáveis públicas `VITE_*` já utilizadas pela landing participam desse processo.
- `dist/index.html` contém o conteúdo público, canonical, Open Graph, imagens com URL absoluta e JSON-LD (Organization, SoftwareApplication e FAQPage). Os títulos e descrições existentes foram preservados. O React continua usando sua montagem original no navegador.
- `dist/app.html` mantém o root vazio, sem canonical ou JSON-LD público, e recebe `noindex`. A Vercel envia `/` para a landing e as demais rotas da SPA para esse shell. O preview local reproduz essa separação. Nenhuma página privada é pré-renderizada.
- Os cabeçalhos `X-Robots-Tag` cobrem login, módulos internos, administração, API e o shell, incluindo subrotas. Robots e noindex não substituem autorização; os controles existentes não foram alterados.

## Validação

Execute `npm run build`, `npm test`, `npm run typecheck`, `npm run lint` e `npm run test:seo` (ou os equivalentes com pnpm). O teste de SEO exige o Chromium do Playwright e valida o build via HTTP e navegador, com e sem JavaScript. Simula apenas a resposta 401 da API para verificar redirecionamentos privados, sem credenciais nem dados reais. Capturas ficam em `artifacts/`.

Não execute apenas `vite build` para publicar: ele não inclui a etapa de pré-renderização. O comando de build já configurado na Vercel continua executando sua preparação preexistente de banco e agora chama o build completo. A preparação do banco não faz parte da validação local de SEO e não foi executada nesta alteração.

Após publicar, confira `/sitemap.xml` (200 e Content-Type XML), `/robots.txt`, o código-fonte de `/` e `X-Robots-Tag` de `/login`, `/financeiro`, `/caixas` e `/admin/mercados`. O teste local não executa a infraestrutura de roteamento/cabeçalhos da Vercel, embora verifique sua configuração. A indexação efetiva depende do Google; o sitemap pode ser enviado no Search Console após a publicação.

Se o domínio oficial mudar, atualize `src/config/seo.js`, `public/sitemap.xml` e `public/robots.txt` e gere um novo build.
