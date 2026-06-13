-- ============================================================================
-- CASHPILE — Migration 020: Account-Scoped Book Rules
-- Allows AI/manual category and tax rules to be scoped to one financial account.
-- ============================================================================

ALTER TABLE public.books_category_rules
  ADD COLUMN IF NOT EXISTS financial_account_id UUID REFERENCES public.books_financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.books_tax_assignment_rules
  ADD COLUMN IF NOT EXISTS financial_account_id UUID REFERENCES public.books_financial_accounts(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'books_category_rules_user_id_pattern_key'
      AND conrelid = 'public.books_category_rules'::regclass
  ) THEN
    ALTER TABLE public.books_category_rules
      DROP CONSTRAINT books_category_rules_user_id_pattern_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_category_rules_unique_global_pattern
  ON public.books_category_rules(user_id, pattern)
  WHERE financial_account_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_category_rules_unique_account_pattern
  ON public.books_category_rules(user_id, financial_account_id, pattern)
  WHERE financial_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_tax_rules_unique_global_pattern
  ON public.books_tax_assignment_rules(user_id, pattern, tax_entity_id)
  WHERE financial_account_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_tax_rules_unique_account_pattern
  ON public.books_tax_assignment_rules(user_id, financial_account_id, pattern, tax_entity_id)
  WHERE financial_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_books_category_rules_account_id
  ON public.books_category_rules(financial_account_id);

CREATE INDEX IF NOT EXISTS idx_books_tax_rules_account_id
  ON public.books_tax_assignment_rules(financial_account_id);
