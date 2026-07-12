export const DEFAULT_PRODUCT_CATEGORIES = [
  'Mercearia',
  'Temperos/Condimentos',
  'Limpeza',
  'Bomboniere',
  'Tabacaria',
  'Laticínios',
  'Higiene Pessoal',
  'Enlatados/Conservas',
  'Bebidas',
  'Utilidades',
  'Hortifruti',
  'Padaria',
];

/** @param {unknown} value */
const normalizeCategory = value => String(value || '').trim();
const categoryKey = value => normalizeCategory(value).toLowerCase();

/** @param {unknown} value */
export function parseProductCategories(value = '') {
  if (Array.isArray(value)) return value.map(normalizeCategory).filter(Boolean);
  return String(value || '')
    .split(/\r?\n|,/)
    .map(normalizeCategory)
    .filter(Boolean);
}

export function formatProductCategories(categories = []) {
  const unique = new Map();
  for (const category of categories.map(normalizeCategory).filter(Boolean)) {
    const key = categoryKey(category);
    if (!unique.has(key)) unique.set(key, category);
  }
  return [...unique.values()].sort((first, second) => first.localeCompare(second, 'pt-BR'));
}

export function mergeProductCategories(categories = [], customCategories = []) {
  const custom = parseProductCategories(customCategories);
  const base = custom.length ? custom : DEFAULT_PRODUCT_CATEGORIES;
  return formatProductCategories([
    ...base,
    ...categories,
  ]);
}

export function isDefaultProductCategory(category) {
  return DEFAULT_PRODUCT_CATEGORIES.includes(normalizeCategory(category));
}

export function isProtectedProductCategory(category, customCategories = []) {
  const value = normalizeCategory(category);
  if (!value) return false;
  return parseProductCategories(customCategories).includes(value);
}

export function removeProductCategory(categories = [], target = '') {
  const normalizedTarget = categoryKey(target);
  return formatProductCategories(categories.filter(category => categoryKey(category) !== normalizedTarget));
}

export function upsertProductCategory(categories = [], target = '', nextValue = '') {
  const normalizedTarget = categoryKey(target);
  const normalizedNext = normalizeCategory(nextValue);
  const filtered = categories
    .map(normalizeCategory)
    .filter(Boolean)
    .filter(category => categoryKey(category) !== normalizedTarget);
  if (normalizedNext) filtered.push(normalizedNext);
  return formatProductCategories(filtered);
}

export function hasProductCategory(categories = [], target = '') {
  const normalizedTarget = categoryKey(target);
  return formatProductCategories(categories).some(category => categoryKey(category) === normalizedTarget);
}

export function categoriesToStorageValue(categories = []) {
  return formatProductCategories(categories).join('\n');
}

export function categoriesFromStorageValue(value = '') {
  return formatProductCategories(parseProductCategories(value));
}
