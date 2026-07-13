ALTER TABLE nexo.markets ADD COLUMN IF NOT EXISTS next_purchase_number bigint NOT NULL DEFAULT 1;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('expense','revenue','both')),
  system_key text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_finance_categories_name_uidx ON nexo.finance_categories(market_id,lower(name),type);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES nexo.market_units(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('cash','bank','digital','wallet','safe','pix','card_receivable')),
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_finance_accounts_name_uidx ON nexo.finance_accounts(market_id,lower(name));
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_finance_accounts_default_uidx ON nexo.finance_accounts(market_id) WHERE is_default AND active;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_finance_suppliers_name_uidx ON nexo.finance_suppliers(market_id,lower(name));
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES nexo.market_units(id) ON DELETE SET NULL,
  account_id uuid REFERENCES nexo.finance_accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES nexo.finance_categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES nexo.finance_suppliers(id) ON DELETE SET NULL,
  transaction_type text NOT NULL DEFAULT 'expense' CHECK (transaction_type IN ('expense','revenue')),
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  amount_kind text NOT NULL DEFAULT 'fixed' CHECK (amount_kind IN ('fixed','estimated')),
  frequency text NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','yearly')),
  start_date date NOT NULL,
  end_date date,
  due_day integer CHECK (due_day BETWEEN 1 AND 31),
  next_due_date date NOT NULL,
  payment_method text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES nexo.market_units(id) ON DELETE SET NULL,
  account_id uuid REFERENCES nexo.finance_accounts(id) ON DELETE SET NULL,
  transfer_account_id uuid REFERENCES nexo.finance_accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES nexo.finance_categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES nexo.finance_suppliers(id) ON DELETE SET NULL,
  recurring_rule_id uuid REFERENCES nexo.finance_recurring_rules(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('expense','revenue','transfer','loss','adjustment')),
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= amount),
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  settled_at timestamptz,
  payment_method text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','overdue','cancelled','reversed')),
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','purchase','stock_loss','recurring','opening','external')),
  origin_id uuid,
  attachment_url text,
  notes text,
  created_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  cancelled_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CHECK (due_date IS NULL OR due_date >= issue_date),
  CHECK (type <> 'transfer' OR (account_id IS NOT NULL AND transfer_account_id IS NOT NULL AND account_id <> transfer_account_id))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_finance_transactions_period_idx ON nexo.finance_transactions(market_id,issue_date DESC,status);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_finance_transactions_due_idx ON nexo.finance_transactions(market_id,due_date,status) WHERE status IN ('pending','partial','overdue');
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_finance_transactions_recurring_due_uidx ON nexo.finance_transactions(market_id,recurring_rule_id,due_date) WHERE recurring_rule_id IS NOT NULL;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES nexo.finance_transactions(id) ON DELETE RESTRICT,
  account_id uuid REFERENCES nexo.finance_accounts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  payment_method text,
  notes text,
  attachment_url text,
  created_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  reversed_at timestamptz,
  reversed_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  reversal_reason text,
  created_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_finance_payments_transaction_idx ON nexo.finance_payments(transaction_id,paid_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_transaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES nexo.finance_transactions(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  actor_id uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS nexo_finance_events_market_idx ON nexo.finance_transaction_events(market_id,created_date DESC);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES nexo.market_units(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES nexo.finance_suppliers(id) ON DELETE SET NULL,
  account_id uuid REFERENCES nexo.finance_accounts(id) ON DELETE SET NULL,
  purchase_number bigint NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','cancelled')),
  issue_date date NOT NULL DEFAULT current_date,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  freight numeric(14,2) NOT NULL DEFAULT 0 CHECK (freight >= 0),
  total numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  payment_method text,
  installments jsonb NOT NULL DEFAULT '[]'::jsonb,
  invoice_number text,
  attachment_url text,
  notes text,
  created_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  confirmed_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  cancelled_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_id,purchase_number)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES nexo.finance_purchases(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES nexo.records(id) ON DELETE RESTRICT,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14,4) NOT NULL CHECK (unit_cost >= 0),
  total numeric(14,2) NOT NULL CHECK (total >= 0)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES nexo.market_units(id) ON DELETE SET NULL,
  category_id uuid REFERENCES nexo.finance_categories(id) ON DELETE SET NULL,
  period text NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
  type text NOT NULL CHECK (type IN ('revenue','profit','expense_limit','category_limit','loss_reduction','margin')),
  target_value numeric(14,2) NOT NULL CHECK (target_value >= 0),
  created_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS nexo_finance_goals_scope_uidx ON nexo.finance_goals(market_id,period,type,COALESCE(category_id,'00000000-0000-0000-0000-000000000000'::uuid),COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid));
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_settings (
  market_id uuid PRIMARY KEY REFERENCES nexo.markets(id) ON DELETE CASCADE,
  tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
  debit_card_fee numeric(7,4) NOT NULL DEFAULT 0 CHECK (debit_card_fee BETWEEN 0 AND 100),
  credit_card_fee numeric(7,4) NOT NULL DEFAULT 0 CHECK (credit_card_fee BETWEEN 0 AND 100),
  alert_days integer NOT NULL DEFAULT 3 CHECK (alert_days BETWEEN 0 AND 90),
  currency text NOT NULL DEFAULT 'BRL',
  timezone text NOT NULL DEFAULT 'America/Bahia',
  email_alerts boolean NOT NULL DEFAULT false,
  payment_account_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS nexo.finance_user_permissions (
  user_id uuid PRIMARY KEY REFERENCES nexo.users(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES nexo.markets(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES nexo.users(id) ON DELETE SET NULL,
  updated_date timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
INSERT INTO nexo.finance_accounts(market_id,name,type,is_default)
SELECT id,'Caixa principal','cash',true FROM nexo.markets
ON CONFLICT DO NOTHING;
-- statement-breakpoint
INSERT INTO nexo.finance_settings(market_id)
SELECT id FROM nexo.markets ON CONFLICT DO NOTHING;
-- statement-breakpoint
UPDATE nexo.finance_settings setting
SET payment_account_map=jsonb_build_object(
  'dinheiro',account.id,'pix',account.id,'debito',account.id,'credito',account.id,'outros',account.id
),updated_date=now()
FROM nexo.finance_accounts account
WHERE account.market_id=setting.market_id AND account.is_default AND setting.payment_account_map='{}'::jsonb;
-- statement-breakpoint
INSERT INTO nexo.finance_categories(market_id,name,type,system_key)
SELECT market.id,category.name,'expense',category.key
FROM nexo.markets market CROSS JOIN (VALUES
 ('Compra de mercadorias','merchandise'),('Aluguel','rent'),('Energia','energy'),('Água','water'),
 ('Internet','internet'),('Funcionários','payroll'),('Impostos','taxes'),('Manutenção','maintenance'),
 ('Transporte','transport'),('Materiais de limpeza','cleaning'),('Equipamentos','equipment'),
 ('Marketing','marketing'),('Taxas bancárias','bank_fees'),('Taxas de cartão','card_fees'),
 ('Perdas e avarias','losses'),('Outras despesas','other_expense')
) AS category(name,key)
ON CONFLICT DO NOTHING;
-- statement-breakpoint
INSERT INTO nexo.finance_categories(market_id,name,type,system_key)
SELECT market.id,category.name,'revenue',category.key
FROM nexo.markets market CROSS JOIN (VALUES
 ('Venda externa','external_sale'),('Bonificação de fornecedor','supplier_bonus'),('Crédito recebido','credit'),
 ('Reembolso','refund'),('Aluguel de espaço','space_rent'),('Outras receitas','other_revenue')
) AS category(name,key)
ON CONFLICT DO NOTHING;
-- statement-breakpoint
UPDATE nexo.plans SET enabled_modules=enabled_modules || '["financeiro"]'::jsonb,updated_date=now()
WHERE enabled_modules ? 'relatorios' AND NOT (enabled_modules ? 'financeiro');
-- statement-breakpoint
UPDATE nexo.markets SET enabled_modules=enabled_modules || '["financeiro"]'::jsonb,updated_date=now()
WHERE enabled_modules ? 'relatorios' AND NOT (enabled_modules ? 'financeiro');
