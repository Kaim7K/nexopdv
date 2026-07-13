import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');

async function walk(directory) {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const file = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? walk(`${file}/`) : [file];
  }));
  return nested.flat();
}

const sourceFiles = (await walk('src/')).filter(file => /\.(jsx|js)$/.test(file));
const sources = await Promise.all(sourceFiles.map(async file => [file, await read(file)]));
const combined = sources.map(([, source]) => source).join('\n');
const [app, css, html, packageJson, modalBehavior] = await Promise.all([
  read('src/App.jsx'),
  read('src/index.css'),
  read('index.html'),
  read('package.json'),
  read('src/hooks/use-modal-behavior.js'),
]);

assert.doesNotMatch(combined, /window\.confirm\s*\(/, 'Confirmações nativas não devem voltar à interface.');
assert.doesNotMatch(app, /components\/ui\/toaster|QueryClientProvider/, 'O aplicativo deve manter apenas um sistema de feedback.');
assert.match(app, /ConfirmProvider/, 'Confirmações destrutivas devem usar o provedor acessível compartilhado.');
assert.match(app, /AppErrorBoundary/, 'Falhas inesperadas não devem deixar uma tela vazia.');
assert.match(modalBehavior, /event\.key !== 'Tab'/, 'Modais manuais devem conter o foco do teclado.');
assert.match(modalBehavior, /previousFocus.*focus/s, 'O foco deve retornar ao acionador ao fechar o modal.');
assert.match(css, /prefers-reduced-motion/, 'A interface deve respeitar preferência por movimento reduzido.');
assert.match(css, /:focus-visible/, 'A interface deve manter foco visível.');
assert.doesNotMatch(css, /@import\s+url\([^)]*fonts\.googleapis/, 'A fonte não deve bloquear o CSS por @import.');
assert.match(html, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com"/, 'A fonte remota deve usar conexão antecipada.');

for (const [file, source] of sources.filter(([file]) => file.endsWith('.jsx'))) {
  const buttonsWithoutType = source.match(/<button\b(?![^>]*\btype=)[^>]*>/gs) || [];
  assert.equal(buttonsWithoutType.length, 0, `${file} contém botão nativo sem type explícito.`);
  const imagesWithoutAlt = source.match(/<img\b(?![^>]*\balt=)[^>]*>/gs) || [];
  assert.equal(imagesWithoutAlt.length, 0, `${file} contém imagem sem texto alternativo explícito.`);
}

const removedDependencies = [
  '@tanstack/react-query',
  '@stripe/react-stripe-js',
  'framer-motion',
  'html2canvas',
  'lodash',
  'moment',
  'react-leaflet',
  'three',
];
for (const dependency of removedDependencies) {
  assert.doesNotMatch(packageJson, new RegExp(`"${dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `${dependency} não deve voltar sem uso real.`);
}

console.log('Teste de pré-lançamento de UI aprovado.');
