const DEFAULT_STATE = {
  running: false,
  status: 'Pronto',
  progress: { current: 0, total: 0 },
  logs: [],
  stopRequested: false,
  debug: [],
  lastRun: null,
};

const state = { ...DEFAULT_STATE };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function persistState() {
  chrome.storage.local.set({
    nexo_auto_state: {
      status: state.status,
      progress: state.progress,
      logs: state.logs,
      debug: state.debug,
      lastRun: state.lastRun,
      running: state.running,
      stopRequested: state.stopRequested,
    },
  }).catch(() => {});
}

function broadcast() {
  persistState();
  chrome.runtime.sendMessage({
    type: 'nexo:auto-state',
    status: state.status,
    progress: state.progress,
    log: state.logs[0] || '',
    debug: state.debug,
    lastRun: state.lastRun,
  }).catch(() => {});
}

function pushLog(text) {
  state.logs = [text, ...state.logs].slice(0, 20);
  console.log('[NexoExt]', text);
  broadcast();
}

function pushDebug(entry) {
  state.debug = [{ at: new Date().toISOString(), ...entry }, ...state.debug].slice(0, 50);
  console.log('[NexoExt][debug]', entry);
  broadcast();
}

function isImageUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

function extractImageUrlFromHref(href = '') {
  try {
    const url = new URL(href, 'https://www.google.com');
    const direct = String(url.searchParams.get('imgurl') || url.searchParams.get('img_url') || url.searchParams.get('mediaurl') || '').trim();
    return isImageUrl(direct) ? direct : '';
  } catch {
    return '';
  }
}

function sanitizeQuery(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s\-().,]/gu, ' ')
    .trim()
    .slice(0, 180);
}

function standardizeProductName(name) {
  const raw = String(name || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const parts = raw.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  let product = parts.shift() || raw;
  let brand = '';
  let quantity = '';

  if (parts.length > 1) brand = parts.shift();
  if (parts.length) quantity = parts.shift();

  product = product.replace(/(\d+(?:[.,]\d+)?)\s*(litros?|lts?|l|mililitros?|ml|quilogramas?|quilos?|kgs?|kg|gramas?|grs?|g)\b/gi, (_, amount, unit) => `${String(amount).replace(',', '.')}${unit.toLowerCase().startsWith('l') ? 'L' : unit.toLowerCase().startsWith('g') ? 'g' : unit.toLowerCase()}`);
  product = product.replace(/\b(liquid|liquido)\b/gi, 'Líquido');
  product = product.replace(/\s+/g, ' ').trim();

  const out = [product.charAt(0).toLocaleUpperCase('pt-BR') + product.slice(1)];
  if (brand) out.push(brand.charAt(0).toLocaleUpperCase('pt-BR') + brand.slice(1));
  if (quantity) out.push(quantity.replace(/\s+/g, ''));
  return out.filter(Boolean).join(' - ');
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

function buildGoogleImagesUrl(queryText) {
  const baseQuery = sanitizeQuery(queryText || '');
  if (!baseQuery) return null;
  const query = sanitizeQuery(`${baseQuery} fundo branco`);
  const params = new URLSearchParams({
    q: query,
    tbm: 'isch',
    safe: 'active',
    hl: 'pt-BR',
  });
  return `https://www.google.com/search?${params.toString()}`;
}

async function createHiddenTab(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  return tab;
}

function waitForTabComplete(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tempo limite ao carregar o Google Imagens.'));
    }, timeoutMs);

    const listener = (id, info) => {
      if (id !== tabId || info.status !== 'complete') return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function extractImageFromGoogleTab(tabId) {
  const collect = async () => {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
      const anchors = [...document.querySelectorAll('a[href]')];
      const images = [...document.querySelectorAll('img')];
      const candidates = [];

      for (const anchor of anchors) {
        const img = anchor.querySelector('img');
        if (!img) continue;
        const src = img.currentSrc || img.src || img.dataset?.src || img.dataset?.iurl || '';
        const href = anchor.href || '';
        const text = (anchor.textContent || '').trim();
        if (!src && !href) continue;
        if (/\/ogw\//i.test(src) || /s32-c-mo/i.test(src)) continue;
        const direct = extractImageUrlFromHref(href) || img.dataset?.iurl || img.dataset?.src || '';
        candidates.push({
          href,
          src,
          direct,
          text,
          width: Number(img.naturalWidth || img.width || 0),
          height: Number(img.naturalHeight || img.height || 0),
          score: Number(Boolean(direct)) + Number(/imgres/i.test(href)) + Number(/encrypted-tbn\d*\.gstatic\.com|googleusercontent\.com\/(?:tbn|gstatic|lh\d+)/i.test(src)),
        });
      }

      if (!candidates.length) {
        for (const img of images) {
          const src = img.currentSrc || img.src || img.dataset?.src || img.dataset?.iurl || '';
          if (!src) continue;
          if (/\/ogw\//i.test(src) || /s32-c-mo/i.test(src)) continue;
          if (!/^https?:\/\//i.test(src)) continue;
          candidates.push({
            href: '',
            src,
            direct: img.dataset?.iurl || img.dataset?.src || '',
            text: (img.alt || img.title || '').trim(),
            width: Number(img.naturalWidth || img.width || 0),
            height: Number(img.naturalHeight || img.height || 0),
            score: Number(Boolean(img.dataset?.iurl || img.dataset?.src)) + Number(/encrypted-tbn\d*\.gstatic\.com|googleusercontent\.com\/(?:tbn|gstatic|lh\d+)/i.test(src)),
          });
        }
      }

      candidates.sort((first, second) => second.score - first.score);
      return candidates.slice(0, 20).map(candidate => ({
        url: String(candidate.direct || candidate.src || '').trim(),
        href: String(candidate.href || ''),
        text: String(candidate.text || ''),
        width: Number(candidate.width || 0),
        height: Number(candidate.height || 0),
      }));
      },
    });
    return Array.isArray(result) ? result.filter(item => item?.url) : [];
  };

  const allCandidates = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const candidates = await collect();
    for (const candidate of candidates) {
      if (allCandidates.some(existing => existing.url === candidate.url && existing.href === candidate.href)) continue;
      allCandidates.push(candidate);
    }
    // eslint-disable-next-line no-await-in-loop
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.scrollBy({ top: Math.round(window.innerHeight * 0.9), behavior: 'instant' }),
    }).catch(() => {});
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
  }

  return allCandidates;
}

