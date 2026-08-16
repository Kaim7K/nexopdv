const CANCELLED_MOVEMENT_STATUSES = new Set(['cancelado', 'estornado']);

const toCents = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) : 0;
};

const fromCents = (value) => value / 100;

export const roundMoney = (value) => fromCents(toCents(value));

function mergePayments(payments = []) {
  const amounts = new Map();
  for (const payment of payments) {
    const method = String(payment?.method || '').trim();
    const amount = Number(payment?.amount);
    if (!method || !Number.isFinite(amount) || amount < 0) {
      throw Object.assign(new Error('Há pagamentos inválidos na venda.'), {
        code: 'INVALID_PAYMENT',
      });
    }
    const cents = toCents(amount);
    if (cents <= 0) continue;
    amounts.set(method, (amounts.get(method) || 0) + cents);
  }
  return amounts;
}

/**
 * Produces the canonical payment allocation persisted on a sale. Payment
 * amounts are net allocations and therefore always add up to the sale total.
 * Cash tendered by the customer and change remain separate metadata.
 */
export function normalizePaymentsForSale(payments, total, { isFiado = false } = {}) {
  const totalCents = toCents(total);
  const amounts = mergePayments(payments);
  const fiadoCents = amounts.get('fiado') || 0;
  amounts.delete('fiado');
  const tenderedCents = [...amounts.values()].reduce((sum, value) => sum + value, 0);
  const cashTenderedCents = amounts.get('dinheiro') || 0;

  if (isFiado) {
    if (!fiadoCents) {
      throw Object.assign(new Error('A forma de pagamento fiado não está configurada corretamente.'), {
        code: 'INVALID_FIADO_PAYMENT',
      });
    }
    if (tenderedCents >= totalCents) {
      throw Object.assign(new Error('Não há saldo pendente para registrar como fiado.'), {
        code: 'FIADO_WITHOUT_BALANCE',
      });
    }
    amounts.set('fiado', totalCents - tenderedCents);
  } else {
    if (fiadoCents) {
      throw Object.assign(new Error('Pagamento fiado informado em uma venda normal.'), {
        code: 'UNEXPECTED_FIADO_PAYMENT',
      });
    }
    if (tenderedCents < totalCents) {
      throw Object.assign(new Error('O pagamento é menor que o total da venda.'), {
        code: 'INCOMPLETE_PAYMENT',
      });
    }
    const changeCents = tenderedCents - totalCents;
    if (changeCents > cashTenderedCents) {
      throw Object.assign(new Error('Somente pagamentos em dinheiro podem gerar troco.'), {
        code: 'NON_CASH_CHANGE',
      });
    }
    if (changeCents) amounts.set('dinheiro', cashTenderedCents - changeCents);
  }

  const normalized = [...amounts.entries()]
    .filter(([, cents]) => cents > 0)
    .map(([method, cents]) => ({ method, amount: fromCents(cents) }));
  const allocatedCents = normalized.reduce(
    (sum, payment) => sum + toCents(payment.amount),
    0,
  );
  if (allocatedCents !== totalCents) {
    throw Object.assign(new Error('A soma dos pagamentos diverge do total da venda.'), {
      code: 'PAYMENT_TOTAL_MISMATCH',
    });
  }

  const changeCents = isFiado ? 0 : Math.max(0, tenderedCents - totalCents);
  const outstandingCents = isFiado ? totalCents - tenderedCents : 0;
  return {
    payments: normalized,
    paidAmount: fromCents(totalCents - outstandingCents),
    tenderedAmount: fromCents(tenderedCents),
    cashTenderedAmount: fromCents(cashTenderedCents),
    changeAmount: fromCents(changeCents),
    outstandingAmount: fromCents(outstandingCents),
  };
}

