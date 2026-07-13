CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_products_name_search_trgm_idx
  ON nexo.records USING gin (lower(COALESCE(data->>'name','')) gin_trgm_ops)
  WHERE entity='products';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_products_category_idx
  ON nexo.records (market_id, (data->>'category'), updated_date DESC)
  WHERE entity='products';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_sales_status_created_idx
  ON nexo.records (market_id, (data->>'status'), created_date DESC)
  WHERE entity='sales';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_fiados_due_status_idx
  ON nexo.records (market_id, (data->>'status'), (data->>'due_date'))
  WHERE entity='fiado_records' AND NULLIF(data->>'due_date','') IS NOT NULL;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_system_configs_key_idx
  ON nexo.records (market_id, (data->>'key'))
  WHERE entity='system_configs';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_finance_transactions_type_period_idx
  ON nexo.finance_transactions (market_id, type, issue_date DESC, status);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_finance_transactions_account_period_idx
  ON nexo.finance_transactions (market_id, account_id, issue_date DESC)
  WHERE account_id IS NOT NULL;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_finance_transactions_category_period_idx
  ON nexo.finance_transactions (market_id, category_id, issue_date DESC)
  WHERE category_id IS NOT NULL;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_finance_recurring_due_idx
  ON nexo.finance_recurring_rules (market_id, next_due_date)
  WHERE active=true;
