export const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function summarizeSales(sales = []) {
  const completed = sales.filter((sale) => sale.status === 'concluida');
  const cancelled = sales.filter((sale) => sale.status === 'cancelada');
  const payments = {};
  let total = 0;
  let discounts = 0;
  let items = 0;

  for (const sale of completed) {
    const saleTotal = Number(sale.total || 0);
    total += saleTotal;
    discounts += Math.max(0, Number(sale.subtotal || saleTotal) - saleTotal);
    items += Array.isArray(sale.items)
      ? sale.items.reduce(
          (sum, item) =>
            sum +
            Number(
              item.unit === 'peso' ? item.weight || 0 : item.quantity || 0,
            ),
          0,
        )
      : 0;

    let remainingChange = roundMoney(Number(sale.change_amount || 0));
    for (const payment of sale.payments || []) {
      if (!payment?.method) continue;
      const paidAmount = roundMoney(Number(payment.amount || 0));
      const changeFromPayment =
        payment.method === 'dinheiro' && remainingChange > 0
          ? Math.min(paidAmount, remainingChange)
          : 0;
      const receivedAmount = roundMoney(paidAmount - changeFromPayment);
      remainingChange = roundMoney(remainingChange - changeFromPayment);
      payments[payment.method] = roundMoney(
        Number(payments[payment.method] || 0) + receivedAmount,
      );
    }
  }

  return {
    total: roundMoney(total),
    discounts: roundMoney(discounts),
    sales_count: completed.length,
    cancelled_count: cancelled.length,
    average_ticket: completed.length ? roundMoney(total / completed.length) : 0,
    items_count: roundMoney(items),
    payments,
  };
}

export function buildCashSessionSummary(session, sales = [], movements = []) {
  const activeMovements = movements.filter(
    (movement) => !['cancelado', 'estornado'].includes(movement.status),
  );
  const entries = roundMoney(
    activeMovements
      .filter((movement) => movement.type === 'entrada')
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0),
  );
  const withdrawals = roundMoney(
    activeMovements
      .filter((movement) => movement.type === 'retirada')
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0),
  );
  const salesSummary = summarizeSales(sales);
  const openingAmount = roundMoney(Number(session.opening_amount || 0));
  const cashSales = roundMoney(Number(salesSummary.payments.dinheiro || 0));
  const expectedBeforeClosing = roundMoney(
    openingAmount + cashSales + entries - withdrawals,
  );
  const closingEntry = roundMoney(Number(session.closing_entry || 0));
  const closingExpense = roundMoney(Number(session.closing_expense || 0));
  const includeClosingAdjustments = session.status === 'fechado';

  return {
    ...salesSummary,
    opening_amount: openingAmount,
    cash_sales: cashSales,
    entries,
    withdrawals,
    closing_entry: includeClosingAdjustments ? closingEntry : 0,
    closing_expense: includeClosingAdjustments ? closingExpense : 0,
    expected_cash_before_expense: expectedBeforeClosing,
    expected_cash: roundMoney(
      expectedBeforeClosing +
        (includeClosingAdjustments ? closingEntry - closingExpense : 0),
    ),
    opened_at: session.opened_at || session.created_date,
    sales,
    movements,
    filters: {
      from: new Date(session.opened_at || session.created_date).toISOString(),
      to: new Date().toISOString(),
      seller_id: session.seller_id || null,
      payment: null,
    },
  };
}
