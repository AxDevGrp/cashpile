-- ============================================================================
-- CASHPILE — Migration 015: Cash Flow Copilot MVP
-- Account cashflow roles and user buffer settings for safe-to-spend forecasting.
-- ============================================================================

ALTER TABLE public.books_financial_accounts
  ADD COLUMN IF NOT EXISTS cashflow_role TEXT CHECK (cashflow_role IN ('spending_source', 'reserve', 'credit_liability', 'investment', 'loan', 'ignore')),
  ADD COLUMN IF NOT EXISTS cashflow_include BOOLEAN DEFAULT true;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS minimum_cash_buffer DECIMAL(14, 2);

CREATE INDEX IF NOT EXISTS idx_books_financial_accounts_cashflow_role
  ON public.books_financial_accounts(user_id, cashflow_role);
