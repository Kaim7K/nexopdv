CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#17a06a',
  secondary_color text NOT NULL DEFAULT '#1e2532',
  enabled_modules jsonb NOT NULL DEFAULT '["pdv","estoque","vendas","fiados","relatorios","auditoria","usuarios","configuracoes"]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  next_sale_number bigint NOT NULL DEFAULT 1,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_markets_slug_uidx ON nexo.markets (slug);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES nexo.markets(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'vendedor',
  photo_url text,
  active boolean NOT NULL DEFAULT true,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_users_email_lower_uidx ON nexo.users (lower(email));
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_users_market_idx ON nexo.users (market_id) WHERE market_id IS NOT NULL;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  entity text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_records_market_entity_idx ON nexo.records (market_id, entity, updated_date DESC);