/** Returns net allocations for both canonical and legacy (gross-cash) sales. */
export function getSalePaymentAllocations(sale = {}) {
  const payments = Array.isArray(sale.payments) && sale.payments.length
    ? sale.payments
    : sale.payment_method
      ? [{ method: sale.payment_method, amount: sale.total }]
      : [];
  try {
    return normalizePaymentsForSale(payments, sale.total, {
      isFiado: sale.sale_type === 'fiado' || payments.some((item) => item?.method === 'fiado'),
    }).payments;
  } catch {
    // Old records may not satisfy today's validation. Preserve their methods,
    // but remove explicitly recorded cash change exactly once.
    const amounts = new Map();
    for (const payment of payments) {
      const method = String(payment?.method || '').trim();
      if (!method) continue;
      amounts.set(method, (amounts.get(method) || 0) + toCents(payment.amount));
    }
    const changeCents = Math.min(
      amounts.get('dinheiro') || 0,
      Math.max(0, toCents(sale.change_amount)),
    );
    if (changeCents) amounts.set('dinheiro', amounts.get('dinheiro') - changeCents);
    return [...amounts.entries()]
      .filter(([, cents]) => cents > 0)
      .map(([method, cents]) => ({ method, amount: fromCents(cents) }));
  }
}

export function summarizeSales(sales = []) {
  const completed = sales.filter((sale) => sale.status === 'concluida');
  const cancelled = sales.filter((sale) => sale.status === 'cancelada');
  const paymentCents = new Map();
  let totalCents = 0;
  let discountCents = 0;
  let items = 0;

  for (const sale of completed) {
    const saleTotalCents = toCents(sale.total);
    totalCents += saleTotalCents;
    discountCents += Math.max(0, toCents(sale.subtotal ?? sale.total) - saleTotalCents);
    items += Array.isArray(sale.items)
      ? sale.items.reduce(
          (sum, item) =>
            sum + Number(item.unit === 'peso' ? item.weight || 0 : item.quantity || 0),
          0,
        )
      : 0;

    for (const payment of getSalePaymentAllocations(sale)) {
      paymentCents.set(
        payment.method,
        (paymentCents.get(payment.method) || 0) + toCents(payment.amount),
      );
    }
  }

  return {
    total: fromCents(totalCents),
    discounts: fromCents(discountCents),
    sales_count: completed.length,
    cancelled_count: cancelled.length,
    average_ticket: completed.length ? fromCents(Math.round(totalCents / completed.length)) : 0,
    items_count: roundMoney(items),
    payments: Object.fromEntries(
      [...paymentCents.entries()].map(([method, cents]) => [method, fromCents(cents)]),
    ),
  };
}

export function buildCashSessionSummary(session, sales = [], movements = []) {
  const activeMovements = movements.filter(
    (movement) => !CANCELLED_MOVEMENT_STATUSES.has(movement.status),
  );
  const entriesCents = activeMovements
    .filter((movement) => movement.type === 'entrada')
    .reduce((sum, movement) => sum + toCents(movement.amount), 0);
  const withdrawalCents = activeMovements
    .filter((movement) => movement.type === 'retirada')
    .reduce((sum, movement) => sum + toCents(movement.amount), 0);
  const salesSummary = summarizeSales(sales);
  const openingCents = toCents(session.opening_amount);
  const cashSalesCents = toCents(salesSummary.payments.dinheiro);
  const expectedBeforeClosingCents =
    openingCents + cashSalesCents + entriesCents - withdrawalCents;
  const closingEntryCents = toCents(session.closing_entry);
  const closingExpenseCents = toCents(session.closing_expense);
  const includeClosingAdjustments = session.status === 'fechado';
  const expectedCents = expectedBeforeClosingCents +
    (includeClosingAdjustments ? closingEntryCents - closingExpenseCents : 0);

  return {
    ...salesSummary,
    opening_amount: fromCents(openingCents),
    cash_sales: fromCents(cashSalesCents),
    entries: fromCents(entriesCents),
    withdrawals: fromCents(withdrawalCents),
    closing_entry: includeClosingAdjustments ? fromCents(closingEntryCents) : 0,
    closing_expense: includeClosingAdjustments ? fromCents(closingExpenseCents) : 0,
    expected_cash_before_expense: fromCents(expectedBeforeClosingCents),
    expected_cash: fromCents(expectedCents),
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
