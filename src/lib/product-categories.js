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

const normalizeCategory = value => String(value || '').trim();

export function parseProductCategories(value = '') {
  if (Array.isArray(value)) return value.map(normalizeCategory).filter(Boolean);
  return String(value || '')
    .split(/\r?\n|,/)
    .map(normalizeCategory)
    .filter(Boolean);
}

export function formatProductCategories(categories = []) {
  return [...new Set(categories.map(normalizeCategory).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, 'pt-BR'));
}

export function mergeProductCategories(categories = [], customCategories = []) {
  return formatProductCategories([
    ...DEFAULT_PRODUCT_CATEGORIES,
    ...categories,
    ...parseProductCategories(customCategories),
  ]);
}

export function isDefaultProductCategory(category) {
  return DEFAULT_PRODUCT_CATEGORIES.includes(normalizeCategory(category));
}

export function isProtectedProductCategory(category, customCategories = []) {
  const value = normalizeCategory(category);
  if (!value) return false;
  return isDefaultProductCategory(value) || parseProductCategories(customCategories).includes(value);
}

export function removeProductCategory(categories = [], target = '') {
  const normalizedTarget = normalizeCategory(target);
  return formatProductCategories(categories.filter(category => normalizeCategory(category) !== normalizedTarget));
}

export function upsertProductCategory(categories = [], target = '', nextValue = '') {
  const normalizedTarget = normalizeCategory(target);
  const normalizedNext = normalizeCategory(nextValue);
  const filtered = categories
    .map(normalizeCategory)
    .filter(Boolean)
    .filter(category => category !== normalizedTarget);
  if (normalizedNext) filtered.push(normalizedNext);
  return formatProductCategories(filtered);
}

export function hasProductCategory(categories = [], target = '') {
  const normalizedTarget = normalizeCategory(target);
  return formatProductCategories(categories).includes(normalizedTarget);
}

export function categoriesToStorageValue(categories = []) {
  return formatProductCategories(categories).join('\n');
}

export function categoriesFromStorageValue(value = '') {
  return formatProductCategories(parseProductCategories(value));
}
