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

export function mergeProductCategories(categories = []) {
  return [...new Set([...DEFAULT_PRODUCT_CATEGORIES, ...categories].map(value => String(value || '').trim()).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, 'pt-BR'));
}
