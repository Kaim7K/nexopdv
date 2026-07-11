import { AppError } from './errors.js';

const ALLOWED_REMOTE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function cleanResults(results, limit = 5) {
  const seen = new Set();
  return results
    .filter(result => {
      const url = String(result?.url || '').trim();
      const mime = String(result?.mime || '').toLowerCase();
      if (!url || seen.has(url) || !/^https:\/\//i.test(url)) return false;
      if (mime && !ALLOWED_REMOTE_IMAGE_TYPES.has(mime)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, limit);
}

async function fetchJson(url, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'NexoPDV/1.0 (product-image-search)' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${label} respondeu ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function openFoodFactsImage(product, provider) {
  const selected = product?.selected_images?.front?.display;
  const url = selected?.pt || selected?.en || product?.image_front_url || product?.image_url;
  if (!url) return null;
  return {
    url,
    thumbnailUrl: product?.image_front_small_url || product?.image_small_url || url,
    source: 'Open Food Facts',
    sourceUrl: product?.code ? `https://world.openfoodfacts.org/product/${product.code}` : '',
    title: product?.product_name || product?.generic_name || 'Produto',
    context: [product?.brands, product?.categories].filter(Boolean).join(' · '),
    width: 600,
    height: 600,
    mime: 'image/jpeg',
    provider,
  };
}

async function searchBarcodeCatalog(barcode) {
  if (!barcode) return [];
  try {
    const data = await fetchJson(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=code,product_name,generic_name,brands,categories,image_url,image_front_url,image_small_url,image_front_small_url,selected_images`,
      'Open Food Facts',
    );
    if (data?.status === 1 || data?.product) {
      const result = openFoodFactsImage(data.product, 'open-food-facts-barcode');
      return result ? [result] : [];
    }
  } catch {
    // O catálogo é complementar; outras fontes continuam sendo consultadas.
  }
  return [];
}

async function searchNameCatalog(name, page) {
  if (!name) return [];
  try {
    const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    url.searchParams.set('search_terms', name);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', '20');
    url.searchParams.set('page', String(page));
    url.searchParams.set('fields', 'code,product_name,generic_name,brands,categories,image_url,image_front_url,image_small_url,image_front_small_url,selected_images');
    const data = await fetchJson(url, 'Open Food Facts');
    return (data?.products || []).map(product => openFoodFactsImage(product, 'open-food-facts-text')).filter(Boolean);
  } catch {
    return [];
  }
}

async function searchWikimediaImages(query, page) {
  if (!query) return [];
  try {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', query);
    url.searchParams.set('gsrnamespace', '6');
    url.searchParams.set('gsrlimit', '20');
    url.searchParams.set('gsroffset', String((page - 1) * 20));
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|mime|size');
    url.searchParams.set('iiurlwidth', '420');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    url.searchParams.set('origin', '*');

    const data = await fetchJson(url, 'Wikimedia Commons');
    return (data?.query?.pages || []).flatMap(pageItem => {
      const info = pageItem?.imageinfo?.[0];
      if (!info?.url || !ALLOWED_REMOTE_IMAGE_TYPES.has(String(info.mime || '').toLowerCase())) return [];
      const title = String(pageItem.title || query).replace(/^File:/i, '').replace(/_/g, ' ');
      return [{
        url: info.url,
        thumbnailUrl: info.thumburl || info.url,
        source: 'Wikimedia Commons',
        sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(pageItem.title || '')}`,
        title,
        context: '',
        width: info.width,
        height: info.height,
        mime: info.mime,
        provider: 'wikimedia-commons',
      }];
    });
  } catch {
    return [];
  }
}

async function searchGoogleImages(query, page) {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const engineId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !engineId || !query) return [];

  const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', engineId);
  url.searchParams.set('q', query);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('safe', 'active');
  url.searchParams.set('num', '10');
  url.searchParams.set('start', String(Math.min(91, (page - 1) * 10 + 1)));

  try {
    const data = await fetchJson(url, 'Google Custom Search');
    return (data?.items || []).map(item => ({
      url: item.link,
      thumbnailUrl: item.image?.thumbnailLink || item.link,
      source: item.displayLink || 'Google Imagens',
      sourceUrl: item.image?.contextLink || '',
      title: item.title || query,
      context: item.snippet || '',
      width: item.image?.width,
      height: item.image?.height,
      mime: item.mime || '',
      provider: 'google-cse',
    }));
  } catch {
    return [];
  }
}

const providerState = () => ({
  openFoodFacts: true,
  wikimediaCommons: true,
  googleCustomSearch: Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID),
});

export async function searchProductImages({ barcode = '', name = '', page = 1 }) {
  const safePage = Math.max(1, Math.min(10, Number(page) || 1));
  const context = {
    barcode: normalizeText(barcode).replace(/\s/g, '').slice(0, 180),
    name: String(name || '').trim().slice(0, 180),
  };

  if (!context.barcode && !context.name) {
    throw new AppError(400, 'PRODUCT_IMAGE_QUERY_REQUIRED', 'Informe o nome ou o código de barras do produto.');
  }

  if (context.barcode) {
    const [catalogResults, commonsResults, googleResults] = await Promise.all([
      safePage === 1 ? searchBarcodeCatalog(context.barcode) : Promise.resolve([]),
      searchWikimediaImages(context.barcode, safePage),
      searchGoogleImages(context.barcode, safePage),
    ]);
    const barcodeResults = cleanResults([...catalogResults, ...commonsResults, ...googleResults], 5);
    if (barcodeResults.length) {
      return {
        results: barcodeResults,
        queryMode: 'barcode',
        query: context.barcode,
        page: safePage,
        hasMore: (commonsResults.length >= 5 || googleResults.length >= 5) && safePage < 10,
        providers: providerState(),
      };
    }
  }

  if (!context.name) {
    return {
      results: [],
      queryMode: 'barcode',
      query: context.barcode,
      page: safePage,
      hasMore: false,
      providers: providerState(),
    };
  }

  const [commonsNameResults, catalogNameResults, googleNameResults] = await Promise.all([
    searchWikimediaImages(context.name, safePage),
    searchNameCatalog(context.name, safePage),
    searchGoogleImages(context.name, safePage),
  ]);
  const nameResults = cleanResults([...commonsNameResults, ...catalogNameResults, ...googleNameResults], 5);

  return {
    results: nameResults,
    queryMode: 'name',
    query: context.name,
    page: safePage,
    hasMore: (commonsNameResults.length >= 5 || catalogNameResults.length >= 5 || googleNameResults.length >= 5) && safePage < 10,
    providers: providerState(),
  };
}
