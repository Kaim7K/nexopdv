CREATE UNIQUE INDEX IF NOT EXISTS nexo_cash_sessions_one_open_uidx
  ON nexo.records (market_id, (data->>'seller_id'))
  WHERE entity = 'cash_sessions' AND data->>'status' = 'aberto';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_fiados_market_status_created_idx
  ON nexo.records (market_id, (data->>'status'), created_date DESC)
  WHERE entity = 'fiado_records';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_products_market_status_updated_idx
  ON nexo.records (market_id, (data->>'status'), updated_date DESC)
  WHERE entity = 'products';
