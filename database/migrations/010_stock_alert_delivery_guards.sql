CREATE UNIQUE INDEX IF NOT EXISTS nexo_stock_alert_delivery_key_uidx
  ON nexo.records (market_id, entity, (data->>'delivery_key'))
  WHERE entity='stock_alert_deliveries' AND COALESCE(data->>'delivery_key','')<>'';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_stock_alert_recipients_market_idx
  ON nexo.records (market_id, updated_date DESC)
  WHERE entity='stock_alert_recipients';
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_stock_alert_recipient_email_uidx
  ON nexo.records (market_id, lower(data->>'email'))
  WHERE entity='stock_alert_recipients' AND COALESCE(data->>'email','')<>'';
