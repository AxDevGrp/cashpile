-- ============================================================================
-- CASHPILE — Migration 012: Plaid Account Uniqueness
-- Ensures future Plaid account upserts have a stable database-level key.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_financial_accounts_plaid_account_id_unique
  ON public.books_financial_accounts(plaid_account_id)
  WHERE plaid_account_id IS NOT NULL;
