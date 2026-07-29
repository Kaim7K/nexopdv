import { generateInternalCode, parseCurrencyDigits } from '@/lib/helpers';

export const EMPTY_PRODUCT_FORM = {
  name: '',
  category: '',
  barcode: '',
  internal_code: '',
  image_url: '',
  sale_price: '',
  cost_price: '',
  quantity: '',
  unit: 'unidade',
  status: 'ativo',
  allow_pdv_price_edit: false,
  track_stock: true,
};

const priceToInputDigits = (value) =>
  value === null || value === undefined
    ? ''
    : String(Math.round(Number(value || 0) * 100));

export const createEmptyProductForm = () => ({
  ...EMPTY_PRODUCT_FORM,
  internal_code: generateInternalCode(),
});

export const productToForm = (product) => ({
  name: product.name || '',
  category: product.category || '',
  barcode: product.barcode || '',
  internal_code: product.internal_code || generateInternalCode(),
  image_url: product.image_url || '',
  sale_price: priceToInputDigits(product.sale_price),
  cost_price: priceToInputDigits(product.cost_price),
  quantity: product.quantity ?? '',
  unit: product.unit || 'unidade',
  status: product.status || 'ativo',
  allow_pdv_price_edit: Boolean(product.allow_pdv_price_edit),
  track_stock: product.track_stock !== false,
});

export const duplicateProductToForm = (product) => ({
  name: `${product.name || 'Produto'} - Cópia`,
  category: product.category || '',
  barcode: '',
  internal_code: generateInternalCode(),
  image_url: product.image_url || '',
  sale_price: priceToInputDigits(product.sale_price),
  cost_price: priceToInputDigits(product.cost_price),
  quantity: '0',
  unit: product.unit || 'unidade',
  status: product.status || 'ativo',
  allow_pdv_price_edit: false,
  track_stock: product.track_stock !== false,
});

export const validateProductForm = (form) => {
  if (!form.name.trim()) return 'Nome é obrigatório.';
  if (form.sale_price === '' || parseCurrencyDigits(form.sale_price) < 0)
    return 'Informe um preço de venda válido.';
  if (form.quantity !== '' && Number(form.quantity) < 0)
    return 'A quantidade não pode ser negativa.';
  return '';
};

export const productFormPayload = ({
  form,
  canUploadProductImage,
  isEditing,
  imageChanged,
  product,
}) => {
  const data = {
    name: form.name.trim(),
    category: form.category.trim(),
    barcode: form.barcode.trim(),
    internal_code: form.internal_code,
    sale_price: parseCurrencyDigits(form.sale_price) || 0,
    cost_price:
      form.cost_price === '' ? null : parseCurrencyDigits(form.cost_price),
    quantity: form.quantity === '' ? 0 : Number.parseFloat(form.quantity),
    unit: form.unit,
    status: form.status,
    allow_pdv_price_edit: Boolean(form.allow_pdv_price_edit),
    track_stock: Boolean(form.track_stock),
  };

  if (
    canUploadProductImage &&
    (!isEditing || imageChanged || !product?.image_is_inline)
  )
    data.image_url = form.image_url || '';

  return data;
};
