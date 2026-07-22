export const PDV_DRAFT_INACTIVITY_MS = 5 * 60 * 1000;
const SEARCH_MIN_SCORE = 48;

export const normalizeProductSearchText = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const searchTokens = value =>
  normalizeProductSearchText(value).split(' ').filter(Boolean);

const levenshteinDistance = (first, second) => {
  if (first === second) return 0;
  if (!first) return second.length;
  if (!second) return first.length;

  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const current = [firstIndex + 1];
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const substitutionCost =
        first[firstIndex] === second[secondIndex] ? 0 : 1;
      current.push(
        Math.min(
          current[secondIndex] + 1,
          previous[secondIndex + 1] + 1,
          previous[secondIndex] + substitutionCost,
        ),
      );
    }
    previous = current;
  }
  return previous[second.length];
};

const similarTokenScore = (queryToken, targetToken) => {
  if (!queryToken || !targetToken) return 0;
  if (queryToken === targetToken) return 100;
  if (targetToken.startsWith(queryToken)) return 92;
  if (targetToken.includes(queryToken)) return 86;
  if (queryToken.length >= 4 && queryToken.includes(targetToken)) return 76;

  const distance = levenshteinDistance(queryToken, targetToken);
  const longest = Math.max(queryToken.length, targetToken.length);
  const allowedDistance = longest <= 5 ? 1 : longest <= 8 ? 2 : 3;
  if (distance > allowedDistance) return 0;
  return Math.max(50, 78 - distance * 10);
};

export const getProductSearchScore = (product, query) => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (!normalizedQuery) return 0;

  const compactQuery = normalizedQuery.replaceAll(' ', '');
  const barcode = String(product.barcode || '');
  const internalCode = normalizeProductSearchText(product.internal_code);
  if (barcode && barcode.includes(compactQuery)) return 220;
  if (internalCode && internalCode.includes(compactQuery)) return 190;

  const queryTokens = searchTokens(normalizedQuery);
  if (!queryTokens.length) return 0;

  const name = normalizeProductSearchText(product.name);
  const category = normalizeProductSearchText(product.category);
  const haystack = [name, category, internalCode].filter(Boolean).join(' ');
  if (haystack.includes(normalizedQuery)) return 170;

  const targetTokens = searchTokens(haystack);
  if (!targetTokens.length) return 0;

  const tokenScoreTotal = queryTokens.reduce((sum, queryToken) => {
    const best = targetTokens.reduce(
      (max, targetToken) =>
        Math.max(max, similarTokenScore(queryToken, targetToken)),
      0,
    );
    return sum + best;
  }, 0);
  const averageTokenScore = tokenScoreTotal / queryTokens.length;
  const matchedTokens = queryTokens.filter(queryToken =>
    targetTokens.some(targetToken => similarTokenScore(queryToken, targetToken) >= 50),
  ).length;
  const coverage = matchedTokens / queryTokens.length;
  const fieldBoost = name.startsWith(queryTokens[0]) ? 18 : 0;

  return averageTokenScore * coverage + fieldBoost;
};

export const searchProducts = (products, query, { limit = 10 } = {}) => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (!normalizedQuery) return [];
  return products
    .map(product => ({
      product,
      score: getProductSearchScore(product, normalizedQuery),
    }))
    .filter(result => result.score >= SEARCH_MIN_SCORE)
    .sort(
      (first, second) =>
        second.score - first.score ||
        Number(second.product.sales_count || 0) -
          Number(first.product.sales_count || 0) ||
        String(first.product.name || '').localeCompare(
          String(second.product.name || ''),
          'pt-BR',
          { numeric: true, sensitivity: 'base' },
        ),
    )
    .slice(0, limit)
    .map(result => result.product);
};

export const isPdvDraftExpired = (draft, now = Date.now(), maxInactiveMs = PDV_DRAFT_INACTIVITY_MS) => {
  if (!draft || typeof draft !== 'object') return false;
  const inactiveSince = Number(draft.inactiveSince || 0);
  const lastActiveAt = Number(draft.lastActiveAt || Date.parse(draft.savedAt || '') || 0);
  if (inactiveSince > 0) return now - inactiveSince >= maxInactiveMs;
  return lastActiveAt > 0 && now - lastActiveAt >= maxInactiveMs;
};

export const createEmptySale = () => ({
  items: [],
  payments: [],
  discount_value: 0,
  discount_type: 'valor',
  observation: '',
  sale_type: 'normal',
});

export const readSavedPdvDraft = (key, { maxInactiveMs = PDV_DRAFT_INACTIVITY_MS } = {}) => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (!saved || typeof saved !== 'object') return null;
    if (isPdvDraftExpired(saved, Date.now(), maxInactiveMs)) {
      window.localStorage.removeItem(key);
      return null;
    }
    return saved;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
};

export const findProductByCapture = (products, code) => {
  const rawCode = String(code || '');
  const loweredCode = normalizeProductSearchText(rawCode);
  return products.find(product => product.barcode === rawCode || product.internal_code === rawCode)
    || products.find(product => normalizeProductSearchText(product.name) === loweredCode)
    || null;
};

const saleItemFromProduct = product => {
  const unitPrice = Number(product.sale_price);
  const isWeighted = product.unit === 'peso';
  return {
    product_id: product.id,
    product_name: product.name,
    barcode: product.barcode || '',
    internal_code: product.internal_code || '',
    quantity: 1,
    weight: isWeighted ? 0.1 : null,
    unit_price: unitPrice,
    subtotal: (isWeighted ? 0.1 : 1) * unitPrice,
    unit: product.unit,
    allow_pdv_price_edit: Boolean(product.allow_pdv_price_edit),
  };
};

export const addProductToSaleItems = (items, product) => {
  const existing = items.find(item => item.product_id === product.id);
  if (!existing) return [...items, saleItemFromProduct(product)];

  if (product.unit === 'peso') {
    return items.map(item => {
      if (item.product_id !== product.id) return item;
      const weight = Number(item.weight || 0) + 0.1;
      return { ...item, weight, subtotal: weight * item.unit_price };
    });
  }

  return items.map(item => {
    if (item.product_id !== product.id) return item;
    const quantity = Number(item.quantity || 0) + 1;
    return { ...item, quantity, subtotal: quantity * item.unit_price };
  });
};

export const updateSaleItemQuantity = (items, index, quantity) => {
  const safeQuantity = Math.max(1, Number(quantity) || 1);
  return items.map((item, currentIndex) => currentIndex === index
    ? { ...item, quantity: safeQuantity, subtotal: safeQuantity * item.unit_price }
    : item);
};

export const updateSaleItemWeight = (items, index, weight) => {
  const safeWeight = Math.max(0, Number.parseFloat(weight) || 0);
  return items.map((item, currentIndex) => currentIndex === index
    ? { ...item, weight: safeWeight, subtotal: safeWeight * item.unit_price }
    : item);
};

export const updateSaleItemPrice = (items, index, price) => {
  const safePrice = Math.max(0, Number.parseFloat(price) || 0);
  return items.map((item, currentIndex) => currentIndex === index
    ? { ...item, unit_price: safePrice, subtotal: safePrice * (item.unit === 'peso' ? Number(item.weight || 0) : Number(item.quantity || 0)) }
    : item);
};

export const removeSaleItem = (items, index) => items.filter((_, currentIndex) => currentIndex !== index);
