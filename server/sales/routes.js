import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import {
  normalizePaymentsForSale,
  roundMoney,
  summarizeSales,
} from '../cash-summary.js';
import { send } from '../http.js';

export async function handleSalesRequest(
  { req, res, sql, user, path },
  {
    PAYMENT_METHODS,
    findOpenCashSession,
    hasFeature,
    isUuid,
    parseDateQuery,
    recordFromRow,
    text,
  },
) {
if (path[0] === 'sales' && path[1] === 'list' && req.method === 'GET') {
  if (!user.market_id)
    return send(res, 400, { message: 'Usuário sem mercado.' });
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.max(
    10,
    Math.min(Number.parseInt(req.query.page_size, 10) || 20, 100),
  );
  const offset = (page - 1) * pageSize;
  const from = parseDateQuery(req.query.from);
  const to = parseDateQuery(req.query.to);
  const requestedSeller =
    user.role === 'vendedor' ? user.id : text(req.query.seller_id, 180);
  const query = text(req.query.search, 180).toLowerCase();
  const queryPattern = `%${query}%`;
  const payment = text(req.query.payment, 40);
  const status = text(req.query.status, 40);
  const rows = await sql`
    SELECT id, data - 'items' AS data, created_date, updated_date, count(*) OVER()::int AS total_count
    FROM nexo.records
    WHERE market_id=${user.market_id}
      AND entity='sales'
      AND data->>'status'=ANY(ARRAY['concluida','cancelada'])
      AND COALESCE((data->>'archived')::boolean,false)=false
      AND (${from === null} OR created_date >= ${from})
      AND (${to === null} OR created_date < ${to})
      AND (${requestedSeller === ''} OR data->>'seller_id'=${requestedSeller})
      AND (${status === ''} OR data->>'status'=${status})
      AND (${payment === ''} OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(data->'payments','[]'::jsonb)) AS payment_item
        WHERE payment_item->>'method'=${payment}
      ))
      AND (${query === ''} OR lower(COALESCE(data->>'sale_number','')) LIKE ${queryPattern}
        OR lower(COALESCE(data->>'seller_name','')) LIKE ${queryPattern}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(data->'payments','[]'::jsonb)) AS search_payment
          WHERE lower(COALESCE(search_payment->>'method','')) LIKE ${queryPattern}
        )
      )
    ORDER BY created_date DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const summaryRows = await sql`
    SELECT id, data - 'items' AS data, created_date, updated_date
    FROM nexo.records
    WHERE market_id=${user.market_id}
      AND entity='sales'
      AND data->>'status'=ANY(ARRAY['concluida','cancelada'])
      AND COALESCE((data->>'archived')::boolean,false)=false
      AND (${from === null} OR created_date >= ${from})
      AND (${to === null} OR created_date < ${to})
      AND (${requestedSeller === ''} OR data->>'seller_id'=${requestedSeller})
      AND (${status === ''} OR data->>'status'=${status})
      AND (${payment === ''} OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(data->'payments','[]'::jsonb)) AS payment_item
        WHERE payment_item->>'method'=${payment}
      ))
      AND (${query === ''} OR lower(COALESCE(data->>'sale_number','')) LIKE ${queryPattern}
        OR lower(COALESCE(data->>'seller_name','')) LIKE ${queryPattern}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(data->'payments','[]'::jsonb)) AS search_payment
          WHERE lower(COALESCE(search_payment->>'method','')) LIKE ${queryPattern}
        )
      )
    LIMIT 50000
  `;
  const sales = rows.map(recordFromRow);
  const total = Number(rows[0]?.total_count || 0);
  const includeSellers =
    req.query.include_sellers === '1' || user.role === 'vendedor';
  const sellerRows = !includeSellers
    ? []
    : user.role === 'vendedor'
      ? [{ id: user.id, full_name: user.full_name || user.email }]
      : await sql`SELECT id,COALESCE(full_name,email) AS full_name FROM nexo.users WHERE market_id=${user.market_id} AND active=true AND role=ANY(ARRAY['vendedor','gerente','admin']) ORDER BY COALESCE(full_name,email)`;
  const sellers = sellerRows.map((seller) => ({
    id: seller.id,
    name: seller.full_name,
  }));
  const summary = summarizeSales(summaryRows.map(recordFromRow));
  return send(res, 200, {
    items: sales,
    page,
    page_size: pageSize,
    total,
    page_count: Math.max(1, Math.ceil(total / pageSize)),
    summary:
      user.role === 'vendedor'
        ? {
            sales_count: Number(summary.sales_count || 0),
          }
        : summary,
    sellers,
  });
}

if (path[0] === 'sales' && path[1] === 'report' && req.method === 'GET') {
  if (user.role === 'vendedor')
    return send(res, 403, {
      message: 'Relatórios financeiros de vendas são restritos a gerentes e administradores.',
    });
  if (!hasFeature(user, 'report_export'))
    return send(res, 403, {
      code: 'FEATURE_NOT_AVAILABLE',
      message: 'Exportação de relatórios não está incluída neste plano.',
    });
  if (!user.market_id)
    return send(res, 400, { message: 'Usuário sem mercado.' });
  const from = parseDateQuery(req.query.from);
  const to = parseDateQuery(req.query.to);
  if (
    !from ||
    !to ||
    to <= from ||
    to.getTime() - from.getTime() > 32 * 24 * 60 * 60 * 1000
  ) {
    return send(res, 400, {
      message: 'Informe um único dia e um intervalo de horário válido.',
    });
  }
  const requestedSeller =
    user.role === 'vendedor' ? user.id : text(req.query.seller_id, 180);
  const rows = await sql`
    SELECT id, data, created_date, updated_date
    FROM nexo.records
    WHERE market_id=${user.market_id}
      AND entity='sales'
      AND COALESCE((data->>'archived')::boolean,false)=false
      AND created_date >= ${from}
      AND created_date < ${to}
      AND (${requestedSeller === ''} OR data->>'seller_id'=${requestedSeller})
    ORDER BY created_date ASC
    LIMIT 5000
  `;
  let sales = rows
    .map(recordFromRow)
    .filter((sale) => ['concluida', 'cancelada'].includes(sale.status));
  const payment = text(req.query.payment, 40);
  if (payment)
    sales = sales.filter((sale) =>
      (sale.payments || []).some((item) => item.method === payment),
    );
  return send(res, 200, {
    sales,
    summary: summarizeSales(sales),
    filters: {
      from: from.toISOString(),
      to: to.toISOString(),
      seller_id: requestedSeller || null,
      payment: payment || null,
    },
  });
}

if (path[0] === 'sales' && path[1] === 'next' && req.method === 'GET') {
  const rows =
    await sql`SELECT next_sale_number FROM nexo.markets WHERE id=${user.market_id}`;
  return send(
    res,
    rows[0] ? 200 : 404,
    rows[0]
      ? { sale_number: Number(rows[0].next_sale_number) }
      : { message: 'Mercado não encontrado.' },
  );
}
if (path[0] === 'sales' && path[1] === 'complete' && req.method === 'POST') {
  if (!user.market_id)
    return send(res, 400, { message: 'Usuário sem mercado.' });
  const openCashSession = await findOpenCashSession(
    sql,
    user.market_id,
    user.id,
  );
  if (
    user.role === 'vendedor' &&
    user.require_cash_register &&
    !openCashSession
  ) {
    return send(res, 409, {
      code: 'CASH_REGISTER_REQUIRED',
      message:
        'Abra o caixa e informe o valor inicial antes de começar a vender.',
    });
  }
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  const rawPayments = Array.isArray(req.body.payments)
    ? req.body.payments
    : [];
  if (!rawItems.length)
    return send(res, 400, { message: 'A venda não possui itens.' });
  if (rawItems.length > 500)
    return send(res, 400, {
      message:
        'A venda possui itens demais para ser concluída de uma só vez.',
    });
  if (
    rawItems.some(
      (item) =>
        !isUuid(item.product_id) ||
        !Number.isFinite(Number(item.quantity ?? item.weight)),
    )
  )
    return send(res, 400, {
      message:
        'Há itens inválidos na venda. Remova e adicione o produto novamente.',
    });
  const productIds = [...new Set(rawItems.map((item) => item.product_id))];
  const ownedProducts =
    await sql`SELECT id,data FROM nexo.records WHERE market_id=${user.market_id} AND entity='products' AND id=ANY(${productIds}::uuid[])`;
  if (ownedProducts.length !== productIds.length)
    return send(res, 409, {
      message:
        'A venda possui produto inexistente ou de outro mercado. Atualize o PDV e tente novamente.',
    });
  const productsById = new Map(
    ownedProducts.map((product) => [product.id, product.data]),
  );
  const items = rawItems.map((item) => {
    const product = productsById.get(item.product_id);
    const unit = product.unit === 'peso' ? 'peso' : product.unit || 'unidade';
    const soldQuantity =
      unit === 'peso' ? Number(item.weight) : Number(item.quantity);
    const currentPrice = Number(product.sale_price);
    const allowPdvPriceEdit = Boolean(item.allow_pdv_price_edit);
    const itemPrice = Number(item.unit_price);
    if (
      !Number.isFinite(soldQuantity) ||
      soldQuantity <= 0 ||
      !Number.isFinite(currentPrice) ||
      currentPrice < 0
    )
      throw new AppError(
        400,
        'INVALID_SALE_ITEM',
        'Há quantidade ou preço inválido na venda.',
      );
    if (
      !Number.isFinite(itemPrice) ||
      itemPrice < 0 ||
      (!allowPdvPriceEdit && Math.abs(itemPrice - currentPrice) > 0.009)
    )
      throw new AppError(
        409,
        'PRODUCT_PRICE_CHANGED',
        `O preço de ${text(product.name, 180)} foi alterado. Atualize o produto na venda e tente novamente.`,
      );
    return {
      product_id: item.product_id,
      product_name: text(product.name, 180),
      barcode: text(product.barcode, 180),
      internal_code: text(product.internal_code, 180),
      quantity: unit === 'peso' ? 1 : soldQuantity,
      weight: unit === 'peso' ? soldQuantity : null,
      unit_price: allowPdvPriceEdit ? roundMoney(itemPrice) : currentPrice,
      unit_cost:
        product.cost_price === null ||
        product.cost_price === '' ||
        product.cost_price === undefined
          ? null
          : roundMoney(Math.max(0, Number(product.cost_price) || 0)),
      subtotal: roundMoney(soldQuantity * (allowPdvPriceEdit ? itemPrice : currentPrice)),
      unit,
      allow_pdv_price_edit: allowPdvPriceEdit,
    };
  });
  if (
    rawPayments.length > 10 ||
    rawPayments.some(
      (payment) =>
        !PAYMENT_METHODS.has(payment.method) ||
        !Number.isFinite(Number(payment.amount)) ||
        Number(payment.amount) < 0,
    )
  )
    return send(res, 400, { message: 'Há pagamentos inválidos na venda.' });
  const isFiado = req.body.sale_type === 'fiado';
  const fiadoPaymentCount = rawPayments.filter(
    (payment) => payment.method === 'fiado',
  ).length;
  if ((!isFiado && fiadoPaymentCount) || (isFiado && fiadoPaymentCount !== 1))
    return send(res, 400, {
      message:
        'A forma de pagamento fiado não está configurada corretamente.',
    });
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.subtotal, 0),
  );
  const discountType =
    req.body.discount_type === 'percentual' ? 'percentual' : 'valor';
  const discountValue = Math.max(0, Number(req.body.discount_value || 0));
  const discount = roundMoney(
    discountType === 'percentual'
      ? (subtotal * Math.min(discountValue, 100)) / 100
      : Math.min(discountValue, subtotal),
  );
  const total = roundMoney(Math.max(0, subtotal - discount));
  const cleanPayments = rawPayments.map((payment) => ({
    method: payment.method,
    amount: roundMoney(Math.max(0, Number(payment.amount))),
  }));
  const responsibleName = text(req.body.fiado?.responsible_name, 180);
  const requestedOperationId = text(req.body.client_operation_id, 64);
  const clientOperationId = isUuid(requestedOperationId)
    ? requestedOperationId
    : randomUUID();
  if (isFiado && !responsibleName)
    return send(res, 400, {
      message: 'Informe o responsável pela venda fiada.',
    });
  let paymentAllocation;
  try {
    paymentAllocation = normalizePaymentsForSale(cleanPayments, total, {
      isFiado,
    });
  } catch (error) {
    return send(res, 400, {
      code: error.code || 'INVALID_PAYMENT_ALLOCATION',
      message: error.message || 'Os pagamentos não conciliam com o total da venda.',
    });
  }
  const {
    payments: normalizedPayments,
    paidAmount: paid,
    tenderedAmount,
    cashTenderedAmount,
    changeAmount,
    outstandingAmount: outstanding,
  } = paymentAllocation;
  const saleData = {
    seller_id: user.id,
    seller_name: user.full_name || user.email,
    cash_session_id: openCashSession?.id || null,
    status: 'concluida',
    items,
    payments: normalizedPayments,
    subtotal,
    discount_value: discountValue,
    discount_type: discountType,
    total,
    paid_amount: paid,
    tendered_amount: tenderedAmount,
    cash_tendered_amount: cashTenderedAmount,
    outstanding_amount: isFiado ? outstanding : 0,
    change_amount: changeAmount,
    observation: text(req.body.observation, 1000),
    sale_type: isFiado ? 'fiado' : 'normal',
    client_operation_id: clientOperationId,
  };
  const fiadoPayload = {
    responsible_name: responsibleName,
    phone: text(req.body.fiado?.phone, 40),
    observation: text(req.body.fiado?.observation, 1000),
    total_amount: outstanding,
    seller_id: user.id,
    seller_name: user.full_name || user.email,
    status: 'pendente',
  };
  const auditPayload = {
    action_type: 'venda_concluida',
    entity_type: 'sale',
    user_id: user.id,
    user_name: user.full_name || user.email,
    description: 'Venda concluída',
    details: {
      total,
      items: items.length,
      sale_type: isFiado ? 'fiado' : 'normal',
    },
  };
  let [sale] = await sql`
    WITH existing AS MATERIALIZED (
      SELECT id,data,created_date,updated_date FROM nexo.records
      WHERE market_id=${user.market_id} AND entity='sales'
        AND data->>'client_operation_id'=${clientOperationId}
      LIMIT 1
    ), sale_number AS (
      UPDATE nexo.markets
      SET next_sale_number = next_sale_number + 1
      WHERE id = ${user.market_id} AND NOT EXISTS (SELECT 1 FROM existing)
      RETURNING next_sale_number - 1 AS value
    ), sale AS (
      INSERT INTO nexo.records(market_id, entity, data)
      SELECT ${user.market_id}, 'sales', ${JSON.stringify(saleData)}::jsonb || jsonb_build_object('sale_number', sale_number.value)
      FROM sale_number
      ON CONFLICT DO NOTHING
      RETURNING id, data, created_date, updated_date
    ), stock_source AS (
      SELECT
        (item->>'product_id')::uuid AS product_id,
        SUM(CASE WHEN item->>'unit'='peso' THEN (item->>'weight')::numeric ELSE (item->>'quantity')::numeric END) AS sold_quantity
      FROM sale, jsonb_array_elements(sale.data->'items') item
      GROUP BY 1
    ), stock AS (
      UPDATE nexo.records product
      SET data = product.data || jsonb_build_object(
        'quantity',
        (CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END) - stock_source.sold_quantity,
        'last_sale_at', now()
      ), updated_date = now()
      FROM stock_source
      WHERE product.id = stock_source.product_id
        AND product.market_id = ${user.market_id}
        AND product.entity = 'products'
      RETURNING product.id
    ), fiado AS (
      INSERT INTO nexo.records(market_id, entity, data)
      SELECT ${user.market_id}, 'fiado_records', ${JSON.stringify(fiadoPayload)}::jsonb || jsonb_build_object(
        'sale_id', sale.id,
        'sale_number', sale.data->'sale_number'
      )
      FROM sale
      WHERE ${isFiado}
      RETURNING id
    ), audit AS (
      INSERT INTO nexo.records(market_id, entity, data)
      SELECT ${user.market_id}, 'general_audits', ${JSON.stringify(auditPayload)}::jsonb || jsonb_build_object(
        'entity_id', sale.id,
        'description', 'Venda #' || (sale.data->>'sale_number') || ' concluída'
      )
      FROM sale
      RETURNING id
    ), result AS (
      SELECT id,data,created_date,updated_date FROM sale
      UNION ALL
      SELECT id,data,created_date,updated_date FROM existing
    )
    SELECT id, data, created_date, updated_date FROM result LIMIT 1
  `;
  if (!sale) {
    [sale] = await sql`
      SELECT id,data,created_date,updated_date FROM nexo.records
      WHERE market_id=${user.market_id} AND entity='sales'
        AND data->>'client_operation_id'=${clientOperationId}
      LIMIT 1
    `;
  }
  if (!sale)
    throw new AppError(
      409,
      'SALE_NUMBER_UNAVAILABLE',
      'Não foi possível reservar o número da venda. Atualize o PDV e tente novamente.',
    );
  return send(res, 201, {
    id: sale.id,
    ...sale.data,
    created_date: sale.created_date,
    updated_date: sale.updated_date,
  });
}
if (path[0] === 'sales' && path[2] === 'cancel' && req.method === 'POST') {
  const saleId = path[1];
  if (!isUuid(saleId)) return send(res, 400, { message: 'Venda inválida.' });
  const cancellationReason = text(req.body.reason, 500);
  const canCancelAny = ['admin', 'gerente'].includes(user.role);
  const rows = await sql`
    SELECT id,data,created_date,updated_date
    FROM nexo.records
    WHERE id=${saleId}
      AND market_id=${user.market_id}
      AND entity='sales'
      AND (${canCancelAny} OR data->>'seller_id'=${user.id})
    LIMIT 1
  `;
  const current = recordFromRow(rows[0]);
  if (!current)
    return send(res, 404, {
      message: 'Venda não encontrada ou sem permissão para cancelar.',
    });
  if (current.status !== 'concluida')
    return send(res, 409, {
      message: 'A venda já foi cancelada ou não pode mais ser alterada.',
    });

  const restoreByProduct = new Map();
  for (const item of current.items || []) {
    if (!isUuid(item.product_id)) continue;
    const quantity = Number(
      item.unit === 'peso' ? item.weight : item.quantity,
    );
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    restoreByProduct.set(
      item.product_id,
      Number(restoreByProduct.get(item.product_id) || 0) + quantity,
    );
  }
  const restores = [...restoreByProduct.entries()].map(([id, quantity]) => ({
    id,
    quantity,
  }));
  const cancelledAt = new Date().toISOString();
  const operationId = randomUUID();
  const auditPayload = {
    action_type: 'venda_cancelada',
    entity_type: 'sale',
    entity_id: saleId,
    user_id: user.id,
    user_name: user.full_name || user.email,
    description: `Venda #${current.sale_number} cancelada`,
    details: {
      reason: cancellationReason,
      total: current.total,
      products_to_restore: restores.length,
    },
  };

  // Todas as etapas são executadas na mesma transação. O identificador da
  // operação impede que dois cliques restaurem o estoque duas vezes.
  const [saleRows, restoredRows, fiadoRows, settlementMovementRows] =
    await sql.transaction((tx) => [
    tx`
      UPDATE nexo.records
      SET data=data || ${JSON.stringify({
        status: 'cancelada',
        cancellation_reason: cancellationReason,
        cancelled_by_id: user.id,
        cancelled_by_name: user.full_name || user.email,
        cancelled_at: cancelledAt,
        cancellation_operation_id: operationId,
      })}::jsonb,
      updated_date=now()
      WHERE id=${saleId}
        AND market_id=${user.market_id}
        AND entity='sales'
        AND data->>'status'='concluida'
      RETURNING id,data,created_date,updated_date
    `,
    tx`
      WITH stock_input AS (
        SELECT (entry->>'id')::uuid AS id, (entry->>'quantity')::numeric AS quantity
        FROM jsonb_array_elements(${JSON.stringify(restores)}::jsonb) entry
      )
      UPDATE nexo.records product
      SET data=product.data || jsonb_build_object(
        'quantity',
        (CASE WHEN product.data->>'quantity' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (product.data->>'quantity')::numeric ELSE 0 END) + stock_input.quantity,
        'last_sale_at', (
          SELECT MAX(previous_sale.created_date)
          FROM nexo.records previous_sale
          WHERE previous_sale.market_id=${user.market_id}
            AND previous_sale.entity='sales'
            AND previous_sale.data->>'status'='concluida'
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(previous_sale.data->'items','[]'::jsonb)) previous_item
              WHERE previous_item->>'product_id'=product.id::text
            )
        )
      ), updated_date=now()
      FROM stock_input
      WHERE product.id=stock_input.id
        AND product.market_id=${user.market_id}
        AND product.entity='products'
        AND EXISTS (
          SELECT 1 FROM nexo.records cancelled_sale
          WHERE cancelled_sale.id=${saleId}
            AND cancelled_sale.market_id=${user.market_id}
            AND cancelled_sale.entity='sales'
            AND cancelled_sale.data->>'cancellation_operation_id'=${operationId}
        )
      RETURNING product.id
    `,
    tx`
      UPDATE nexo.records fiado
      SET data=fiado.data || ${JSON.stringify({
        status: 'cancelado',
        cancellation_reason: cancellationReason,
        settled_by_id: user.id,
        settled_by_name: user.full_name || user.email,
        cancelled_at: cancelledAt,
      })}::jsonb,
      updated_date=now()
      WHERE fiado.market_id=${user.market_id}
        AND fiado.entity='fiado_records'
        AND fiado.data->>'sale_id'=${saleId}
        AND fiado.data->>'status' IN ('pendente','quitado')
        AND EXISTS (
          SELECT 1 FROM nexo.records cancelled_sale
          WHERE cancelled_sale.id=${saleId}
            AND cancelled_sale.data->>'cancellation_operation_id'=${operationId}
        )
      RETURNING fiado.id
    `,
    tx`
      UPDATE nexo.records movement
      SET data=movement.data || jsonb_build_object(
        'status','estornado','reversed_at',now(),'reversed_by',${user.id}::text,
        'reversal_reason','Venda vinculada cancelada'
      ),updated_date=now()
      WHERE movement.market_id=${user.market_id}
        AND movement.entity='cash_movements'
        AND movement.id IN (
          SELECT NULLIF(fiado.data->>'settlement_cash_movement_id','')::uuid
          FROM nexo.records fiado
          WHERE fiado.market_id=${user.market_id}
            AND fiado.entity='fiado_records'
            AND fiado.data->>'sale_id'=${saleId}
            AND COALESCE(fiado.data->>'settlement_cash_movement_id','')<>''
        )
        AND EXISTS (
          SELECT 1 FROM nexo.records cancelled_sale
          WHERE cancelled_sale.id=${saleId}
            AND cancelled_sale.data->>'cancellation_operation_id'=${operationId}
        )
      RETURNING movement.id
    `,
    tx`
      INSERT INTO nexo.records(market_id,entity,data)
      SELECT ${user.market_id},'general_audits',${JSON.stringify(auditPayload)}::jsonb || jsonb_build_object(
        'details', (${JSON.stringify(auditPayload.details)}::jsonb || jsonb_build_object(
          'products_restored', (
            SELECT count(*) FROM nexo.records product
            WHERE product.market_id=${user.market_id}
              AND product.entity='products'
              AND product.id=ANY(${restores.map((item) => item.id)}::uuid[])
          )
        ))
      )
      WHERE EXISTS (
        SELECT 1 FROM nexo.records cancelled_sale
        WHERE cancelled_sale.id=${saleId}
          AND cancelled_sale.market_id=${user.market_id}
          AND cancelled_sale.entity='sales'
          AND cancelled_sale.data->>'cancellation_operation_id'=${operationId}
      )
      RETURNING id
    `,
  ]);

  if (!saleRows?.[0])
    return send(res, 409, {
      message: 'A venda foi alterada em outra tela. Atualize o histórico.',
    });
  const cancelled = recordFromRow(saleRows[0]);
  return send(res, 200, {
    ...cancelled,
    restored_products: restoredRows?.length || 0,
    fiado_cancelled: Boolean(fiadoRows?.length),
    settlement_movements_reversed: settlementMovementRows?.length || 0,
  });
}
if (path[0] === 'sales' && path[1] && !path[2] && req.method === 'DELETE') {
  if (user.role !== 'admin')
    return send(res, 403, {
      message: 'Apenas administradores podem arquivar vendas.',
    });
  if (!isUuid(path[1])) return send(res, 400, { message: 'Venda inválida.' });
  const deletionAudit = {
    action_type: 'venda_arquivada',
    entity_type: 'sale',
    entity_id: path[1],
    user_id: user.id,
    user_name: user.full_name || user.email,
  };
  const [archived] = await sql`
    WITH target AS MATERIALIZED (
      SELECT id, data
      FROM nexo.records
      WHERE id=${path[1]}
        AND market_id=${user.market_id}
        AND entity='sales'
        AND data->>'status'='cancelada'
        AND COALESCE((data->>'archived')::boolean,false)=false
      FOR UPDATE
    ), audit AS (
      INSERT INTO nexo.records(market_id, entity, data)
      SELECT ${user.market_id}, 'general_audits', ${JSON.stringify(deletionAudit)}::jsonb || jsonb_build_object(
        'description', 'Venda #' || COALESCE(target.data->>'sale_number', target.id::text) || ' arquivada'
      )
      FROM target
      RETURNING id
    ), archived AS (
      UPDATE nexo.records sale
      SET data=sale.data||jsonb_build_object(
        'archived',true,'archived_at',now(),'archived_by_id',${user.id}::text,
        'archived_by_name',${user.full_name || user.email}::text
      ),updated_date=now()
      FROM target
      WHERE sale.id=target.id
        AND EXISTS (SELECT 1 FROM audit)
      RETURNING sale.id, sale.data
    )
    SELECT archived.id, archived.data->>'sale_number' AS sale_number
    FROM archived
  `;
  return send(
    res,
    archived ? 200 : 409,
    archived
      ? { ok: true, archived: true, id: archived.id, sale_number: archived.sale_number }
      : { message: 'Cancele a venda antes de arquivá-la.' },
  );
}
  return send(res, 404, { message: 'Rota não encontrada.' });
}
