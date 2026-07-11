UPDATE nexo.markets
SET primary_color = '#16a06a', updated_date = now()
WHERE lower(primary_color) = '#17a06a';
-- statement-breakpoint
UPDATE nexo.markets
SET secondary_color = '#0f5132', updated_date = now()
WHERE lower(secondary_color) = '#1e2532';
-- statement-breakpoint
ALTER TABLE nexo.markets ALTER COLUMN primary_color SET DEFAULT '#16a06a';
-- statement-breakpoint
ALTER TABLE nexo.markets ALTER COLUMN secondary_color SET DEFAULT '#0f5132';
