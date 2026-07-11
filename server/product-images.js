import { AppError } from './errors.js';

const BAD_TEXT = [
  'banner', 'promocao', 'oferta', 'encarte', 'folheto', 'prateleira',
  'shelf', 'store', 'pessoa', 'person', 'segurando', 'holding', 'mao',
  'anuncio', 'advertisement', 'montagem', 'collage', 'mockup', 'kit promocional',
  'receita', 'recipe', 'review', 'video', 'youtube', 'instagram', 'facebook',
  'pinterest', 'unboxing', 'olx', 'reclame aqui',
];

const PACKSHOT_TEXT = [
  'fundo branco', 'white background', 'isolado', 'isolated', 'png', 'produto',
  'embalagem', 'packshot', 'supermercado', 'delivery', 'loja online',
];

const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'para', 'por', 'em', 'e', 'a', 'o',
  'um', 'uma', 'the', 'and', 'with', 'product', 'produto',
]);

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const tokens = value => normalizeText(value)
  .split(/\s+/)
  .filter(token => token.length > 1 && !STOP_WORDS.has(token));

function textLooksRejected(...values) {
  const text = normalizeText(values.filter(Boolean).join(' '));
  return BAD_TEXT.some(term => text.includes(normalizeText(term)));
}

function productSimilarity(expectedName, candidateName) {
  const expected = new Set(tokens(expectedName));
  const candidate = new Set(tokens(candidateName));
  if (!expected.size || !candidate.size) return 0;
  let matches = 0;
  for (const token of expected) if (candidate.has(token)) matches += 1;
  return matches / expected.size;
}

function imageGeometryScore(width, height) {
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (!w || !h) return 0;
  if (w < 220 || h < 220) return -100;
  const ratio = w / h;
  if (ratio < 0.42 || ratio > 2.4) return -100;
  return 20 - Math.abs(1 - ratio) * 12 + Math.min(15, Math.log2(Math.min(w, h) / 220 + 1) * 5);
}

function scoreResult(result, context) {
  let score = result.provider === 'google-cse' ? 220 : 0;
  if (result.provider === 'open-food-facts-barcode') score += 35;
  score += result.background === 'transparent' ? 220 : result.background === 'white' ? 170 : 0;
  score += imageGeometryScore(result.width, result.height);
  if (/png/i.test(result.mime || result.url)) score += 12;
  if (context.barcode && normalizeText(`${result.title} ${result.context}`).includes(context.barcode)) score += 140;
  score += productSimilarity(context.name, `${result.title} ${result.context}`) * 180;
  score += productSimilarity(context.category, `${result.title} ${result.context}`) * 30;

  const text = normalizeText(`${result.title} ${result.context} ${result.sourceUrl}`);
  if (PACKSHOT_TEXT.some(term => text.includes(normalizeText(term)))) score += 80;
  if (result.provider?.startsWith('open-food-facts') && result.background === 'catalog') score -= 180;
  return score;
}

