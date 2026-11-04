// Reject incomplete responses before rendering; never replace missing data with zeros.
export function validateOverviewResponse(data) {
  const invalid = () => { throw new Error('O resumo da loja veio incompleto. Tente atualizar novamente.'); };
  if (!data || typeof data !== 'object' || !Array.isArray(data.modules)) invalid();
  for (const key of ['fiados', 'payables']) {
    if (data[key] != null && !Array.isArray(data[key].items)) invalid();
  }
  for (const insight of [data.products?.low, data.products?.idle, data.products?.margin, data.margin_declines]) {
    if (insight != null && !Array.isArray(insight.products)) invalid();
  }
  return data;
}
