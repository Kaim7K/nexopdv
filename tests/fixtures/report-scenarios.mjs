// Fixed historical data: no database, credentials or clock-dependent values.
export const now = '2026-03-01T12:00:00-03:00';
export const products = [
  { id: 'rice', name: 'Arroz', category: 'Mercearia' },
  { id: 'apple', name: 'Maçã', category: 'Hortifruti' },
];
export const sales = [
  { id: 'today-start', status: 'concluida', created_date: '2026-03-01T00:00:00-03:00', total: 18, subtotal: 20, seller_name: 'Ana', items: [{ product_id: 'rice', product_name: 'Arroz', unit: 'unidade', quantity: 2, unit_price: 10, subtotal: 20 }], payments: [{ method: 'dinheiro', amount: 20 }] },
  { id: 'today-end', status: 'concluida', created_date: '2026-03-01T23:59:59.999-03:00', total: 10.01, items: [{ product_id: 'apple', product_name: 'Maçã', unit: 'peso', weight: 0.5, subtotal: 5.01, product_category: 'Frutas' }, { product_id: 'apple', product_name: 'Maçã', unit: 'peso', weight: 0.5, subtotal: 5 }], payments: [{ method: 'pix', amount: 10.01 }] },
  { id: 'yesterday', status: 'concluida', created_date: '2026-02-28T23:59:59.999-03:00', total: 20, seller_name: 'Bruno', items: [{ product_id: 'rice', product_name: 'Arroz', quantity: 2, subtotal: 20 }], payment_method: 'debito' },
  { id: 'previous-month-start', status: 'concluida', created_date: '2026-02-01T00:00:00-03:00', total: 6, items: [{ product_name: 'Avulso', quantity: 1, subtotal: 6 }], payments: [{ method: 'outros', amount: 6 }] },
  { id: 'current-year-start', status: 'concluida', created_date: '2026-01-01T00:00:00-03:00', total: 12, seller_name: 'Ana', items: [{ product_id: 'rice', product_name: 'Arroz', quantity: 1, subtotal: 12 }], payments: [{ method: 'credito', amount: 12 }] },
  { id: 'previous-year-end', status: 'concluida', created_date: '2025-12-31T23:59:59-03:00', subtotal: 30, discount_type: 'percentual', discount_value: 10, items: [{ product_id: 'rice', product_name: 'Arroz', quantity: 3, subtotal: 30 }], payments: [{ method: 'pix', amount: 27 }] },
  { id: 'cancelled-today', status: 'cancelada', created_date: '2026-03-01T10:00:00-03:00', total: 1000, items: [] },
  { id: 'cancelled-yesterday', status: 'cancelada', created_date: '2026-02-28T10:00:00-03:00', total: 1000, items: [] },
  { id: 'draft', status: 'rascunho', created_date: '2026-03-01T10:00:00-03:00', total: 9999, items: [] },
  { id: 'invalid-date', status: 'concluida', created_date: 'invalid', total: 9999, items: [] },
  { id: 'zero', status: 'concluida', created_date: '2026-03-01T11:00:00-03:00', total: 0, items: [], payments: [] },
];
export const fiados = [
  { created_date: '2026-03-01T11:00:00-03:00', status: 'pendente', total_amount: 25.5 },
  { created_date: '2026-03-01T12:00:00-03:00', status: 'quitado', total_amount: 100 },
  { created_date: '2026-02-28T11:00:00-03:00', status: 'pendente', total_amount: 12 },
];
export const scenarios = [
  { period: 'today', customStart: '', customEnd: '' },
  { period: 'week', customStart: '', customEnd: '' },
  { period: 'month', customStart: '', customEnd: '' },
  { period: 'year', customStart: '', customEnd: '' },
  { period: 'custom', customStart: '2026-02-28', customEnd: '2026-03-01' },
  { period: 'custom', customStart: '2026-03-01', customEnd: '' },
  { period: 'custom', customStart: '2026-03-02', customEnd: '2026-03-01' },
];
export const breakdowns = ['hour', 'day', 'weekday', 'month'];
