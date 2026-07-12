const DEFAULT_STATE = {
  running: false,
  status: 'Pronto',
  progress: { current: 0, total: 0 },
  logs: [],
  stopRequested: false,
};

const state = { ...DEFAULT_STATE };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function broadcast() {
  chrome.runtime.sendMessage({
    type: 'nexo:auto-state',
    status: state.status,
    progress: state.progress,
    log: state.logs[0] || '',
  }).catch(() => {});
}

function pushLog(text) {
  state.logs = [text, ...state.logs].slice(0, 20);
  broadcast();
}

function isImageUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`https://nexopdv-gold.vercel.app/api${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Erro ao acessar a API (${response.status}).`);
  return data;
}

async function loadProducts({ onlyActive = true, limit = 50 } = {}) {
  const products = await apiRequest('/products/catalog?limit=3000');
  const filtered = products.filter(product => (!onlyActive || product.status === 'ativo') && !String(product.image_url || '').trim());
  return filtered.slice(0, Math.max(1, Number(limit) || 50));
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

async function startBatch(options = {}) {
  if (state.running) return { ok: false, error: 'Uma automação já está em execução.' };

  state.running = true;
  state.stopRequested = false;
  state.status = 'Rodando';
  state.logs = [];
  state.progress = { current: 0, total: 0 };
  broadcast();

  try {
    const queue = await loadProducts(options);
    state.progress.total = queue.length;
    broadcast();
    pushLog(`Encontrados ${queue.length} produto(s) sem imagem.`);

    for (const [index, product] of queue.entries()) {
      if (state.stopRequested) break;
      const label = product.name || product.barcode || 'Produto sem nome';
      pushLog(`Buscando imagem para ${label}...`);

      try {
        const image = await searchFirstImage(product);
        if (!image?.url) {
          pushLog(`Sem imagem encontrada para ${label}.`);
        } else if (!isImageUrl(image.url)) {
          pushLog(`URL inválida para ${label}.`);
        } else {
          await apiRequest(`/entities/Product/${product.id}`, {
            method: 'PATCH',
            body: { image_url: image.url },
          });
          pushLog(`Salvo: ${label}`);
        }
      } catch (error) {
        pushLog(`Erro em ${label}: ${error.message || 'falha inesperada'}`);
      }

      state.progress.current = index + 1;
      broadcast();
      await sleep(Number(options.pauseAfter || 300));
    }

    state.status = state.stopRequested ? 'Interrompido' : 'Finalizado';
    pushLog(state.stopRequested ? 'Automação interrompida.' : 'Automação finalizada.');
    return { ok: true, progress: state.progress };
  } catch (error) {
    state.status = 'Erro';
    pushLog(error.message || 'Falha na automação.');
    return { ok: false, error: error.message || 'Falha na automação.' };
  } finally {
    state.running = false;
    state.stopRequested = false;
    broadcast();
  }
}

function stopBatch() {
  state.stopRequested = true;
  state.status = 'Parando';
  pushLog('Parando automação...');
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'nexo:start-batch') {
    startBatch(message.options || {}).then(result => sendResponse(result));
    return true;
  }
  if (message?.type === 'nexo:stop-batch') {
    sendResponse(stopBatch());
    return true;
  }
  if (message?.type === 'nexo:get-state') {
    sendResponse({ ok: true, state: { status: state.status, progress: state.progress, logs: state.logs } });
    return true;
  }
  return false;
});
