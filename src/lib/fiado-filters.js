function containsQuery(item, query) {
  const normalized = String(query).trim().toLowerCase();
  if (!normalized) return true;
  return [item.responsible_name, item.phone, item.sale_number].some((value) =>
    String(value || '').toLowerCase().includes(normalized),
  );
}

function isWithinSettlementPeriod(item, settledFrom, settledTo) {
  // O período pertence ao histórico de quitações. Uma dívida pendente não
  // deixa de ser relevante porque a venda aconteceu fora do período escolhido.
  if (item.status !== 'quitado' || (!settledFrom && !settledTo)) return true;
  const settlementDate = String(item.settlement_date || '').slice(0, 10);
  if (!settlementDate) return false;
  return (
    (!settledFrom || settlementDate >= settledFrom) &&
    (!settledTo || settlementDate <= settledTo)
  );
}

export function matchesFiadoFilters(
  item,
  { query = '', status = '', settledFrom = '', settledTo = '' } = {},
) {
  if (status && item.status !== status) return false;
  if (!containsQuery(item, query)) return false;
  return isWithinSettlementPeriod(item, settledFrom, settledTo);
}
