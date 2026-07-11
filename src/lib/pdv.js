export const createEmptySale = () => ({
  items: [],
  payments: [],
  discount_value: 0,
  discount_type: 'valor',
  observation: '',
  sale_type: 'normal',
});

export const readSavedPdvDraft = key => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || 'null');
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
};

export const findProductByCapture = (products, code) => {
  const rawCode = String(code || '');
  const loweredCode = rawCode.toLowerCase();
  return products.find(product => product.barcode === rawCode || product.internal_code === rawCode)
    || products.find(product => String(product.name || '').toLowerCase() === loweredCode)
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

export const removeSaleItem = (items, index) => items.filter((_, currentIndex) => currentIndex !== index);
