ALTER TABLE nexo.users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_users_active_email_idx ON nexo.users (lower(email)) WHERE active = true;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_markets_active_idx ON nexo.markets (id) WHERE active = true;
