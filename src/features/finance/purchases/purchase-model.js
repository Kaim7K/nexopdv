import { roundCurrency } from '../../../lib/helpers.js';
import { todayIsoDate } from '../../../lib/date-helpers.js';

export function createPurchaseForm(bootstrap, issueDate = todayIsoDate()) {
  return {
    supplier_id: '',
    account_id: bootstrap.accounts?.find(account => account.is_default)?.id || bootstrap.accounts?.[0]?.id || '',
    issue_date: issueDate,
    payment_method: 'boleto',
    discount: '0',
    freight: '0',
    invoice_number: '',
    attachment_url: '',
    items: [{ product_id: '', quantity: 1, unit_cost: '' }],
  };
}

export function getPurchaseTotals(form) {
  const subtotal = roundCurrency(form.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0,
  ));
  const total = roundCurrency(Math.max(0, subtotal - Number(form.discount || 0) + Number(form.freight || 0)));
  return { subtotal, total };
}

export function buildPurchasePayload(form, total) {
  return {
    ...form,
    items: form.items.map(item => ({
      ...item,
      quantity: Number(item.quantity),
      unit_cost: Number(item.unit_cost),
    })),
    installments: [{
      amount: total,
      due_date: form.issue_date,
      status: form.payment_method === 'dinheiro' || form.payment_method === 'pix' ? 'paid' : 'pending',
    }],
  };
}
