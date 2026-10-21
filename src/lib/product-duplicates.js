const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/(\d)\s+(?=[a-z])/g, '$1').replace(/[^a-z0-9]+/g, ' ').trim();

export function similarProductNames(left, right) {
  const a = normalize(left).split(' ').filter(Boolean).sort();
  const b = normalize(right).split(' ').filter(Boolean).sort();
  if (!a.length || a.length !== b.length) return false;
  let differences = 0;
  for (let index = 0; index < a.length; index += 1) {
    const x = a[index], y = b[index];
    if (x === y) continue;
    // Quantities and short words distinguish sizes, brands and variations.
    if (/\d/.test(x + y) || Math.min(x.length, y.length) < 5) return false;
    const row = Array.from({ length: y.length + 1 }, (_, i) => i);
    for (let i = 1; i <= x.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= y.length; j += 1) {
        const old = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + Number(x[i - 1] !== y[j - 1]));
        previous = old;
      }
    }
    differences += row[y.length];
    if (differences > 1) return false;
  }
  return true;
}

export function productDuplicateMessage(product, products, excludeId = null) {
  const barcode = String(product.barcode || '').trim();
  const duplicate = products.find((existing) => existing.id !== excludeId && (
    (barcode && barcode === String(existing.barcode || '').trim()) ||
    ((!barcode || !String(existing.barcode || '').trim()) && similarProductNames(product.name, existing.name))
  ));
  if (!duplicate) return '';
  return barcode && barcode === String(duplicate.barcode || '').trim()
    ? `O código de barras já pertence ao produto "${duplicate.name}".`
    : `Já existe um produto com nome semelhante: "${duplicate.name}". Utilize o cadastro existente ou informe códigos de barras diferentes para identificar produtos distintos.`;
}