function getGoogleCandidateScore(product, candidate) {
  const name = sanitizeQuery(product.name || '').toLowerCase();
  const barcode = sanitizeQuery(product.barcode || '').toLowerCase();
  const text = sanitizeQuery(`${candidate.text || ''} ${candidate.href || ''}`).toLowerCase();
  const url = String(candidate.url || '').toLowerCase();
  let score = 0;

  if (/\/ogw\//i.test(url) || /s32-c-mo/i.test(url)) return -1000;
  if (!isImageUrl(candidate.url)) return -1000;
  if (/^data:image\//i.test(candidate.url)) score -= 10;

  const matchesBarcode = barcode && text.includes(barcode);
  const matchesName = name && name.split(/\s+/).filter(Boolean).some(token => token.length >= 3 && text.includes(token));
  const titleHasName = name && text.includes(name);

  if (matchesBarcode) score += 8;
  if (titleHasName) score += 6;
  if (matchesName) score += 3;
  if (/imgres/i.test(candidate.href || '')) score += 2;
  if (/googleusercontent\.com|gstatic\.com/i.test(url)) score += 2;

  const width = Number(candidate.width || 0);
  const height = Number(candidate.height || 0);
  if (width > 0 && height > 0) {
    const ratio = width / height;
    const closeness = 1 - Math.min(1, Math.abs(Math.log(ratio))); // 1 perto de quadrado, 0 longe
    score += closeness * 5;
    if (ratio >= 0.8 && ratio <= 1.25) score += 3;
    if (width >= 120 && height >= 120) score += 1;
  }

  if (width < 80 || height < 80) score -= 3;
  if (/logo|ícone|icon|avatar|perfil|user|usuario|perfil/i.test(text)) score -= 8;
  if (/papel higiênico|papel higienico/i.test(text) && /leite|líquido|liquido|ibituruna/i.test(name)) score -= 12;
  if (/leite|ibituruna/i.test(name) && /papel|higiênico|higienico/i.test(text)) score -= 12;
  if (/caninha|duro/i.test(name) && /papel|higiênico|higienico/i.test(text)) score -= 12;

  return score;
}

async function searchFirstImage(product) {
  const barcode = sanitizeQuery(product.barcode || '');
  const name = sanitizeQuery(product.name || '');
  if (!barcode && !name) return null;

  const debugBase = { productId: product.id, productName: name || barcode, barcode };

  const tries = [
    barcode ? { query: barcode, name } : null,
    name ? { query: name, name } : null,
  ].filter(Boolean);

  for (const attempt of tries) {
    try {
      const result = await apiRequest(`/products/image-search?query=${encodeURIComponent(attempt.query)}&name=${encodeURIComponent(attempt.name || '')}&page=1`);
      const results = Array.isArray(result?.results) ? result.results : [];
      const best = results[0] || null;
      pushDebug({
        ...debugBase,
        source: 'api/products/image-search',
        query: attempt.query,
        resultCount: results.length,
        selected: best ? {
          url: best.url || '',
          source: best.source || '',
          title: best.title || '',
          provider: best.provider || '',
        } : null,
      });
      if (best?.url && isImageUrl(best.url)) return { ...best, debugSource: 'api/products/image-search' };
    } catch (error) {
      pushLog(`Busca oficial falhou para ${attempt.query}: ${error.message || 'erro desconhecido'}`);
      pushDebug({ ...debugBase, source: 'api/products/image-search', query: attempt.query, error: error.message || 'erro desconhecido' });
    }
  }

  const fallbackQuery = name || barcode;
  const url = buildGoogleImagesUrl(fallbackQuery);
  if (!url) return null;

  pushDebug({ ...debugBase, source: 'google-images-tab', googleUrl: url, fallbackQuery });
  const tab = await createHiddenTab(url);
  try {
    await waitForTabComplete(tab.id);
    await sleep(1000);
    const candidates = await extractImageFromGoogleTab(tab.id);
    const image = candidates
      .map(candidate => ({ ...candidate, score: getGoogleCandidateScore(product, candidate) }))
      .sort((first, second) => second.score - first.score)[0] || null;
    pushDebug({
      ...debugBase,
      source: 'google-images-tab',
      resultCount: candidates.length,
      candidates: candidates.slice(0, 5).map(candidate => ({
        url: candidate.url || '',
        href: candidate.href || '',
        text: candidate.text || '',
        width: candidate.width || 0,
        height: candidate.height || 0,
        score: getGoogleCandidateScore(product, candidate),
      })),
      selected: image ? {
        url: image.url || '',
        href: image.href || '',
        text: image.text || '',
        width: image.width || 0,
        height: image.height || 0,
        score: getGoogleCandidateScore(product, image),
      } : null,
    });
    if (image?.url && isImageUrl(image.url)) return { ...image, debugSource: 'google-images-tab' };
    return null;
  } finally {
    if (tab?.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

async function verifySavedImage(productId, expectedUrl) {
  try {
    const saved = await apiRequest(`/entities/Product/${productId}`);
    const actualUrl = String(saved?.image_url || saved?.data?.image_url || '').trim();
    return actualUrl === String(expectedUrl || '').trim();
  } catch {
    return false;
  }
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
        const standardized = standardizeProductName(product.name);
        if (standardized && standardized !== product.name) {
          pushDebug({ productId: product.id, productName: product.name, standardized });
          await apiRequest(`/entities/Product/${product.id}`, {
            method: 'PATCH',
            body: { name: standardized },
          });
          product.name = standardized;
          pushLog(`Nome padronizado: ${standardized}`);
        }
        const image = await searchFirstImage(product);
        if (!image?.url) {
          pushLog(`Sem imagem encontrada para ${label}.`);
          state.progress.current = index + 1;
          broadcast();
          // eslint-disable-next-line no-continue
          continue;
        }
        if (!isImageUrl(image.url)) {
          pushLog(`URL inválida para ${label}.`);
          state.progress.current = index + 1;
          broadcast();
          // eslint-disable-next-line no-continue
          continue;
        }
        pushDebug({
          productId: product.id,
          productName: label,
          chosenUrl: image.url,
          chosenSource: image.debugSource || image.provider || image.source || '',
          title: image.title || '',
        });
        await apiRequest(`/entities/Product/${product.id}`, {
          method: 'PATCH',
          body: { image_url: image.url },
        });
        const confirmed = await verifySavedImage(product.id, image.url);
        state.lastRun = {
          productId: product.id,
          productName: label,
          imageUrl: image.url,
          imageSource: image.debugSource || image.provider || image.source || '',
          confirmed,
        };
        if (confirmed) pushLog(`Salvo: ${label}`);
        else pushLog(`A API respondeu OK, mas a imagem não ficou gravada em ${label}.`);
      } catch (error) {
        pushLog(`Erro em ${label}: ${error.message || 'falha inesperada'}`);
        state.lastRun = {
          productId: product.id,
          productName: label,
          error: error.message || 'falha inesperada',
        };
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
    sendResponse({ ok: true, state: { status: state.status, progress: state.progress, logs: state.logs, debug: state.debug, lastRun: state.lastRun } });
    return true;
  }
  return false;
});

chrome.storage.local.get('nexo_auto_state').then(result => {
  const saved = result?.nexo_auto_state;
  if (!saved || typeof saved !== 'object') return;
  state.status = saved.status || state.status;
  state.progress = saved.progress || state.progress;
  state.logs = Array.isArray(saved.logs) ? saved.logs : state.logs;
  state.debug = Array.isArray(saved.debug) ? saved.debug : state.debug;
  state.lastRun = saved.lastRun || state.lastRun;
  state.running = Boolean(saved.running);
  state.stopRequested = Boolean(saved.stopRequested);
  broadcast();
}).catch(() => {});
