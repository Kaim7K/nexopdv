import { send, methodNotAllowed } from './http.js';

// Historical sales are authoritative even when the cached last_sale_at is missing.
export async function inactiveProducts(sql, marketId) {
  return sql`
    SELECT p.id,p.data->>'name' AS name,p.updated_date::text AS updated_date
    FROM nexo.records p
    WHERE p.market_id=${marketId} AND p.entity='products'
      AND GREATEST(p.created_date,
        CASE WHEN p.data->>'last_sale_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
          THEN (p.data->>'last_sale_at')::timestamptz END,
        (SELECT max(s.created_date) FROM nexo.records s
         WHERE s.market_id=${marketId} AND s.entity='sales' AND s.data->>'status'='concluida'
         AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(s.data->'items','[]'::jsonb)) item
                    WHERE item->>'product_id'=p.id::text))) <= now() - interval '3 months'
    ORDER BY p.id LIMIT 3000
  `;
}

export async function handleInactiveCleanup({req,res,sql,user}) {
  if (!user.market_id || !['admin','gerente'].includes(user.role) || !(user.enabled_modules||[]).includes('estoque'))
    return send(res,403,{message:'Sem permissão para limpar produtos.'});
  if(req.method==='GET') return send(res,200,{products:await inactiveProducts(sql,user.market_id)});
  if(req.method!=='POST') return methodNotAllowed(res,['GET','POST']);
  const selected=req.body?.products;
  if(req.body?.confirmation!=='LIXEIRA_SEM_VENDA_3_MESES' || !Array.isArray(selected) || !selected.length || selected.length>3000 || selected.some(p=>! /^[0-9a-f-]{36}$/i.test(p.id)|| !Number.isFinite(Date.parse(p.updated_date))))
    return send(res,400,{message:'Revise a lista de produtos antes de confirmar.'});
  const moved=await sql`
    WITH selection AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(selected)}::jsonb) AS x(id uuid,updated_date timestamptz)),
    original AS MATERIALIZED (
      SELECT p.* FROM nexo.records p JOIN selection x ON p.id=x.id AND p.updated_date=x.updated_date
      WHERE p.market_id=${user.market_id} AND p.entity='products'
        AND GREATEST(p.created_date,
          CASE WHEN p.data->>'last_sale_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
            THEN (p.data->>'last_sale_at')::timestamptz END,
          (SELECT max(s.created_date) FROM nexo.records s
           WHERE s.market_id=${user.market_id} AND s.entity='sales' AND s.data->>'status'='concluida'
           AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(s.data->'items','[]'::jsonb)) item
                      WHERE item->>'product_id'=p.id::text))) <= now() - interval '3 months'
      FOR UPDATE OF p
    ), moved AS (
      UPDATE nexo.records p SET entity='product_trash',
        data=jsonb_build_object('product',o.data,'original_created_date',o.created_date,
          'original_updated_date',o.updated_date,'deleted_at',now(),'deleted_by',${user.id}::text),updated_date=now()
      FROM original o WHERE p.id=o.id AND p.market_id=${user.market_id} AND p.entity='products'
        AND (SELECT count(*) FROM original)=${selected.length}
      RETURNING p.id
    ), audited AS (
      INSERT INTO nexo.records(market_id,entity,data)
      SELECT ${user.market_id},'general_audits',jsonb_build_object('action_type','produtos_sem_venda_lixeira',
        'user_id',${user.id}::text,'details',jsonb_build_object('months',3,'recoverable',true,
        'product_ids',jsonb_agg(id),'count',count(*))) FROM moved HAVING count(*)>0 RETURNING id
    ) SELECT moved.id FROM moved JOIN audited ON true
  `;
  if(!moved.length) return send(res,409,{message:'O estoque mudou. Confira novamente a lista antes de continuar.'});
  return send(res,200,{deleted:moved.length,recoverable:true});
}
