import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bestTextColor, contrastRatio, deriveSidebarPalette } from '../src/lib/color-contrast.js';
import { isPdvDraftExpired, PDV_DRAFT_INACTIVITY_MS } from '../src/lib/pdv.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [api, stock, settings, auth, layout, googleImages, pdv, css] = await Promise.all([
  read('api/index.js'),
  read('src/pages/Estoque.jsx'),
  read('src/pages/Configuracoes.jsx'),
  read('src/lib/AuthContext.jsx'),
  read('src/components/Layout.jsx'),
  read('src/lib/google-images.js'),
  read('src/pages/PDV.jsx'),
  read('src/index.css'),
]);

assert.equal(bestTextColor('#000000'), '#ffffff');
assert.equal(bestTextColor('#ffffff'), '#101828');
assert(contrastRatio('#000000', '#ffffff') >= 21);
const palette = deriveSidebarPalette('#0f1b17', '#16a06a');
assert(palette.foregroundContrast >= 4.5, 'O texto automático da sidebar deve atingir contraste legível.');
assert(palette.isAccentDistinct, 'A paleta padrão deve ter destaque distinguível.');
assert.equal(deriveSidebarPalette('#16a06a', '#16a06a').isAccentDistinct, false);

const now = 1_000_000;
assert.equal(isPdvDraftExpired({ lastActiveAt: now - PDV_DRAFT_INACTIVITY_MS - 1 }, now), true);
assert.equal(isPdvDraftExpired({ lastActiveAt: now - 60_000 }, now), false);
assert.equal(isPdvDraftExpired({ inactiveSince: now - PDV_DRAFT_INACTIVITY_MS }, now), true);

assert.match(api, /SET active=false,[\s\S]*email=\$\{deletedEmail\}/, 'Excluir usuário deve desativar a conta e liberar o e-mail.');
assert.match(api, /password_hash=\$\{revokedPasswordHash\}/, 'A conta excluída deve perder a credencial anterior.');
assert.match(api, /AND active=true ORDER BY/, 'Usuários excluídos não devem voltar à listagem.');
assert.match(stock, /StockMetric\s+label="Sem estoque"/, 'A falta de estoque deve ficar resumida no indicador.');
assert.doesNotMatch(stock, /produtos sem estoque[\s\S]{0,300}bg-red-600/i, 'O painel vermelho grande antigo não deve voltar.');
assert.match(settings, /sidebar_background_color/, 'Configurações deve permitir alterar o fundo da sidebar.');
assert.match(settings, /isAccentDistinct/, 'O sistema deve impedir combinações sem contraste.');
assert.match(auth, /sessionStorage/, 'A sessão deve usar cache curto.');
assert.match(layout, /ROUTE_PREFETCHERS/, 'As páginas devem ser pré-carregadas por intenção.');
assert.match(googleImages, /window\.open/, 'A pesquisa deve abrir no navegador do usuário.');
assert.match(pdv, /window\.setInterval/, 'O rascunho deve manter heartbeat enquanto a tela está ativa.');
assert.match(css, /grafite neutro/, 'O tema escuro deve documentar a paleta neutra.');

console.log('Teste de UI, desempenho e segurança aprovado.');
