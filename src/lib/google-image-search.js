const HOST_ID = 'nexo-google-image-search-host';
const GNAME = 'nexo-product-images';
const SCRIPT_ID = 'nexo-google-cse-script';

let engineId = '';
let readyPromise = null;
let activeRequest = null;

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (host) return host;
  host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(host);
  return host;
}

function mapResults(results = []) {
  const seen = new Set();
  return results.flatMap(result => {
    const url = String(result?.image?.url || '').trim();
    if (!/^https:\/\//i.test(url) || seen.has(url)) return [];
    seen.add(url);
    return [{
      url,
      thumbnailUrl: String(result?.thumbnailImage?.url || url),
      source: String(result?.visibleUrl || result?.contextUrl || 'Google Imagens'),
      contextUrl: String(result?.contextUrl || url),
      title: String(result?.titleNoFormatting || result?.title || 'Imagem do produto'),
      context: String(result?.contentNoFormatting || ''),
      width: Number(result?.image?.width || 0),
      height: Number(result?.image?.height || 0),
      provider: 'google-programmable-search',
    }];
  });
}

function configureCallbacks(resolve, reject) {
  window.__nexoGoogleImageSearchReady = () => {
    try {
      ensureHost();
      const existing = window.google?.search?.cse?.element?.getElement?.(GNAME);
      if (!existing) {
        window.google.search.cse.element.render({
          div: HOST_ID,
          tag: 'searchresults-only',
          gname: GNAME,
          attributes: {
            enableImageSearch: true,
            defaultToImageSearch: true,
            disableWebSearch: true,
            imageSearchLayout: 'classic',
            imageSearchResultSetSize: 'large',
            image_dominantcolor: 'white',
            image_gl: 'br',
            safeSearch: 'active',
            autoSearchOnLoad: false,
            enableHistory: false,
            mobileLayout: 'disabled',
          },
        });
      }
      const element = window.google.search.cse.element.getElement(GNAME);
      if (!element) throw new Error('O mecanismo do Google não foi inicializado.');
      resolve(element);
    } catch (error) {
      reject(error);
    }
  };

  window.__nexoGoogleImageResultsReady = (gname, query, _promos, results, div) => {
    if (div) div.replaceChildren();
    if (gname !== GNAME || !activeRequest) return true;
    const request = activeRequest;
    activeRequest = null;
    window.clearTimeout(request.timeoutId);
    request.resolve({ query, results: mapResults(results), hasMore: false });
    return true;
  };

  window.__gcse = {
    parsetags: 'explicit',
    initializationCallback: '__nexoGoogleImageSearchReady',
    searchCallbacks: { image: { ready: '__nexoGoogleImageResultsReady' } },
  };
}

async function fetchEngineId() {
  const response = await fetch('/api/product-images/config', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Não foi possível iniciar a busca do Google.');
  const id = String(data.engineId || '').trim();
  if (!id) throw new Error('A busca do Google ainda não foi configurada para este ambiente.');
  return id;
}

export async function ensureGoogleImageSearch() {
  ensureHost();
  const current = window.google?.search?.cse?.element?.getElement?.(GNAME);
  if (current) return current;
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    engineId = engineId || await fetchEngineId();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(initializationTimeout);
        callback(value);
      };
      const initializationTimeout = window.setTimeout(() => {
        finish(reject, new Error('O Google Imagens demorou para iniciar. Tente novamente.'));
      }, 15_000);

      configureCallbacks(value => finish(resolve, value), error => finish(reject, error));
      document.getElementById(SCRIPT_ID)?.remove();
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://cse.google.com/cse.js?cx=${encodeURIComponent(engineId)}`;
      script.onerror = () => finish(reject, new Error('O Google Imagens não pôde ser carregado. Verifique a conexão e tente novamente.'));
      document.head.appendChild(script);
    });
  })();

  try {
    return await readyPromise;
  } catch (error) {
    readyPromise = null;
    document.getElementById(SCRIPT_ID)?.remove();
    throw error;
  }
}

export async function searchGoogleProductImages(query, { timeout = 15_000 } = {}) {
  const cleanQuery = String(query || '').trim().slice(0, 180);
  if (!cleanQuery) throw new Error('Digite o nome ou o código de barras do produto.');
  const element = await ensureGoogleImageSearch();
  if (!element?.execute) throw new Error('A busca do Google não ficou pronta. Tente novamente.');

  if (activeRequest) {
    window.clearTimeout(activeRequest.timeoutId);
    activeRequest.reject(Object.assign(new Error('Pesquisa substituída por uma nova consulta.'), { code: 'SEARCH_REPLACED' }));
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      if (activeRequest?.timeoutId === timeoutId) activeRequest = null;
      reject(new Error('A pesquisa demorou mais que o esperado. Tente novamente.'));
    }, timeout);
    activeRequest = { resolve, reject, timeoutId };
    try {
      element.execute(cleanQuery);
    } catch (error) {
      activeRequest = null;
      window.clearTimeout(timeoutId);
      reject(error);
    }
  });
}
