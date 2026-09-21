-- ============================================================================
-- CASHPILE — Migration 024: Cashflow persistence (WP2)
-- User-confirmed recurring items with stable identity, cashflow action state,
-- essential allowance / emergency target settings, and emergency reserve flag.
-- All new tables are owner-scoped by RLS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cashflow_recurring_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  merchant TEXT NOT NULL DEFAULT '',
  description_pattern TEXT NOT NULL DEFAULT '',
  amount_bucket INTEGER NOT NULL DEFAULT 0,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'twice_monthly', 'monthly', 'quarterly', 'annual', 'irregular')),
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  next_date DATE,
  anchor_days_of_month INTEGER[],
  account_ids UUID[],
  included BOOLEAN NOT NULL DEFAULT true,
  confirmed_at TIMESTAMPTZ,
  flow_kind TEXT CHECK (flow_kind IN ('standard', 'internal_transfer', 'card_payment')),
  counterparty_account_ids UUID[],
  is_subscription BOOLEAN NOT NULL DEFAULT false,
  review_status TEXT CHECK (review_status IN ('keep', 'review', 'cancel_help')),
  last_seen_date DATE,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('detected', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, stable_key)
);

ALTER TABLE public.cashflow_recurring_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage their own cashflow recurring items"
  ON public.cashflow_recurring_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cashflow_recurring_items_user
  ON public.cashflow_recurring_items(user_id);

CREATE TRIGGER update_cashflow_recurring_items_updated_at BEFORE UPDATE ON public.cashflow_recurring_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.cashflow_action_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, action_key)
);

ALTER TABLE public.cashflow_action_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage their own cashflow action state"
  ON public.cashflow_action_state
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_cashflow_action_state_updated_at BEFORE UPDATE ON public.cashflow_action_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS essential_weekly_allowance DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS emergency_target_months DECIMAL(5, 2);

ALTER TABLE public.books_financial_accounts
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT false;