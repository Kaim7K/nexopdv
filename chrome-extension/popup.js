const state = {
  status: 'Pronto',
  progress: { current: 0, total: 0 },
  logs: [],
  debug: [],
  lastRun: null,
};

const $ = id => document.getElementById(id);

function render() {
  $('status-text').textContent = state.status;
  $('progress-bar').style.width = `${state.progress.total ? Math.min(100, (state.progress.current / state.progress.total) * 100) : 0}%`;
  $('last-action').textContent = state.logs[0] || 'Nenhuma';
  $('log').innerHTML = state.logs.slice(0, 6).map(entry => `<div class="log-item">${entry}</div>`).join('');

  const lastRun = state.lastRun || {};
  $('debug-source').textContent = lastRun.imageSource || lastRun.chosenSource || '-';
  $('debug-url').textContent = lastRun.imageUrl || lastRun.chosenUrl || '-';
  $('debug-confirmed').textContent = typeof lastRun.confirmed === 'boolean' ? (lastRun.confirmed ? 'Sim' : 'Não') : '-';
  $('debug-json').textContent = state.debug.length ? JSON.stringify(state.debug.slice(0, 8), null, 2) : 'Nenhum detalhe ainda.';
}

function readOptions() {
  return {
    onlyActive: $('only-active').checked,
    pauseAfter: Number($('pause-after').value || 350),
    limit: Number($('limit').value || 50),
  };
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function loadSavedState() {
  const result = await chrome.storage.local.get('nexo_auto_state');
  const saved = result?.nexo_auto_state;
  if (!saved || typeof saved !== 'object') return;
  state.status = saved.status || state.status;
  state.progress = saved.progress || state.progress;
  state.logs = Array.isArray(saved.logs) ? saved.logs : state.logs;
  state.debug = Array.isArray(saved.debug) ? saved.debug : state.debug;
  state.lastRun = saved.lastRun || state.lastRun;
}

function pushLog(text) {
  state.logs = [text, ...state.logs].slice(0, 12);
  render();
}

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'nexo:auto-state') {
    state.status = message.status || state.status;
    state.progress = message.progress || state.progress;
    state.debug = message.debug || state.debug;
    state.lastRun = message.lastRun || state.lastRun;
    if (message.log) pushLog(message.log);
    else render();
  }
});

$('start').addEventListener('click', async () => {
  try {
    const options = readOptions();
    state.status = 'Executando...';
    render();
    const response = await sendMessage({ type: 'nexo:start-batch', options });
    if (!response?.ok) throw new Error(response?.error || 'Falha ao iniciar automação.');
    state.status = 'Finalizado';
    render();
  } catch (error) {
    state.status = 'Erro';
    pushLog(error.message || 'Falha ao iniciar automação.');
    render();
  }
});

$('pause').addEventListener('click', async () => {
  pushLog('A automação em lote roda sem precisar da aba ativa.');
});

$('stop').addEventListener('click', async () => {
  try {
    await sendMessage({ type: 'nexo:stop-batch' });
    state.status = 'Parando';
    pushLog('Solicitação de parada enviada.');
    render();
  } catch (error) {
    pushLog(error.message || 'Falha ao parar.');
  }
});

loadSavedState()
  .then(() => sendMessage({ type: 'nexo:get-state' }))
  .then(response => {
    if (response?.ok && response.state) {
      state.status = response.state.status || state.status;
      state.progress = response.state.progress || state.progress;
      state.logs = response.state.logs || state.logs;
      state.debug = response.state.debug || state.debug;
      state.lastRun = response.state.lastRun || state.lastRun;
    }
    render();
  })
  .catch(() => render());

render();
