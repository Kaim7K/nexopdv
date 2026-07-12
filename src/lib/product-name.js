const UNIT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(litros?|lts?|l|mililitros?|ml|quilogramas?|quilos?|kgs?|kg|gramas?|grs?|g|unidades?|un|pacotes?|pct)\b/gi;
const UNIT_NAMES = {
  litro: 'L', litros: 'L', lt: 'L', lts: 'L', l: 'L',
  mililitro: 'ml', mililitros: 'ml', ml: 'ml',
  quilograma: 'kg', quilogramas: 'kg', quilo: 'kg', quilos: 'kg', kg: 'kg', kgs: 'kg',
  grama: 'g', gramas: 'g', gr: 'g', grs: 'g', g: 'g',
  unidade: 'un', unidades: 'un', un: 'un', pacote: 'pct', pacotes: 'pct', pct: 'pct',
};

const WORD_FIXES = new Map([
  ['liquid', 'líquido'], ['liquido', 'líquido'], ['integral', 'integral'],
  ['desnatado', 'desnatado'], ['semidesnatado', 'semidesnatado'],
]);

function cleanWords(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return text.split(/([\s\-/]+)/).map(part => {
    if (/^[\s\-/]+$/.test(part)) return part;
    const lower = part.toLocaleLowerCase('pt-BR');
    const corrected = WORD_FIXES.get(lower) || lower;
    return corrected.charAt(0).toLocaleUpperCase('pt-BR') + corrected.slice(1);
  }).join('');
}

export function standardizeProductName(name, { brand = '', quantity = '' } = {}) {
  let detectedQuantity = String(quantity || '').trim();
  const rawParts = String(name || '').split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  let product = rawParts.shift() || '';
  let detectedBrand = String(brand || '').trim();
  if (!detectedBrand && rawParts.length > 1) detectedBrand = rawParts.shift();
  if (!detectedQuantity && rawParts.length) detectedQuantity = rawParts.shift();

  product = product.replace(UNIT_PATTERN, (_, amount, unit) => {
    if (!detectedQuantity) detectedQuantity = `${String(amount).replace(',', '.')}${UNIT_NAMES[unit.toLocaleLowerCase('pt-BR')] || unit}`;
    return ' ';
  }).replace(/\s+/g, ' ').trim();

  if (detectedBrand) {
    const escapedBrand = detectedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    product = product.replace(new RegExp(`(?:\\s+-?\\s*)?${escapedBrand}$`, 'i'), '').trim();
  }

  if (detectedQuantity) {
    detectedQuantity = detectedQuantity.replace(UNIT_PATTERN, (_, amount, unit) => `${String(amount).replace(',', '.')}${UNIT_NAMES[unit.toLocaleLowerCase('pt-BR')] || unit}`);
  }

  const parts = [cleanWords(product)];
  if (detectedBrand) parts.push(cleanWords(detectedBrand));
  if (detectedQuantity) parts.push(detectedQuantity.replace(/\s+/g, ''));
  return parts.filter(Boolean).join(' - ');
}
