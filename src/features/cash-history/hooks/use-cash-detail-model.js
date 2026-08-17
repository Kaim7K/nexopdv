import { useMemo } from 'react';

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function calculateAmounts(session, summary) {
  const openingAmount = Number(summary.opening_amount ?? session.opening_amount ?? 0);
  const closingExpense = Number(session.closing_expense ?? summary.closing_expense ?? 0);
  const closingEntry = Number(session.closing_entry ?? summary.closing_entry ?? 0);
  const storedClosing =
    summary.expected_cash_before_expense !== undefined ||
    summary.closing_entry !== undefined ||
    summary.closing_expense !== undefined;
  const expectedBeforeExpense = Number(
    summary.expected_cash_before_expense ??
      (storedClosing
        ? Number(summary.expected_cash || 0) -
          Number(summary.closing_entry || 0) +
          Number(summary.closing_expense || 0)
        : Number(summary.expected_cash || 0)),
  );
  const expectedAfterExpense = roundMoney(
    expectedBeforeExpense + closingEntry - closingExpense,
  );
  const declaredCash = Number(session.closing_amount ?? expectedAfterExpense);

  return {
    openingAmount,
    totalSales: Number(summary.total || 0),
    cashReceived: Number(summary.payments?.dinheiro ?? summary.cash_sales ?? 0),
    movementEntries: Number(summary.entries || 0),
    movementWithdrawals: Number(summary.withdrawals || 0),
    closingExpense,
    closingEntry,
    expectedBeforeExpense,
    expectedAfterExpense,
    declaredCash,
    valueWithoutCashDrawer: roundMoney(declaredCash - openingAmount + closingEntry),
    cashDifference: declaredCash - expectedAfterExpense,
  };
}

function normalizeMovement(item, session) {
  const originTitles = {
    compra: `Compra #${item.purchase_number || 'sem número'}`,
    fiado: `Recebimento do fiado #${item.sale_number || 'sem número'}`,
  };
  return {
    id: item.id,
    type: item.type,
    amount: Number(item.amount || 0),
    title:
      originTitles[item.origin] ||
      item.note ||
      (item.type === 'entrada' ? 'Entrada no caixa' : 'Retirada do caixa'),
    note: item.note || 'Sem observação',
    origin: item.origin || 'manual',
    operator: item.operator_name || session.seller_name || 'Não informado',
    date: item.created_at || item.created_date,
    status: item.status || 'ativo',
  };
}

function closingMovements(session, { closingEntry, closingExpense }) {
  const common = {
    origin: 'fechamento',
    operator: session.seller_name || 'Não informado',
    date: session.closed_at || session.updated_date,
    status: 'ativo',
  };
  return [
    closingEntry > 0 && {
      ...common,
      id: 'closing-entry',
      type: 'entrada',
      amount: closingEntry,
      title: 'Dinheiro adicionado no fechamento',
      note: 'Ajuste informado ao encerrar o caixa',
    },
    closingExpense > 0 && {
      ...common,
      id: 'closing-expense',
      type: 'retirada',
      amount: closingExpense,
      title: 'Despesa do fechamento',
      note: 'Vinculada automaticamente ao Financeiro',
    },
  ].filter(Boolean);
}

function differencePresentation(cashDifference) {
  const hasDifference = Math.abs(cashDifference) >= 0.005;
  if (!hasDifference) {
    return {
      hasDifference,
      differenceLabel: 'Caixa conferido',
      differenceTone: 'text-emerald-700 dark:text-emerald-300',
      differenceSummary: 'Dinheiro contado bate com o esperado.',
    };
  }
  return {
    hasDifference,
    differenceLabel: cashDifference > 0 ? 'Sobra no caixa' : 'Falta no caixa',
    differenceTone: 'text-red-600 dark:text-red-300',
    differenceSummary: 'Revise recebimentos em dinheiro, despesas e contagem final.',
  };
}

export function useCashDetailModel({
  session,
  summary,
  currentUser,
  salePaymentFilter,
}) {
  return useMemo(() => {
    const amounts = calculateAmounts(session, summary);
    const linkedSales = (summary.sales || []).filter(
      (sale) =>
        !salePaymentFilter ||
        (sale.payments || []).some(
          (payment) => payment.method === salePaymentFilter,
        ),
    );
    const cashMovements = [
      ...(summary.movements || []).map((item) => normalizeMovement(item, session)),
      ...closingMovements(session, amounts),
    ].sort(
      (left, right) =>
        new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime(),
    );

    return {
      canMove: session.status === 'aberto' && session.seller_id === currentUser.id,
      canDelete: currentUser.role === 'admin' && session.status === 'fechado',
      canManageClosed:
        currentUser.role === 'admin' && session.status === 'fechado',
      paymentEntries: Object.entries(summary.payments || {}).filter(
        ([, amount]) => Math.abs(Number(amount || 0)) >= 0.005,
      ),
      linkedSales,
      cashMovements,
      ...amounts,
      ...differencePresentation(amounts.cashDifference),
    };
  }, [currentUser.id, currentUser.role, salePaymentFilter, session, summary]);
}
