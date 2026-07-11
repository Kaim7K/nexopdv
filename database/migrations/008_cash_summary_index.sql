CREATE INDEX IF NOT EXISTS nexo_sales_cash_session_idx
  ON nexo.records (market_id, (data->>'cash_session_id'), created_date)
  WHERE entity = 'sales';
