ALTER TABLE nexo.users
  ADD COLUMN IF NOT EXISTS cash_closing_time_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cash_closing_min_time time;
