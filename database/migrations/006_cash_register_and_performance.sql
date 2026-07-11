ALTER TABLE nexo.markets
  ADD COLUMN IF NOT EXISTS require_cash_register boolean NOT NULL DEFAULT false;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_sales_market_created_idx
  ON nexo.records (market_id, created_date DESC)
  WHERE entity = 'sales';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_sales_market_seller_created_idx
  ON nexo.records (market_id, (data->>'seller_id'), created_date DESC)
  WHERE entity = 'sales';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_cash_sessions_open_idx
  ON nexo.records (market_id, (data->>'seller_id'), updated_date DESC)
  WHERE entity = 'cash_sessions' AND data->>'status' = 'aberto';
