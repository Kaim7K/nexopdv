export const EDITABLE_COLUMNS = [
  ['name', 'Produto', 'text'],
  ['category', 'Categoria', 'text'],
  ['barcode', 'Código de barras', 'text'],
  ['internal_code', 'Código interno', 'text'],
  ['sale_price', 'Preço venda', 'number'],
  ['cost_price', 'Preço custo', 'number'],
  ['quantity', 'Estoque', 'number'],
  ['unit', 'Unidade', 'text'],
  ['status', 'Status', 'text'],
];

export const TABLE_COLUMNS = [
  ...EDITABLE_COLUMNS.slice(0, 8),
  ['last_sale_at', 'Última venda', 'date'],
  EDITABLE_COLUMNS[8],
];

export const TABLE_COLUMN_VISIBILITY = {
  category: 'hidden min-[1440px]:table-cell',
  barcode: 'hidden min-[1440px]:table-cell',
  status: 'hidden min-[1440px]:table-cell',
  internal_code: 'hidden min-[1800px]:table-cell',
  cost_price: 'hidden min-[1800px]:table-cell',
};

export const tableColumnWidth = (key) =>
  ({
    name: 'min-w-[200px]',
    category: 'min-w-[132px]',
    barcode: 'min-w-[124px]',
    internal_code: 'min-w-[112px]',
    sale_price: 'min-w-[104px]',
    cost_price: 'min-w-[104px]',
    quantity: 'min-w-[84px]',
    unit: 'min-w-[96px]',
    last_sale_at: 'min-w-[124px]',
    status: 'min-w-[96px]',
  })[key] || 'min-w-[104px]';

export const normalizeStockValue = (value, type) =>
  type === 'number' ? (value === '' ? '' : Number(value)) : String(value ?? '');

export const normalizeHeader = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const pickRowValue = (row, normalizedRow, labels = []) => {
  for (const label of labels) {
    const value = row?.[label];
    if (value !== undefined && value !== null && String(value).trim() !== '')
      return value;
    const normalized = normalizedRow?.[normalizeHeader(label)];
    if (
      normalized !== undefined &&
      normalized !== null &&
      String(normalized).trim() !== ''
    )
      return normalized;
  }
  return '';
};

export const normalizeImportedImageUrl = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (/^www\./i.test(text)) return `https://${text}`;
  if (/^\/\/[^/]+/i.test(text)) return `https:${text}`;
  if (/^data:image\/(jpeg|png|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(text))
    return text.replace(/\s+/g, '');
  return '';
};

export const productNameKey = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ');

export const safeFilePart = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export const discardDuplicateProducts = (items) => {
  const seenNames = new Set();
  const seenBarcodes = new Set();
  const products = items.filter((product) => {
    const name = productNameKey(product.name);
    const barcode = String(product.barcode || '').trim();
    if (seenNames.has(name) || (barcode && seenBarcodes.has(barcode)))
      return false;
    seenNames.add(name);
    if (barcode) seenBarcodes.add(barcode);
    return true;
  });
  return { products, discarded: items.length - products.length };
};
