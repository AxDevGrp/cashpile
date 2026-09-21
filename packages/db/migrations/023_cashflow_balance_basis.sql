-- ============================================================================
-- CASHPILE — Migration 023: Cashflow balance basis (WP1)
-- Store Plaid's available balance alongside current balance so spendable
-- cash excludes pending holds. Fallback to current_balance when null.
-- ============================================================================

ALTER TABLE public.books_financial_accounts
  ADD COLUMN IF NOT EXISTS available_balance DECIMAL(14, 2);
