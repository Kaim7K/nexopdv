ALTER TABLE nexo.plans ADD COLUMN IF NOT EXISTS enabled_features jsonb NOT NULL DEFAULT '[]'::jsonb;
-- statement-breakpoint
ALTER TABLE nexo.markets ADD COLUMN IF NOT EXISTS enabled_features jsonb NOT NULL DEFAULT '[]'::jsonb;
-- statement-breakpoint
UPDATE nexo.plans SET enabled_features='["email_sending","email_branding","market_logo","sidebar_customization","automatic_image_search","product_image_upload","stock_email_alerts","quick_product_creation","report_export","recurring_finance","integrated_purchases","financial_email_alerts"]'::jsonb WHERE enabled_features='[]'::jsonb;
-- statement-breakpoint
UPDATE nexo.markets SET enabled_features='["email_sending","email_branding","market_logo","sidebar_customization","automatic_image_search","product_image_upload","stock_email_alerts","quick_product_creation","report_export","recurring_finance","integrated_purchases","financial_email_alerts"]'::jsonb WHERE enabled_features='[]'::jsonb;
