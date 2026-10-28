import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

// Reuse Vite's JSX, aliases and production-mode public configuration.
// No browser, user session or database is involved in rendering this component.
process.env.NODE_ENV = 'production';
const server = await createServer({
  mode: 'production',
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
});
try {
  const { renderLanding } = await server.ssrLoadModule('/scripts/landing-render.jsx');
  const { html, structuredData } = renderLanding();
  const template = await readFile('dist/index.html', 'utf8');
  if (!template.includes('<div id="root"></div>')) throw new Error('Run the full build before pre-rendering; expected a fresh Vite HTML template.');
  const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
  const css = manifest['src/pages/Landing.jsx']?.css;
  if (!html.includes('<h1') || !css?.length) throw new Error('Landing HTML or styles missing; refusing incomplete SEO build.');

  // Private routes get the original empty React root and no landing SEO metadata.
  const privateShell = template
    .replace(/<title>[\s\S]*?<\/title>/, '<title>Nexo PDV</title>')
    .replace(/<meta\s+(?:name="(?:description|keywords|twitter:[^"]+)"|property="og:[^"]+")[\s\S]*?\/>/g, '')
    .replace('</head>', '<meta name="robots" content="noindex, nofollow, noarchive" />\n  </head>');
  await writeFile('dist/app.html', privateShell);

  const origin = structuredData[0].url;
  const head = [
    `<link rel="canonical" href="${origin}" />`,
    `<meta property="og:url" content="${origin}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    ...css.map((file) => `<link rel="stylesheet" href="/${file}" />`),
    `<script id="nexo-structured-data" type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>`,
    '<noscript><style>[data-landing-reveal]{opacity:1;transform:none}</style></noscript>',
  ].join('\n    ');
  const landing = template
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`)
    .replaceAll('content="/nexo-pdv-og.png"', `content="${origin}nexo-pdv-og.png"`)
    .replace('</head>', `${head}\n  </head>`);
  await writeFile('dist/index.html', landing);
  console.log('Pre-rendered public landing only; private SPA shell: dist/app.html');
} finally {
  await server.close();
}
