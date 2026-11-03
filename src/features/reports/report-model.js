import {
  allocateSaleItems,
  getSaleGrossTotal,
  getSaleItemQuantity,
  getSaleNetTotal,
  getSalePaymentAllocations,
} from '../../lib/report-metrics.js';
import { getPaymentLabel } from '../../lib/helpers.js';

export function getReportPeriod(period, customStart, customEnd, now = new Date()) {
  let start;
  let end;
  let prevStart;
  let prevEnd;
  if (period === 'today') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
    prevStart = new Date(now);
    prevStart.setDate(prevStart.getDate() - 1);
    prevStart.setHours(0, 0, 0, 0);
    prevEnd = new Date(now);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
  } else if (period === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
    prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    prevEnd = new Date(start);
    prevEnd.setMilliseconds(-1);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    prevStart = new Date(now.getFullYear() - 1, 0, 1);
    prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
  } else if (customStart && customEnd) {
    start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(0);
    end = customEnd ? new Date(`${customEnd}T23:59:59`) : new Date();
    const difference = Math.max(1, end.getTime() - start.getTime());
    prevStart = new Date(start.getTime() - difference);
    prevEnd = new Date(start.getTime() - 1);
  } else {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
    prevStart = new Date(now);
    prevStart.setDate(prevStart.getDate() - 1);
    prevStart.setHours(0, 0, 0, 0);
    prevEnd = new Date(now);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
  }
  return {
    startDate: start,
    endDate: end,
    prevStartDate: prevStart,
    prevEndDate: prevEnd,
  };
}

/**
 * Build the same financial and ranking values consumed by the report view.
 * All working collections are local; input records remain unchanged.
 * @param {any} options
 */
