ALTER TABLE nexo.users
  ADD COLUMN IF NOT EXISTS cash_closing_schedule jsonb NOT NULL DEFAULT '{}'::jsonb;

-- statement-breakpoint
UPDATE nexo.users
SET cash_closing_schedule = jsonb_build_object(
  '0', to_char(cash_closing_min_time, 'HH24:MI'),
  '1', to_char(cash_closing_min_time, 'HH24:MI'),
  '2', to_char(cash_closing_min_time, 'HH24:MI'),
  '3', to_char(cash_closing_min_time, 'HH24:MI'),
  '4', to_char(cash_closing_min_time, 'HH24:MI'),
  '5', to_char(cash_closing_min_time, 'HH24:MI'),
  '6', to_char(cash_closing_min_time, 'HH24:MI')
)
WHERE cash_closing_time_enabled = true
  AND cash_closing_min_time IS NOT NULL
  AND cash_closing_schedule = '{}'::jsonb;

-- statement-breakpoint
ALTER TABLE nexo.users
  DROP CONSTRAINT IF EXISTS nexo_users_cash_closing_schedule_object;

-- statement-breakpoint
ALTER TABLE nexo.users
  ADD CONSTRAINT nexo_users_cash_closing_schedule_object
  CHECK (jsonb_typeof(cash_closing_schedule) = 'object');
