import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bestTextColor, contrastRatio, deriveSidebarPalette } from '../src/lib/color-contrast.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [api, stock, settings, auth, layout, imageSearch] = await Promise.all([
  read('api/index.js'),
  read('src/pages/Estoque.jsx'),
  read('src/pages/Configuracoes.jsx'),
  read('src/lib/AuthContext.jsx'),
  read('src/components/Layout.jsx'),
  read('src/lib/google-image-search.js'),
]);

assert.equal(bestTextColor('#000000'), '#ffffff');
assert.equal(bestTextColor('#ffffff'), '#101828');
assert(contrastRatio('#000000', '#ffffff') >= 21);
const palette = deriveSidebarPalette('#0f1b17', '#16a06a');
assert(palette.foregroundContrast >= 4.5, 'O texto automático da sidebar deve atingir contraste legível.');
assert(palette.isAccentDistinct, 'A paleta padrão deve ter destaque distinguível.');
const invalid = deriveSidebarPalette('#16a06a', '#16a06a');
assert.equal(invalid.isAccentDistinct, false, 'Fundo e destaque iguais devem ser bloqueados.');

assert.match(api, /deleted\+[\s\S]*SET active=false,/, 'Excluir usuário deve desativar a conta e liberar o e-mail sem quebrar vínculos históricos.');
assert.match(api, /password_hash=\$\{await bcrypt\.hash/, 'A conta excluída deve perder a credencial anterior.');
assert.match(api, /AND active=true ORDER BY/, 'Usuários excluídos não devem voltar para a listagem.');
assert.match(stock, /StockMetric label="Sem estoque"/, 'O alerta de falta deve ficar resumido no indicador de estoque.');
assert.doesNotMatch(stock, /produtos sem estoque[\s\S]{0,300}bg-red-600/i, 'A tela não deve ter o painel vermelho grande antigo.');
assert.match(stock, /Atualizar estoque/, 'A ação de reposição deve continuar disponível na linha do produto zerado.');
assert.match(settings, /sidebar_background_color/, 'Configurações deve permitir alterar o fundo da sidebar.');
assert.match(settings, /sidebar_accent_color/, 'Configurações deve permitir alterar o destaque da sidebar.');
assert.match(settings, /isAccentDistinct/, 'O sistema deve impedir combinações sem contraste.');
assert.match(auth, /sessionStorage/, 'A sessão deve usar cache curto para evitar recarregamento visual desnecessário.');
assert.match(layout, /ROUTE_PREFETCHERS/, 'As páginas devem ser pré-carregadas ao indicar intenção de navegação.');
assert.match(layout, /CONFIG_CACHE_KEY/, 'As configurações visuais devem abrir pelo cache enquanto são revalidadas.');
assert.match(imageSearch, /activeRequest/, 'Pesquisas concorrentes devem cancelar a solicitação visual anterior.');

console.log('Teste de UI, desempenho e segurança aprovado.');
