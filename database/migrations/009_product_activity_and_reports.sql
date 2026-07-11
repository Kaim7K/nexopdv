-- Registra a última venda nos produtos existentes para suportar a coluna
-- "Última venda" e a limpeza segura de produtos inativos.
WITH product_last_sales AS (
  SELECT
    product.market_id,
    product.id AS product_id,
    MAX(sale.created_date) AS last_sale_at
  FROM nexo.records product
  JOIN nexo.records sale
    ON sale.market_id = product.market_id
   AND sale.entity = 'sales'
   AND sale.data->>'status' = 'concluida'
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sale.data->'items', '[]'::jsonb)) item
  WHERE product.entity = 'products'
    AND item->>'product_id' = product.id::text
  GROUP BY product.market_id, product.id
)
UPDATE nexo.records product
SET data = product.data || jsonb_build_object('last_sale_at', activity.last_sale_at),
    updated_date = now()
FROM product_last_sales activity
WHERE product.id = activity.product_id
  AND product.market_id = activity.market_id
  AND product.entity = 'products';

CREATE INDEX IF NOT EXISTS idx_records_products_last_sale
  ON nexo.records (market_id, (data->>'last_sale_at'))
  WHERE entity = 'products' AND COALESCE(data->>'last_sale_at','') <> '';
