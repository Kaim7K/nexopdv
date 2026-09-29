import assert from 'node:assert/strict';
import {
  allocateSaleItems,
  buildProductReport,
  getSalePaymentAllocations,
} from '../src/lib/report-metrics.js';

const discountedSale = {
  id: 'sale-1',
  status: 'concluida',
  created_date: '2026-09-28T14:30:00-03:00',
  subtotal: 150,
  total: 120,
  items: [
    {
      product_id: 'product-a',
      product_name: 'Produto A',
      unit: 'unidade',
      quantity: 1,
      subtotal: 100,
    },
    {
      product_id: 'product-b',
      product_name: 'Produto B',
      unit: 'peso',
      weight: 0.5,
      subtotal: 50,
    },
  ],
};

const allocation = allocateSaleItems(discountedSale);
assert.equal(
  allocation.reduce((sum, row) => sum + row.netRevenue, 0),
  120,
  'O faturamento dos produtos deve reconciliar exatamente com o total líquido.',
);
assert.equal(allocation[0].netRevenue, 80);
assert.equal(allocation[1].netRevenue, 40);
assert.equal(allocation[1].quantity, 0.5);

const duplicateLinesSale = {
  id: 'sale-2',
  status: 'concluida',
  created_date: '2026-09-29T09:15:00-03:00',
  subtotal: 20,
  total: 18,
  items: [
    { product_id: 'product-a', unit: 'unidade', quantity: 1, subtotal: 10 },
    { product_id: 'product-a', unit: 'unidade', quantity: 1, subtotal: 10 },
  ],
};
const cancelledSale = {
  ...duplicateLinesSale,
  id: 'sale-3',
  status: 'cancelada',
  total: 999,
};
const report = buildProductReport(
  [discountedSale, duplicateLinesSale, cancelledSale],
  'product-a',
);

assert.equal(report.saleCount, 2, 'Linhas repetidas não podem inflar o número de vendas.');
assert.equal(report.totalQuantity, 3, 'A quantidade deve somar as unidades reais vendidas.');
assert.equal(report.totalRevenue, 98, 'O faturamento deve considerar o desconto rateado.');
assert.equal(
  report.monthRows.reduce((sum, row) => sum + row.revenue, 0),
  report.totalRevenue,
  'Os recortes mensais devem reconciliar com o total do produto.',
);
assert.equal(
  report.dayRows.reduce((sum, row) => sum + row.revenue, 0),
  report.totalRevenue,
  'O recorte diário deve reconciliar com o total do produto.',
);
assert.equal(
  report.hourRows.reduce((sum, row) => sum + row.saleCount, 0),
  report.saleCount,
  'Cada venda deve aparecer uma única vez no recorte por hora.',
);

assert.deepEqual(
  getSalePaymentAllocations({
    total: 90,
    change_amount: 10,
    payments: [{ method: 'dinheiro', amount: 90 }],
  }),
  [{ method: 'dinheiro', amount: 90 }],
  'Pagamentos atuais já são líquidos e não devem perder o troco duas vezes.',
);
assert.deepEqual(
  getSalePaymentAllocations({
    total: 90,
    change_amount: 10,
    payments: [{ method: 'dinheiro', amount: 100 }],
  }),
  [{ method: 'dinheiro', amount: 90 }],
  'Pagamentos antigos com valor recebido devem remover apenas o excedente.',
);

console.log('Teste de integridade dos cálculos de relatórios aprovado.');
