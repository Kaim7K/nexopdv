ALTER TABLE nexo.finance_transactions
  DROP CONSTRAINT IF EXISTS finance_transactions_origin_check;

ALTER TABLE nexo.finance_transactions
  ADD CONSTRAINT finance_transactions_origin_check
  CHECK (origin IN (
    'manual','purchase','stock_loss','recurring','opening','external',
    'cash_close','cash_movement','fiado_settlement'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS nexo_finance_cash_close_origin_uidx
  ON nexo.finance_transactions(market_id,origin,origin_id)
  WHERE origin='cash_close' AND origin_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nexo_finance_cash_movement_origin_uidx
  ON nexo.finance_transactions(market_id,origin,origin_id)
  WHERE origin='cash_movement' AND origin_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nexo_sales_client_operation_uidx
  ON nexo.records(market_id,(data->>'client_operation_id'))
  WHERE entity='sales' AND COALESCE(data->>'client_operation_id','')<>'';

CREATE UNIQUE INDEX IF NOT EXISTS nexo_cash_movement_finance_payment_uidx
  ON nexo.records(market_id,(data->>'finance_payment_id'))
  WHERE entity='cash_movements' AND COALESCE(data->>'finance_payment_id','')<>'';

CREATE UNIQUE INDEX IF NOT EXISTS nexo_cash_movement_fiado_uidx
  ON nexo.records(market_id,(data->>'fiado_settlement_id'))
  WHERE entity='cash_movements' AND COALESCE(data->>'fiado_settlement_id','')<>'';

CREATE UNIQUE INDEX IF NOT EXISTS nexo_cash_movement_operation_uidx
  ON nexo.records(market_id,(data->>'operation_id'))
  WHERE entity='cash_movements' AND COALESCE(data->>'operation_id','')<>'';
