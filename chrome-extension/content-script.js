const STYLE_ID = 'nexo-ext-style';
const PANEL_ID = 'nexo-ext-panel';
const ALLOWED_PATHS = [/^\/estoque(?:\/|$)/, /^\/produto(?:\/|$)/];
const STATE = {
  running: false,
  paused: false,
  stopRequested: false,
  progress: { current: 0, total: 0 },
  log: [],
  mode: 'current',
};

const SELECTORS = {
  productName: '#product-name, input[name="name"]',
  barcode: '#product-barcode, input[name="barcode"]',
  imageUrl: 'input[type="url"], input[name="image_url"], #image_url',
  saveButton: 'button[type="submit"]',
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
      width: 360px;
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
    #${PANEL_ID} .meta { font-size: 11px; color: #64736d; line-height: 1.35; }
    #${PANEL_ID} .log { max-height: 130px; overflow:auto; display:grid; gap: 6px; }
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
      <p>Busca a primeira imagem, preenche o campo e salva no produto atual.</p>
    </div>
    <div class="body">
      <div class="row"><span>Status</span><span id="nexo-ext-status" class="pill">Pronto</span></div>
      <div class="bar"><div id="nexo-ext-bar"></div></div>
      <div class="row"><span>Progresso</span><strong id="nexo-ext-progress">0 / 0</strong></div>
      <div class="actions">
        <button class="primary" id="nexo-ext-start">Executar</button>
        <button id="nexo-ext-pause">Pausar</button>
        <button id="nexo-ext-stop">Parar</button>
      </div>
      <div class="meta">Modo: produto atual. Se o formulário de edição estiver aberto, a extensão tenta salvar nele diretamente.</div>
      <div class="log" id="nexo-ext-log"></div>
    </div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('.close').addEventListener('click', () => panel.remove());
  panel.querySelector('#nexo-ext-start').addEventListener('click', () => startAutomation({ limit: 1, onlyActive: true, saveEmpty: false, mode: 'current' }));
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
  try {
    chrome.runtime.sendMessage({
      type: 'nexo:auto-state',
      status: STATE.running ? (STATE.paused ? 'Pausado' : 'Rodando') : 'Pronto',
      progress: STATE.progress,
      log: text,
    });
  } catch {
    // ignore transient extension context issues
  }
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

async function loadProducts({ onlyActive = true, limit = 1 } = {}) {
  const products = await apiRequest('/products/catalog?limit=3000');
  const filtered = products.filter(product => (!onlyActive || product.status === 'ativo') && !String(product.image_url || '').trim());
  return filtered.slice(0, Math.max(1, Number(limit) || 1));
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

function findVisibleInput(selectorList) {
  for (const selector of selectorList) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function setInputValue(input, value) {
  if (!input) return false;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function getCurrentFormProduct() {
  const nameInput = findVisibleInput([SELECTORS.productName]);
  const barcodeInput = findVisibleInput([SELECTORS.barcode]);
  const imageInput = findVisibleInput([SELECTORS.imageUrl]);
  if (!nameInput && !barcodeInput && !imageInput) return null;
  return {
    name: nameInput?.value?.trim() || '',
    barcode: barcodeInput?.value?.trim() || '',
    imageUrl: imageInput?.value?.trim() || '',
    inputs: { nameInput, barcodeInput, imageInput },
  };
}

function clickSaveButton() {
  const buttons = [...document.querySelectorAll('button')];
  const saveButton = buttons.find(button => /salvar|criar/i.test((button.textContent || '').trim()) && !button.disabled);
  if (!saveButton) return false;
  saveButton.click();
  return true;
}

async function processCurrentProduct(options) {
  const current = getCurrentFormProduct();
  if (!current) throw new Error('Abra a tela de edição do produto antes de executar a automação.');
  if (current.imageUrl) {
    pushLog('O produto atual já tem imagem.');
    return;
  }

  const label = current.name || current.barcode || 'Produto sem nome';
  pushLog(`Buscando imagem para ${label}...`);

  const image = await searchFirstImage({ name: current.name, barcode: current.barcode });
  if (!image?.url) {
    pushLog(`Nenhuma imagem encontrada para ${label}.`);
    if (!options.saveEmpty) return;
  } else if (!isImageUrl(image.url)) {
    throw new Error('A primeira imagem encontrada não retornou uma URL válida.');
  } else {
    const imageInput = current.inputs.imageInput;
    const changed = imageInput ? setInputValue(imageInput, image.url) : false;
    if (!changed) throw new Error('Não encontrei o campo de URL da imagem nesta tela.');
    pushLog(`Imagem preenchida para ${label}.`);
  }

  await sleep(200);
  if (!clickSaveButton()) {
    pushLog('Não encontrei o botão salvar automaticamente. Confirme e salve manualmente.');
    return;
  }
  pushLog(`Salvando ${label}...`);
  await sleep(500);
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
    if ((options.mode || 'current') === 'current') {
      STATE.progress.total = 1;
      updatePanel();
      await processCurrentProduct(options);
      STATE.progress.current = 1;
      updatePanel();
      pushLog('Automação do produto atual finalizada.');
      return;
    }

    const queue = await loadProducts(options);
    STATE.progress.total = queue.length;
    updatePanel();
    pushLog(`Encontrados ${STATE.progress.total} produto(s) sem imagem.`);

    for (const [index, product] of queue.entries()) {
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
          await apiRequest(`/entities/Product/${product.id}`, {
            method: 'PATCH',
            body: { image_url: image.url },
          });
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
