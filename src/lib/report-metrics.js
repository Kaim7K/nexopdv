const toCents = (value) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100))
    : 0;
};

const fromCents = (value) => value / 100;

export function getSaleItemQuantity(item = {}) {
  const value = Number(item.unit === 'peso' ? item.weight : item.quantity);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function getSaleItemGross(item = {}) {
  const stored = Number(item.subtotal ?? item.total ?? item.total_price);
  if (Number.isFinite(stored) && stored >= 0) return fromCents(toCents(stored));

  const price = Number(item.unit_price ?? item.price);
  if (!Number.isFinite(price) || price < 0) return 0;
  return fromCents(toCents(price * getSaleItemQuantity(item)));
}

export function getSaleGrossTotal(sale = {}) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  if (items.length) {
    return fromCents(
      items.reduce((sum, item) => sum + toCents(getSaleItemGross(item)), 0),
    );
  }

  return fromCents(toCents(sale.subtotal ?? sale.total));
}

export function getSaleNetTotal(sale = {}) {
  const stored = Number(sale.total);
  if (Number.isFinite(stored) && stored >= 0) return fromCents(toCents(stored));

  const grossCents = toCents(getSaleGrossTotal(sale));
  const rawDiscount = Math.max(0, Number(sale.discount_value) || 0);
  const discountCents =
    sale.discount_type === 'percentual'
      ? toCents(fromCents(grossCents) * (Math.min(rawDiscount, 100) / 100))
      : Math.min(toCents(rawDiscount), grossCents);
  return fromCents(Math.max(0, grossCents - discountCents));
}

/**
 * Allocates the persisted sale total across item lines in cents. This keeps
 * product and category revenue reconciled with the real net sale total after
 * discounts, including weighted products and duplicate product lines.
 */
export function allocateSaleItems(sale = {}) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const rows = items.map((item, index) => ({
    index,
    item,
    quantity: getSaleItemQuantity(item),
    grossCents: toCents(getSaleItemGross(item)),
    netCents: 0,
    fraction: 0,
  }));
  const grossCents = rows.reduce((sum, row) => sum + row.grossCents, 0);
  const netCents = toCents(getSaleNetTotal(sale));

  if (grossCents > 0 && netCents > 0) {
    let allocatedCents = 0;
    for (const row of rows) {
      const exactShare = (row.grossCents * netCents) / grossCents;
      row.netCents = Math.floor(exactShare);
      row.fraction = exactShare - row.netCents;
      allocatedCents += row.netCents;
    }

    const remainder = netCents - allocatedCents;
    const remainderOrder = [...rows].sort(
      (first, second) =>
        second.fraction - first.fraction || first.index - second.index,
    );
    for (let index = 0; index < remainder; index += 1) {
      remainderOrder[index % remainderOrder.length].netCents += 1;
    }
  }

  return rows.map(({ item, quantity, grossCents: itemGross, netCents: itemNet }) => ({
    item,
    quantity,
    grossRevenue: fromCents(itemGross),
    netRevenue: fromCents(itemNet),
  }));
}

export function getSalePaymentAllocations(sale = {}) {
  const source = Array.isArray(sale.payments) && sale.payments.length
    ? sale.payments
    : sale.payment_method
      ? [{ method: sale.payment_method, amount: getSaleNetTotal(sale) }]
      : [];
  const amounts = new Map();
  for (const payment of source) {
    const method = String(payment?.method || '').trim();
    const cents = toCents(payment?.amount);
    if (!method || cents <= 0) continue;
    amounts.set(method, (amounts.get(method) || 0) + cents);
  }

  const totalCents = toCents(getSaleNetTotal(sale));
  const allocatedCents = [...amounts.values()].reduce(
    (sum, cents) => sum + cents,
    0,
  );
  const overpaymentCents = Math.max(0, allocatedCents - totalCents);
  const cashCents = amounts.get('dinheiro') || 0;
  if (overpaymentCents && cashCents) {
    amounts.set('dinheiro', cashCents - Math.min(cashCents, overpaymentCents));
  }

  return [...amounts.entries()]
    .filter(([, cents]) => cents > 0)
    .map(([method, cents]) => ({ method, amount: fromCents(cents) }));
}

