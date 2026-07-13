CREATE TABLE IF NOT EXISTS nexo.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  monthly_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 365),
  user_limit integer CHECK (user_limit IS NULL OR user_limit > 0),
  product_limit integer CHECK (product_limit IS NULL OR product_limit > 0),
  unit_limit integer CHECK (unit_limit IS NULL OR unit_limit > 0),
  enabled_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_plans_name_lower_uidx ON nexo.plans(lower(name));
-- statement-breakpoint
ALTER TABLE nexo.markets
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES nexo.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_due_date date,
  ADD COLUMN IF NOT EXISTS user_limit integer,
  ADD COLUMN IF NOT EXISTS product_limit integer,
  ADD COLUMN IF NOT EXISTS unit_limit integer,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS email_footer text;
-- statement-breakpoint
UPDATE nexo.markets SET status=CASE WHEN active THEN 'ativo' ELSE 'suspenso' END WHERE status IS NULL OR status NOT IN ('ativo','suspenso','teste','cancelado');
-- statement-breakpoint
ALTER TABLE nexo.markets DROP CONSTRAINT IF EXISTS nexo_markets_status_check;
-- statement-breakpoint
ALTER TABLE nexo.markets ADD CONSTRAINT nexo_markets_status_check CHECK (status IN ('ativo','suspenso','teste','cancelado'));
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.market_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_market_units_code_uidx ON nexo.market_units(market_id, lower(code));
-- statement-breakpoint
INSERT INTO nexo.market_units(market_id,name,code)
SELECT id,'Unidade principal','principal' FROM nexo.markets
ON CONFLICT DO NOTHING;
-- statement-breakpoint
ALTER TABLE nexo.users ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES nexo.market_units(id) ON DELETE SET NULL;
-- statement-breakpoint
UPDATE nexo.users current_user SET unit_id=unit.id
FROM nexo.market_units unit
WHERE current_user.market_id=unit.market_id AND current_user.unit_id IS NULL AND lower(unit.code)='principal';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_users_market_unit_idx ON nexo.users(market_id,unit_id) WHERE market_id IS NOT NULL;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES nexo.plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'teste' CHECK (status IN ('teste','ativa','inadimplente','cancelada','suspensa')),
  monthly_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_subscriptions_current_market_uidx ON nexo.subscriptions(market_id) WHERE status IN ('teste','ativa','inadimplente','suspensa');
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_subscriptions_status_due_idx ON nexo.subscriptions(status,current_period_ends_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES nexo.subscriptions(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  due_date date NOT NULL,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','vencido','estornado')),
  external_reference text,
  notes text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_subscription_payments_status_due_idx ON nexo.subscription_payments(status,due_date);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.market_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_market_change_log_market_created_idx ON nexo.market_change_log(market_id,created_date DESC);
-- statement-breakpoint
INSERT INTO nexo.records(market_id,entity,data)
SELECT duplicate.market_id,'general_audits',jsonb_build_object(
  'action_type','codigo_barras_duplicado_corrigido',
  'entity_type','product',
  'entity_id',duplicate.id,
  'user_name','Migração do sistema',
  'description','Código de barras duplicado removido para preservar a integridade do estoque',
  'details',jsonb_build_object('barcode',duplicate.barcode,'kept_product_id',duplicate.kept_id)
)
FROM (
  SELECT id,market_id,data->>'barcode' AS barcode,
    first_value(id) OVER (PARTITION BY market_id,btrim(data->>'barcode') ORDER BY created_date,id) AS kept_id,
    row_number() OVER (PARTITION BY market_id,btrim(data->>'barcode') ORDER BY created_date,id) AS position
  FROM nexo.records
  WHERE entity='products' AND nullif(btrim(data->>'barcode'),'') IS NOT NULL
) duplicate
WHERE duplicate.position > 1;
-- statement-breakpoint
WITH duplicates AS (
  SELECT id,row_number() OVER (PARTITION BY market_id,btrim(data->>'barcode') ORDER BY created_date,id) AS position
  FROM nexo.records
  WHERE entity='products' AND nullif(btrim(data->>'barcode'),'') IS NOT NULL
)
UPDATE nexo.records product SET data=product.data-'barcode',updated_date=now()
FROM duplicates WHERE duplicates.id=product.id AND duplicates.position>1;
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_products_market_barcode_uidx
  ON nexo.records(market_id,btrim(data->>'barcode'))
  WHERE entity='products' AND nullif(btrim(data->>'barcode'),'') IS NOT NULL;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_cash_sessions_history_idx
  ON nexo.records(market_id,(data->>'status'),(data->>'opened_at') DESC)
  WHERE entity='cash_sessions';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_cash_movements_session_idx
  ON nexo.records(market_id,(data->>'cash_session_id'),created_date)
  WHERE entity='cash_movements';