export function buildReportSummary({
  periodSales,
  prevPeriodSales,
  sales,
  fiados,
  products,
  startDate,
  endDate,
  period,
  breakdown,
  cancelledCount,
}) {
  const totalRevenue = periodSales.reduce(
    (sum, sale) => sum + getSaleNetTotal(sale),
    0,
  );
  const grossRevenue = periodSales.reduce(
    (sum, sale) => sum + getSaleGrossTotal(sale),
    0,
  );
  const totalDiscount = Math.max(0, grossRevenue - totalRevenue);
  const prevRevenue = prevPeriodSales.reduce(
    (sum, sale) => sum + getSaleNetTotal(sale),
    0,
  );
  const revenueChange =
    prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const totalSales = periodSales.length;
  const avgTicket = totalSales ? totalRevenue / totalSales : 0;
  const totalItems = periodSales.reduce(
    (sum, sale) =>
      sum +
      (sale.items || []).reduce(
        (itemSum, item) =>
          itemSum +
          getSaleItemQuantity(item),
        0,
      ),
    0,
  );
  const itemsPerSale = totalSales ? totalItems / totalSales : 0;
  const cancelled = cancelledCount ?? sales.filter(
    (sale) =>
      sale.status === 'cancelada' &&
      new Date(sale.created_date) >= startDate &&
      new Date(sale.created_date) <= endDate,
  ).length;

  const productMap = {};
  const categoryMap = {};
  const productLookup = new Map(
    products.map((product) => [String(product.id), product]),
  );
  const normalizeCategory = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return 'Sem categoria';
    if (text.toLowerCase() === 'sem categoria') return 'Sem categoria';
    return text;
  };
  const resolveCategory = (item) => {
    const product = productLookup.get(String(item.product_id));
    return normalizeCategory(
      item.category ||
        item.product_category ||
        item.category_name ||
        item.product?.category ||
        item.product?.category_name ||
        item.product?.product_category ||
        product?.category ||
        product?.category_name ||
        product?.product_category,
    );
  };
  for (const sale of periodSales) {
    const productsInSale = new Map();
    for (const allocation of allocateSaleItems(sale)) {
      const { item, quantity, netRevenue } = allocation;
      const productName = item.product_name || 'Produto sem nome';
      const productKey = String(item.product_id || `name:${productName}`);
      const productData = productsInSale.get(productKey) || {
        name: productName,
        qty: 0,
        revenue: 0,
      };
      productData.qty += quantity;
      productData.revenue += netRevenue;
      productsInSale.set(productKey, productData);

      const category = resolveCategory(item);
      if (!categoryMap[category]) categoryMap[category] = { qty: 0, revenue: 0 };
      categoryMap[category].qty += quantity;
      categoryMap[category].revenue += netRevenue;
    }
    for (const [productKey, productData] of productsInSale) {
      if (!productMap[productKey]) {
        productMap[productKey] = { ...productData, sales: 0 };
      } else {
        productMap[productKey].qty += productData.qty;
        productMap[productKey].revenue += productData.revenue;
      }
      productMap[productKey].sales += 1;
    }
  }

  const paymentMap = {};
  for (const sale of periodSales) {
    for (const payment of getSalePaymentAllocations(sale)) {
      const rawAmount = Math.max(0, Number(payment.amount || 0));
      paymentMap[payment.method] =
        Number(paymentMap[payment.method] || 0) + rawAmount;
    }
  }
  const paymentData = Object.entries(paymentMap)
    .map(([method, value]) => ({
      method,
      name: getPaymentLabel(method),
      value,
      percentage: totalRevenue > 0 ? (value / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const sellerMap = {};
  for (const sale of periodSales) {
    const seller = sale.seller_name || 'Sem identificacao';
    if (!sellerMap[seller])
      sellerMap[seller] = { count: 0, revenue: 0, items: 0 };
    sellerMap[seller].count += 1;
    sellerMap[seller].revenue += getSaleNetTotal(sale);
    sellerMap[seller].items += (sale.items || []).reduce(
      (sum, item) =>
        sum +
        getSaleItemQuantity(item),
      0,
    );
  }
  const sellerData = Object.entries(sellerMap)
    .map(([name, data]) => [
      name,
      {
        ...data,
        average: data.count ? data.revenue / data.count : 0,
        share: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      },
    ])
    .sort((a, b) => b[1].revenue - a[1].revenue);

  const periodFiados = fiados.filter(
    (fiado) =>
      new Date(fiado.created_date) >= startDate &&
      new Date(fiado.created_date) <= endDate,
  );
  const pendingFiado = periodFiados
    .filter((fiado) => fiado.status === 'pendente')
    .reduce((sum, fiado) => sum + Number(fiado.total_amount || 0), 0);

  const dailyMap = {};
  for (const sale of periodSales) {
    const date = new Date(sale.created_date);
    const key =
      period === 'year'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const label =
      period === 'year'
        ? date.toLocaleDateString('pt-BR', { month: 'short' })
        : date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          });
    if (!dailyMap[key]) dailyMap[key] = { date: label, value: 0 };
    dailyMap[key].value += getSaleNetTotal(sale);
  }
  const dailyData = Object.entries(dailyMap)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, value]) => value);

  const breakdownMap = {};
  const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  for (const sale of periodSales) {
    const date = new Date(sale.created_date);
    let key;
    let label;
    if (breakdown === 'hour') {
      key = date.getHours();
      label = `${key}h`;
    } else if (breakdown === 'weekday') {
      key = date.getDay();
      label = weekdayNames[key];
    } else if (breakdown === 'month') {
      key = date.getMonth();
      label = date
        .toLocaleDateString('pt-BR', { month: 'short' })
        .replace('.', '');
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      label = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });
    }
    if (!breakdownMap[key])
      breakdownMap[key] = { key, label, revenue: 0, sales: 0 };
    breakdownMap[key].revenue += getSaleNetTotal(sale);
    breakdownMap[key].sales += 1;
  }
  const breakdownData = Object.values(breakdownMap)
    .sort((first, second) =>
      String(first.key).localeCompare(String(second.key), 'pt-BR', {
        numeric: true,
      }),
    )
    .map((item) => ({
      ...item,
      average: item.sales ? item.revenue / item.sales : 0,
    }));
  const bestBreakdown = [...breakdownData].sort(
    (first, second) => second.revenue - first.revenue,
  )[0];
  const bestDay = [...dailyData].sort(
    (first, second) => second.value - first.value,
  )[0];

  return {
    totalRevenue,
    grossRevenue,
    totalDiscount,
    revenueChange,
    totalSales,
    avgTicket,
    totalItems,
    itemsPerSale,
    cancelled,
    productMap,
    categoryMap,
    paymentData,
    sellerData,
    pendingFiado,
    dailyData,
    breakdownData,
    bestBreakdown,
    bestDay,
  };
}

/**
 * Keep input order and the existing inclusive date boundaries. Parse each
 * relevant sale date once for both periods and the cancellation count.
 * @param {any[]} sales
 * @param {any} range
 * @param {boolean} enabled
 */
export function partitionReportSales(sales, range, enabled = true) {
  const periodSales = [];
  const prevPeriodSales = [];
  let cancelledCount = 0;
  const start = range.startDate.getTime();
  const end = range.endDate.getTime();
  const previousStart = range.prevStartDate.getTime();
  const previousEnd = range.prevEndDate.getTime();
  for (const sale of sales) {
    if (sale.status !== 'concluida' && sale.status !== 'cancelada') continue;
    const timestamp = new Date(sale.created_date).getTime();
    const inPeriod = timestamp >= start && timestamp <= end;
    if (sale.status === 'cancelada') {
      if (inPeriod) cancelledCount++;
      continue;
    }
    if (!enabled) continue;
    if (inPeriod) periodSales.push(sale);
    if (timestamp >= previousStart && timestamp <= previousEnd) prevPeriodSales.push(sale);
  }
  return { periodSales, prevPeriodSales, cancelledCount };
}
