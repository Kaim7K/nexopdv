ALTER TABLE nexo.finance_transactions
  DROP CONSTRAINT IF EXISTS finance_transactions_origin_check;

-- statement-breakpoint
ALTER TABLE nexo.finance_transactions
  ADD CONSTRAINT finance_transactions_origin_check
  CHECK (origin IN (
    'manual','purchase','stock_loss','recurring','opening','external',
    'cash_close','cash_close_entry','cash_movement','fiado_settlement'
  ));

-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_finance_cash_close_entry_origin_uidx
  ON nexo.finance_transactions(market_id,origin,origin_id)
  WHERE origin='cash_close_entry' AND origin_id IS NOT NULL;
