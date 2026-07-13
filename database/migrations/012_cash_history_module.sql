UPDATE nexo.plans
SET enabled_modules = enabled_modules || '["caixas"]'::jsonb,
    updated_date = now()
WHERE enabled_modules ? 'pdv' AND NOT (enabled_modules ? 'caixas');
-- statement-breakpoint
UPDATE nexo.markets
SET enabled_modules = enabled_modules || '["caixas"]'::jsonb,
    updated_date = now()
WHERE enabled_modules ? 'pdv' AND NOT (enabled_modules ? 'caixas');
