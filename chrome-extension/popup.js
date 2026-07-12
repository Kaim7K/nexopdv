const state = {
  status: 'Pronto',
  progress: { current: 0, total: 0 },
  logs: [],
};

const $ = id => document.getElementById(id);

function render() {
  $('status').textContent = state.status;
  $('progress').textContent = `${state.progress.current} / ${state.progress.total}`;
  $('log').innerHTML = state.logs.slice(0, 6).map(entry => `<div class="log-item">${entry}</div>`).join('');
}

function readOptions() {
  return {
    limit: Number($('limit').value || 50),
    onlyActive: $('only-active').checked,
    saveEmpty: $('save-empty').checked,
  };
}

async function sendMessage(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) throw new Error('Abra o site do Nexo PDV para usar a automação.');
  return chrome.tabs.sendMessage(tab.id, message);
}

function pushLog(text) {
  state.logs = [text, ...state.logs].slice(0, 12);
  render();
}

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'nexo:auto-state') {
    state.status = message.status || state.status;
    state.progress = message.progress || state.progress;
    if (message.log) pushLog(message.log);
    else render();
  }
});

$('start').addEventListener('click', async () => {
  try {
    const options = readOptions();
    state.status = 'Iniciando...';
    render();
    await sendMessage({ type: 'nexo:auto-start', options });
  } catch (error) {
    state.status = 'Erro';
    pushLog(error.message || 'Falha ao iniciar automação.');
  }
});

$('pause').addEventListener('click', async () => {
  try {
    await sendMessage({ type: 'nexo:auto-pause' });
  } catch (error) {
    pushLog(error.message || 'Falha ao pausar.');
  }
});

$('stop').addEventListener('click', async () => {
  try {
    await sendMessage({ type: 'nexo:auto-stop' });
    state.status = 'Parado';
    render();
  } catch (error) {
    pushLog(error.message || 'Falha ao parar.');
  }
});

render();