const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

const toValidDate = (value, endOfDay = false) => {
  if (!value) return null;
  const date = value instanceof Date
    ? new Date(value)
    : new Date(
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`
        : value,
    );
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const monthKey = (date) => dateKey(date).slice(0, 7);

const eachCalendarDay = (startDate, endDate, callback) => {
  if (!startDate || !endDate || startDate > endDate) return 0;
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const finalDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  let count = 0;
  while (cursor <= finalDay) {
    callback(new Date(cursor));
    count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

export function buildProductReport(sales = [], productId, options = {}) {
  const selectedStart = toValidDate(options.startDate);
  const selectedEnd = toValidDate(options.endDate, true);
  const monthMap = new Map();
  const dayMap = new Map();
  const weekdayMap = new Map();
  const hourMap = new Map();
  const occurrences = [];
  const saleIds = new Set();

  const addBucketValue = (map, key, label, occurrence) => {
    const current = map.get(key) || {
      key,
      label,
      quantity: 0,
      revenue: 0,
      saleCount: 0,
    };
    current.quantity += occurrence.quantity;
    current.revenue += occurrence.revenue;
    current.saleCount += 1;
    map.set(key, current);
  };

  for (const sale of sales) {
    if (sale.status !== 'concluida') continue;
    const soldItems = allocateSaleItems(sale).filter(
      ({ item }) => String(item.product_id) === String(productId),
    );
    if (!soldItems.length) continue;

    const date = new Date(sale.created_date);
    if (Number.isNaN(date.getTime())) continue;
    if (selectedStart && date < selectedStart) continue;
    if (selectedEnd && date > selectedEnd) continue;
    const saleKey = sale.id || sale.sale_number || sale.created_date;
    if (saleIds.has(saleKey)) continue;

    const quantity = soldItems.reduce((sum, row) => sum + row.quantity, 0);
    const revenue = soldItems.reduce((sum, row) => sum + row.netRevenue, 0);
    if (quantity <= 0 && revenue <= 0) continue;

    saleIds.add(saleKey);
    const occurrence = { date, quantity, revenue };
    occurrences.push(occurrence);

    const saleMonthKey = monthKey(date);
    addBucketValue(
      monthMap,
      saleMonthKey,
      date
        .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        .replace('.', ''),
      occurrence,
    );
    const saleDayKey = dateKey(date);
    addBucketValue(
      dayMap,
      saleDayKey,
      date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      occurrence,
    );
    addBucketValue(
      weekdayMap,
      date.getDay(),
      WEEKDAY_LABELS[date.getDay()],
      occurrence,
    );
    addBucketValue(
      hourMap,
      date.getHours(),
      `${String(date.getHours()).padStart(2, '0')}h`,
      occurrence,
    );
  }

  const sortedOccurrences = [...occurrences].sort(
    (first, second) => first.date.getTime() - second.date.getTime(),
  );
  const rangeStart = selectedStart || sortedOccurrences[0]?.date || null;
  const rangeEnd = selectedEnd || sortedOccurrences.at(-1)?.date || null;
  const weekdayDayCounts = new Map();
  const monthDayCounts = new Map();
  const periodDayCount = eachCalendarDay(rangeStart, rangeEnd, (date) => {
    const currentMonthKey = monthKey(date);
    const currentDayKey = dateKey(date);
    weekdayDayCounts.set(date.getDay(), (weekdayDayCounts.get(date.getDay()) || 0) + 1);
    monthDayCounts.set(currentMonthKey, (monthDayCounts.get(currentMonthKey) || 0) + 1);

    if (!monthMap.has(currentMonthKey)) {
      monthMap.set(currentMonthKey, {
        key: currentMonthKey,
        label: date
          .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
          .replace('.', ''),
        quantity: 0,
        revenue: 0,
        saleCount: 0,
      });
    }
    if (!dayMap.has(currentDayKey)) {
      dayMap.set(currentDayKey, {
        key: currentDayKey,
        label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        quantity: 0,
        revenue: 0,
        saleCount: 0,
      });
    }
  });

  for (let weekday = 0; weekday < WEEKDAY_LABELS.length; weekday += 1) {
    if (!weekdayMap.has(weekday) && weekdayDayCounts.has(weekday)) {
      weekdayMap.set(weekday, {
        key: weekday,
        label: WEEKDAY_LABELS[weekday],
        quantity: 0,
        revenue: 0,
        saleCount: 0,
      });
    }
  }

  const sortByValue = (rows, field = 'quantity') =>
    [...rows].sort(
      (first, second) =>
        Number(second[field] || 0) - Number(first[field] || 0) ||
        Number(second.revenue || 0) - Number(first.revenue || 0) ||
        String(first.key).localeCompare(String(second.key), 'pt-BR', {
          numeric: true,
        }),
    );
  const normalizeRows = (map, getPeriodDays) =>
    [...map.values()].map((row) => ({
      ...row,
      revenue: fromCents(toCents(row.revenue)),
      averageTicket: row.saleCount ? row.revenue / row.saleCount : 0,
      periodDays: getPeriodDays(row),
      averageDailyQuantity: getPeriodDays(row)
        ? row.quantity / getPeriodDays(row)
        : 0,
      averageDailyRevenue: getPeriodDays(row)
        ? row.revenue / getPeriodDays(row)
        : 0,
    }));

  const monthRows = normalizeRows(
    monthMap,
    (row) => monthDayCounts.get(row.key) || 0,
  ).sort((first, second) =>
    String(first.key).localeCompare(String(second.key), 'pt-BR', {
      numeric: true,
    }),
  );
  const dayRows = normalizeRows(dayMap, () => 1).sort((first, second) =>
    String(first.key).localeCompare(String(second.key), 'pt-BR', {
      numeric: true,
    }),
  );
  const weekdayRows = normalizeRows(
    weekdayMap,
    (row) => weekdayDayCounts.get(row.key) || 0,
  ).sort(
    (first, second) => first.key - second.key,
  );
  const hourRows = normalizeRows(hourMap, () => periodDayCount).sort(
    (first, second) => first.key - second.key,
  );
  const totalQuantity = occurrences.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const totalRevenue = fromCents(
    occurrences.reduce((sum, item) => sum + toCents(item.revenue), 0),
  );
  const bestMonth = sortByValue(monthRows)[0] || null;
  const bestWeekday = sortByValue(weekdayRows)[0] || null;
  const bestHour = sortByValue(hourRows)[0] || null;
  const weakestHour = hourRows.length > 1 ? sortByValue(hourRows).at(-1) : null;

  return {
    occurrences,
    saleCount: saleIds.size,
    totalQuantity,
    totalRevenue,
    averageQuantityPerSale: saleIds.size ? totalQuantity / saleIds.size : 0,
    averageRevenuePerSale: saleIds.size ? totalRevenue / saleIds.size : 0,
    averageDailyQuantity: periodDayCount ? totalQuantity / periodDayCount : 0,
    averageDailyRevenue: periodDayCount ? totalRevenue / periodDayCount : 0,
    periodDayCount,
    rangeStart,
    rangeEnd,
    firstSaleAt: sortedOccurrences[0]?.date || null,
    lastSaleAt: sortedOccurrences.at(-1)?.date || null,
    bestMonth,
    bestWeekday,
    bestHour,
    weakestHour,
    monthRows,
    dayRows,
    weekdayRows,
    hourRows,
  };
}

