import { send, methodNotAllowed } from "./http.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Moving the record preserves its UUID, original dates and the complete payload,
// including stock/cost/images. The audit and move are one atomic statement.
export async function archiveProduct(sql, user, id) {
  const [row] = await sql`
    WITH original AS MATERIALIZED (
      SELECT id,data,created_date,updated_date FROM nexo.records
      WHERE id=${id} AND market_id=${user.market_id} AND entity='products'
      FOR UPDATE
    ), moved AS (
      UPDATE nexo.records record SET entity='product_trash',
        data=jsonb_build_object('product',original.data,
          'original_created_date',original.created_date,'original_updated_date',original.updated_date,
          'deleted_at',now(),'deleted_by',${user.id}::text),updated_date=now()
      FROM original WHERE record.id=original.id AND record.market_id=${user.market_id}
        AND record.entity='products'
      RETURNING record.id,original.data
    ), audited AS (
      INSERT INTO nexo.records(market_id,entity,data)
      SELECT ${user.market_id},'general_audits',jsonb_build_object(
        'action_type','produto_enviado_lixeira','entity_type','product','entity_id',moved.id,
        'user_id',${user.id}::text,'user_name',${user.full_name || user.email}::text,
        'description','Produto enviado à lixeira; recuperação disponível',
        'details',jsonb_build_object('product_id',moved.id,'name',moved.data->>'name','recoverable',true))
      FROM moved RETURNING id
    ) SELECT moved.id FROM moved JOIN audited ON true
  `;
  return row || null;
}

export async function handleProductTrash({ req, res, sql, user, path }) {
  if (
    !user.market_id ||
    !["admin", "gerente"].includes(user.role) ||
    !(user.enabled_modules || []).includes("estoque")
  )
    return send(res, 403, {
      message: "Sem permissão para recuperar produtos deste mercado.",
    });
  if (path.length === 2) {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const rows = await sql`
      SELECT id,data->'product'->>'name' AS name,data->'product'->>'barcode' AS barcode,
        data->'product'->'quantity' AS quantity,data->>'deleted_at' AS deleted_at,
        count(*) OVER()::int AS total
      FROM nexo.records WHERE market_id=${user.market_id} AND entity='product_trash'
      ORDER BY updated_date DESC,id LIMIT 25 OFFSET ${(page - 1) * 25}
    `;
    const legacy = await sql`
      SELECT id,created_date,data->'details'->'deleted' AS deleted
      FROM nexo.records WHERE market_id=${user.market_id} AND entity='general_audits'
        AND data->>'action_type'='produtos_inativos_excluidos'
      ORDER BY created_date DESC LIMIT 5
    `;
    return send(res, 200, {
      items: rows.map(({ total: _total, ...row }) => row),
      page,
      page_count: Math.max(1, Math.ceil(Number(rows[0]?.total || 0) / 25)),
      legacy_incidents: legacy,
    });
  }
  const id = path[2];
  if (path.length !== 4 || path[3] !== "restore" || !UUID.test(id || ""))
    return send(res, 400, { message: "Produto de recuperação inválido." });
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const [, restored] = await sql.transaction((tx) => [
    tx`SELECT id FROM nexo.markets WHERE id=${user.market_id} FOR UPDATE`,
    tx`
      WITH original AS MATERIALIZED (
        SELECT id,data FROM nexo.records
        WHERE id=${id} AND market_id=${user.market_id} AND entity='product_trash'
        FOR UPDATE
      ), moved AS (
        UPDATE nexo.records record SET entity='products',
          data=original.data->'product' || jsonb_build_object('_restored_from_trash',${id}::text),
          updated_date=now()
        FROM original WHERE record.id=original.id AND record.market_id=${user.market_id}
          AND record.entity='product_trash'
          AND NOT EXISTS (
            SELECT 1 FROM nexo.records other WHERE other.market_id=${user.market_id} AND other.entity='products'
              AND ((NULLIF(btrim(original.data->'product'->>'barcode'),'') IS NOT NULL
                AND btrim(other.data->>'barcode')=btrim(original.data->'product'->>'barcode'))
                OR (lower(btrim(other.data->>'name'))=lower(btrim(original.data->'product'->>'name'))
                  AND COALESCE(btrim(other.data->>'barcode'),'')=COALESCE(btrim(original.data->'product'->>'barcode'),'')))
          )
          AND (SELECT count(*) FROM nexo.records product WHERE product.market_id=${user.market_id} AND product.entity='products')
            < COALESCE((SELECT product_limit FROM nexo.markets WHERE id=${user.market_id}),2147483647)
        RETURNING record.id
      ), audited AS (
        INSERT INTO nexo.records(market_id,entity,data)
        SELECT ${user.market_id},'general_audits',jsonb_build_object(
          'action_type','produto_restaurado_lixeira','entity_type','product','entity_id',moved.id,
          'user_id',${user.id}::text,'user_name',${user.full_name || user.email}::text,
          'description','Produto restaurado da lixeira; dados originais preservados')
        FROM moved RETURNING id
      ) SELECT moved.id FROM moved JOIN audited ON true
    `,
  ]);
  if (restored[0]) return send(res, 200, { restored: true, id });
  const [existing] =
    await sql`SELECT id FROM nexo.records WHERE id=${id} AND market_id=${user.market_id}
    AND entity='products' AND data->>'_restored_from_trash'=${id}`;
  if (existing)
    return send(res, 200, { restored: true, already_restored: true, id });
  return send(res, 409, {
    message:
      "Não foi possível restaurar: verifique produto já cadastrado com o mesmo código/nome, limite do plano ou ausência de cópia na lixeira. Nenhum dado atual foi sobrescrito.",
  });
}
