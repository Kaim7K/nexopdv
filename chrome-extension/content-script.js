const STYLE_ID = 'nexo-ext-style';
const PANEL_ID = 'nexo-ext-panel';
const ALLOWED_PATHS = [/^\/estoque(?:\/|$)/, /^\/produto(?:\/|$)/];
const STATE = {
  running: false,
  paused: false,
  stopRequested: false,
  progress: { current: 0, total: 0 },
  log: [],
};

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 999999;
      width: 340px;
      border: 1px solid rgba(219, 228, 220, 0.95);
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,247,243,0.98));
      box-shadow: 0 22px 60px rgba(15, 27, 23, 0.18);
      color: #13211c;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      overflow: hidden;
    }
    #${PANEL_ID} .hdr { padding: 14px 14px 10px; background: linear-gradient(135deg, #0f6b4a, #16a06a); color: #fff; }
    #${PANEL_ID} .hdr h2 { margin: 0; font-size: 15px; }
    #${PANEL_ID} .hdr p { margin: 4px 0 0; font-size: 12px; opacity: .9; }
    #${PANEL_ID} .body { padding: 12px 14px 14px; display: grid; gap: 10px; }
    #${PANEL_ID} .row { display:flex; justify-content:space-between; align-items:center; gap: 10px; font-size: 12px; }
    #${PANEL_ID} .pill { padding: 5px 9px; border-radius: 999px; background: rgba(22,160,106,.12); color:#0f6b4a; font-weight:700; }
    #${PANEL_ID} .bar { height: 10px; border-radius: 999px; background: #e5ede8; overflow: hidden; }
    #${PANEL_ID} .bar > div { height: 100%; width: 0%; background: linear-gradient(90deg, #16a06a, #20b57a); transition: width .2s ease; }
    #${PANEL_ID} .actions { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    #${PANEL_ID} button { border:1px solid #dbe4dc; background:#fff; color:#13211c; border-radius: 14px; padding: 10px 12px; font-weight:700; cursor:pointer; }
    #${PANEL_ID} button.primary { background: linear-gradient(180deg, #20b57a, #16a06a); color:#fff; border-color:transparent; }
    #${PANEL_ID} .log { max-height: 125px; overflow:auto; display:grid; gap: 6px; }
    #${PANEL_ID} .log div { font-size: 12px; line-height: 1.35; border:1px solid #dbe4dc; background:#f8fbf8; border-radius: 12px; padding: 8px 10px; }
    #${PANEL_ID} .close { position:absolute; top: 10px; right: 10px; width: 30px; height: 30px; border:none; border-radius: 999px; background: rgba(255,255,255,.18); color:#fff; }
  `;
  document.head.appendChild(style);
}

function ensurePanel() {
  if (!ALLOWED_PATHS.some(pattern => pattern.test(location.pathname))) return null;
  injectStyles();
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="hdr">
      <button class="close" type="button" title="Fechar">×</button>
      <h2>Nexo PDV Automação</h2>
      <p>Busca a primeira imagem, salva e segue em lote.</p>
    </div>
    <div class="body">
      <div class="row"><span>Status</span><span id="nexo-ext-status" class="pill">Pronto</span></div>
      <div class="bar"><div id="nexo-ext-bar"></div></div>
      <div class="row"><span>Progresso</span><strong id="nexo-ext-progress">0 / 0</strong></div>
      <div class="actions">
        <button class="primary" id="nexo-ext-start">Iniciar</button>
        <button id="nexo-ext-pause">Pausar</button>
        <button id="nexo-ext-stop">Parar</button>
      </div>
      <div class="log" id="nexo-ext-log"></div>
    </div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('.close').addEventListener('click', () => panel.remove());
  panel.querySelector('#nexo-ext-start').addEventListener('click', () => startAutomation({ limit: 50, onlyActive: true, saveEmpty: false }));
  panel.querySelector('#nexo-ext-pause').addEventListener('click', togglePause);
  panel.querySelector('#nexo-ext-stop').addEventListener('click', stopAutomation);
  return panel;
}

function updatePanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  const progress = Math.max(0, STATE.progress.total ? (STATE.progress.current / STATE.progress.total) * 100 : 0);
  const status = panel.querySelector('#nexo-ext-status');
  const bar = panel.querySelector('#nexo-ext-bar');
  const progressLabel = panel.querySelector('#nexo-ext-progress');
  const log = panel.querySelector('#nexo-ext-log');
  if (status) status.textContent = STATE.running ? (STATE.paused ? 'Pausado' : 'Rodando') : 'Pronto';
  if (bar) bar.style.width = `${Math.min(100, progress)}%`;
  if (progressLabel) progressLabel.textContent = `${STATE.progress.current} / ${STATE.progress.total}`;
  if (log) log.innerHTML = STATE.log.slice(0, 8).map(item => `<div>${item}</div>`).join('');
}

function pushLog(text) {
  STATE.log = [text, ...STATE.log].slice(0, 20);
  updatePanel();
  chrome.runtime.sendMessage({ type: 'nexo:auto-state', status: STATE.running ? (STATE.paused ? 'Pausado' : 'Rodando') : 'Pronto', progress: STATE.progress, log: text }).catch(() => {});
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isImageUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

function getApiBase() {
  return `${location.origin}/api`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${getApiBase()}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Erro ao acessar a API.');
  return data;
}

async function loadProducts({ onlyActive = true }) {
  const products = await apiRequest('/products/catalog?limit=3000');
  return products.filter(product => (!onlyActive || product.status === 'ativo') && !String(product.image_url || '').trim());
}

async function searchFirstImage(product) {
  const params = new URLSearchParams({
    query: product.barcode || product.name || '',
    name: product.name || '',
    page: '1',
  });
  const result = await apiRequest(`/products/image-search?${params.toString()}`);
  return result?.results?.[0] || null;
}

async function saveProductImage(product, imageUrl) {
  await apiRequest(`/entities/Product/${product.id}`, {
    method: 'PATCH',
    body: { image_url: imageUrl },
  });
}

async function processQueue(options) {
  if (STATE.running) return;
  STATE.running = true;
  STATE.paused = false;
  STATE.stopRequested = false;
  STATE.progress = { current: 0, total: 0 };
  STATE.log = [];
  ensurePanel();
  updatePanel();

  try {
    const queue = await loadProducts(options);
    STATE.progress.total = Math.min(queue.length, Number(options.limit) || queue.length);
    updatePanel();
    pushLog(`Encontrados ${STATE.progress.total} produto(s) sem imagem.`);

    for (const [index, product] of queue.slice(0, STATE.progress.total).entries()) {
      if (STATE.stopRequested) break;
      while (STATE.paused && !STATE.stopRequested) await sleep(300);
      const label = product.name || product.barcode || 'Produto sem nome';
      pushLog(`Buscando imagem para ${label}...`);
      try {
        const image = await searchFirstImage(product);
        if (!image?.url) {
          pushLog(`Sem imagem encontrada para ${label}.`);
          if (!options.saveEmpty) {
            STATE.progress.current = index + 1;
            updatePanel();
            continue;
          }
        } else if (isImageUrl(image.url)) {
          await saveProductImage(product, image.url);
          pushLog(`Salvo: ${label}`);
        } else {
          pushLog(`URL inválida para ${label}.`);
        }
      } catch (error) {
        pushLog(`Erro em ${label}: ${error.message || 'falha inesperada'}`);
      }
      STATE.progress.current = index + 1;
      updatePanel();
      await sleep(350);
    }

    pushLog(STATE.stopRequested ? 'Automação interrompida.' : 'Automação finalizada.');
  } finally {
    STATE.running = false;
    STATE.paused = false;
    updatePanel();
  }
}

function startAutomation(options) {
  ensurePanel();
  processQueue(options).catch(error => pushLog(error.message || 'Falha na automação.'));
}

function togglePause() {
  if (!STATE.running) return;
  STATE.paused = !STATE.paused;
  pushLog(STATE.paused ? 'Pausado.' : 'Retomado.');
}

function stopAutomation() {
  STATE.stopRequested = true;
  STATE.paused = false;
  pushLog('Parando automação...');
}

ensurePanel();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'nexo:auto-start') {
    startAutomation(message.options || {});
    sendResponse?.({ ok: true });
    return true;
  }
  if (message?.type === 'nexo:auto-pause') {
    togglePause();
    sendResponse?.({ ok: true });
    return true;
  }
  if (message?.type === 'nexo:auto-stop') {
    stopAutomation();
    sendResponse?.({ ok: true });
    return true;
  }
  return false;
});