function cleanResults(results, context, limit) {
  const seen = new Set();
  return results
    .filter(result => {
      if (!result?.url || seen.has(result.url)) return false;
      seen.add(result.url);
      if (!/^https:\/\//i.test(result.url)) return false;
      if (textLooksRejected(result.title, result.context, result.source, result.sourceUrl)) return false;
      if (imageGeometryScore(result.width, result.height) <= -100) return false;
      if (result.provider !== 'open-food-facts-barcode' && context.name) {
        const haystack = `${result.title} ${result.context}`;
        const similarity = productSimilarity(context.name, haystack);
        if (similarity < 0.34 && !normalizeText(haystack).includes(normalizeText(context.barcode))) return false;
      }
      return true;
    })
    .map(result => ({ ...result, score: scoreResult(result, context) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...result }) => result);
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

function openFoodFactsImage(product, provider, exactBarcode = false) {
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
    background: exactBarcode ? 'catalog' : 'white',
    provider,
  };
}

async function searchOpenFoodFacts({ barcode, name, category, page, includeBarcode = true, includeText = true }) {
  const output = [];
  if (includeBarcode && barcode && page === 1) {
    try {
      const data = await fetchJson(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=code,product_name,generic_name,brands,categories,image_url,image_front_url,image_small_url,image_front_small_url,selected_images`,
        'Open Food Facts',
      );
      if (data?.status === 1 || data?.product) {
        const result = openFoodFactsImage(data.product, 'open-food-facts-barcode', true);
        if (result) output.push(result);
      }
    } catch {
      // The exact-barcode provider is optional; other providers can continue.
    }
  }

  if (includeText && name) {
    try {
      const searchTerms = [name, category].filter(Boolean).join(' ');
      const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
      url.searchParams.set('search_terms', searchTerms);
      url.searchParams.set('search_simple', '1');
      url.searchParams.set('action', 'process');
      url.searchParams.set('json', '1');
      url.searchParams.set('page_size', '20');
      url.searchParams.set('page', String(page));
      url.searchParams.set('fields', 'code,product_name,generic_name,brands,categories,image_url,image_front_url,image_small_url,image_front_small_url,selected_images');
      const data = await fetchJson(url, 'Open Food Facts');
      for (const product of data?.products || []) {
        const result = openFoodFactsImage(product, 'open-food-facts-text');
        if (result) output.push(result);
      }
    } catch {
      // Search can still continue with Google Custom Search.
    }
  }
  return output;
}

function makeGoogleQuery(base, background) {
  const cleanBase = String(base || '').replace(/\b\d{8,14}\b/g, '').trim() || base;
  const qualityTerms = background === 'transparent'
    ? 'produto png fundo transparente embalagem'
    : 'produto fundo branco embalagem supermercado';
  return `"${cleanBase}" ${qualityTerms} -banner -promocao -oferta -encarte -prateleira -pessoa -segurando -mao -review -receita -youtube -instagram -pinterest`;
}

async function searchGoogleQuery({ query, page, background }) {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const engineId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !engineId) return [];

  const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', engineId);
  url.searchParams.set('q', makeGoogleQuery(query, background));
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('safe', 'active');
  url.searchParams.set('gl', 'br');
  url.searchParams.set('lr', 'lang_pt');
  url.searchParams.set('num', '10');
  url.searchParams.set('start', String(Math.min(91, (page - 1) * 10 + 1)));
  url.searchParams.set('imgType', 'photo');
  if (background === 'transparent') url.searchParams.set('imgColorType', 'trans');
  if (background === 'white') url.searchParams.set('imgDominantColor', 'white');

  try {
    const data = await fetchJson(url, 'Google Custom Search');
    return (data?.items || []).map(item => ({
      url: item.link,
      thumbnailUrl: item.image?.thumbnailLink || item.link,
      source: item.displayLink || 'Google Imagens',
      sourceUrl: item.image?.contextLink || '',
      title: item.title || '',
      context: item.snippet || '',
      width: item.image?.width,
      height: item.image?.height,
      mime: item.mime || '',
      background,
      provider: 'google-cse',
    }));
  } catch {
    return [];
  }
}

export async function searchProductImages({ barcode = '', name = '', category = '', page = 1 }) {
  const safePage = Math.max(1, Math.min(10, Number(page) || 1));
  const context = {
    barcode: String(barcode || '').trim(),
    name: String(name || '').trim(),
    category: String(category || '').trim(),
  };
  if (!context.barcode && !context.name) {
    throw new AppError(400, 'PRODUCT_IMAGE_QUERY_REQUIRED', 'Informe o nome ou o código de barras do produto.');
  }

  const exactCatalog = await searchOpenFoodFacts({
    ...context,
    page: safePage,
    includeBarcode: true,
    includeText: false,
  });
  const inferredName = context.name || exactCatalog[0]?.title || '';
  const inferredContext = { ...context, name: inferredName };

  const queryPriority = [];
  if (inferredName) queryPriority.push(inferredName);
  if (inferredName && context.category) queryPriority.push(`${inferredName} ${context.category}`);
  if (context.barcode && !inferredName) queryPriority.push(context.barcode);
  const queries = [...new Set(queryPriority)];

  const [transparentGroups, textCatalog] = await Promise.all([
    Promise.all(queries.map(query => searchGoogleQuery({
      query,
      page: safePage,
      background: 'transparent',
    }))),
    searchOpenFoodFacts({
      ...inferredContext,
      page: safePage,
      includeBarcode: false,
      includeText: true,
    }),
  ]);

  const all = [
    ...transparentGroups.flat(),
    ...textCatalog,
    ...exactCatalog,
  ];

  if (cleanResults(all, inferredContext, 5).length < 5) {
    const whiteGroups = await Promise.all(queries.map(query => searchGoogleQuery({
      query,
      page: safePage,
      background: 'white',
    })));
    all.push(...whiteGroups.flat());
  }

  const results = cleanResults(all, inferredContext, 5);
  return {
    results,
    inferredName,
    page: safePage,
    hasMore: results.length === 5 && safePage < 10,
    providers: {
      openFoodFacts: true,
      googleCustomSearch: Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID),
    },
  };
}
