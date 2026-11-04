/** Keep the existing parallel requests, sorting and limits together. */
export async function loadReportData(api) {
  const [sales, fiados, products] = await Promise.all([
    api.entities.Sale.list('-created_date', 5000),
    api.entities.FiadoRecord.list('-created_date', 500),
    api.products.catalog(2000),
  ]);
  return { sales, fiados, products };
}
