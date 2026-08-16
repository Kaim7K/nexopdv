import assert from 'node:assert/strict';
import {
  buildCashSessionSummary,
  getSalePaymentAllocations,
  normalizePaymentsForSale,
  roundMoney,
  summarizeSales,
} from '../server/cash-summary.js';

assert.equal(roundMoney(0.1 + 0.2), 0.3, 'Centavos devem ser arredondados com estabilidade.');

const splitPayment = normalizePaymentsForSale(
  [
    { method: 'dinheiro', amount: 40 },
    { method: 'pix', amount: 30 },
    { method: 'credito', amount: 30 },
  ],
  100,
);
assert.deepEqual(splitPayment.payments, [
  { method: 'dinheiro', amount: 40 },
  { method: 'pix', amount: 30 },
  { method: 'credito', amount: 30 },
]);
assert.equal(
  splitPayment.payments.reduce((sum, payment) => sum + payment.amount, 0),
  100,
  'Pagamento dividido deve conciliar exatamente com o total.',
);

const duplicateMethods = normalizePaymentsForSale(
  [
    { method: 'pix', amount: 10 },
    { method: 'pix', amount: 20 },
    { method: 'dinheiro', amount: 70 },
  ],
  100,
);
assert.deepEqual(duplicateMethods.payments, [
  { method: 'pix', amount: 30 },
  { method: 'dinheiro', amount: 70 },
]);

const cashWithChange = normalizePaymentsForSale(
  [{ method: 'dinheiro', amount: 120 }],
  100,
);
assert.deepEqual(cashWithChange.payments, [{ method: 'dinheiro', amount: 100 }]);
assert.equal(cashWithChange.tenderedAmount, 120);
assert.equal(cashWithChange.changeAmount, 20);
assert.throws(
  () => normalizePaymentsForSale([{ method: 'pix', amount: 120 }], 100),
  /Somente pagamentos em dinheiro podem gerar troco/,
);

const partialFiado = normalizePaymentsForSale(
  [
    { method: 'dinheiro', amount: 40 },
    { method: 'fiado', amount: 60 },
  ],
  100,
  { isFiado: true },
);
assert.deepEqual(partialFiado.payments, [
  { method: 'dinheiro', amount: 40 },
  { method: 'fiado', amount: 60 },
]);
assert.equal(partialFiado.paidAmount, 40);
assert.equal(partialFiado.outstandingAmount, 60);

assert.deepEqual(
  getSalePaymentAllocations({
    total: 100,
    change_amount: 20,
    payments: [{ method: 'dinheiro', amount: 120 }],
  }),
  [{ method: 'dinheiro', amount: 100 }],
  'Vendas legadas com troco devem ser conciliadas sem desconto duplicado.',
);

const sales = [
  {
    status: 'concluida',
    subtotal: 20,
    total: 18,
    change_amount: 2,
    items: [{ unit: 'unidade', quantity: 2 }],
    payments: [{ method: 'dinheiro', amount: 20 }],
  },
  {
    status: 'cancelada',
    subtotal: 100,
    total: 100,
    payments: [{ method: 'dinheiro', amount: 100 }],
  },
  {
    status: 'concluida',
    subtotal: 0.2,
    total: 0.2,
    items: [{ unit: 'peso', weight: 0.1 }],
    payments: [{ method: 'pix', amount: 0.2 }],
  },
];

const salesSummary = summarizeSales(sales);
assert.deepEqual(
  salesSummary,
  {
    total: 18.2,
    discounts: 2,
    sales_count: 2,
    cancelled_count: 1,
    average_ticket: 9.1,
    items_count: 2.1,
    payments: { dinheiro: 18, pix: 0.2 },
  },
  'O resumo deve excluir cancelamentos e descontar o troco do dinheiro recebido.',
);

const session = {
  id: 'cash-1',
  status: 'fechado',
  opening_amount: 50,
  closing_entry: 3,
  closing_expense: 2,
  opened_at: '2026-08-03T09:00:00.000Z',
};
const movements = [
  { type: 'entrada', amount: 10, status: 'ativo' },
  { type: 'retirada', amount: 4, status: 'ativo' },
  { type: 'entrada', amount: 999, status: 'estornado' },
];
const cashSummary = buildCashSessionSummary(session, sales, movements);

assert.equal(cashSummary.opening_amount, 50);
assert.equal(cashSummary.cash_sales, 18);
assert.equal(cashSummary.entries, 10);
assert.equal(cashSummary.withdrawals, 4);
assert.equal(cashSummary.expected_cash_before_expense, 74);
assert.equal(cashSummary.expected_cash, 75);
assert.equal(cashSummary.closing_entry, 3);
assert.equal(cashSummary.closing_expense, 2);

const openSummary = buildCashSessionSummary(
  { ...session, status: 'aberto' },
  sales,
  movements,
);
assert.equal(openSummary.expected_cash, 74, 'Ajustes de fechamento não entram em caixa ainda aberto.');
assert.equal(openSummary.closing_entry, 0);
assert.equal(openSummary.closing_expense, 0);

console.log('Testes de resumo financeiro e caixa aprovados.');
