ALTER TABLE nexo.users ADD COLUMN IF NOT EXISTS password_reset_at timestamptz;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES nexo.users(id) ON DELETE CASCADE,
  password_fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_password_reset_user_idx ON nexo.password_reset_tokens(user_id, created_at DESC);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.password_reset_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);
