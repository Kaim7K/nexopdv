import { AppError } from './errors.js';

export async function lookupBarcode(barcode) {
  const code = String(barcode || '').replace(/\D/g, '');
  if (!/^\d{6,14}$/.test(code)) throw new AppError(400, 'INVALID_BARCODE', 'Informe um código de barras válido.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,product_name_pt,brands,quantity,categories_tags,image_front_url`, {
      headers: { 'User-Agent': 'NexoPDV/1.0 (barcode-lookup)' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.status !== 1 || !data.product) return null;
    const product = data.product;
    return {
      barcode: code,
      name: product.product_name_pt || product.product_name || '',
      brand: String(product.brands || '').split(',')[0].trim(),
      quantity: product.quantity || '',
      image_url: product.image_front_url || '',
      category: Array.isArray(product.categories_tags) ? String(product.categories_tags[0] || '').replace(/^..:/, '') : '',
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new AppError(504, 'CATALOG_TIMEOUT', 'O catálogo demorou para responder.');
    throw new AppError(502, 'CATALOG_UNAVAILABLE', 'Não foi possível consultar o catálogo agora.');
  } finally {
    clearTimeout(timeout);
  }
}
