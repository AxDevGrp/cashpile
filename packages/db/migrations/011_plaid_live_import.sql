-- ============================================================================
-- CASHPILE — Migration 011: Plaid Live Import Hardening
-- Makes Plaid item/account/transaction mapping stable for live imports.
-- ============================================================================

ALTER TABLE public.books_plaid_items
  ADD COLUMN IF NOT EXISTS tax_entity_id UUID REFERENCES public.books_business_entities(id) ON DELETE SET NULL;

ALTER TABLE public.books_financial_accounts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tax_entity_id UUID REFERENCES public.books_business_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plaid_account_id TEXT,
  ADD COLUMN IF NOT EXISTS plaid_item_id UUID REFERENCES public.books_plaid_items(id) ON DELETE SET NULL;

ALTER TABLE public.books_financial_accounts
  ALTER COLUMN uda_id DROP NOT NULL;

UPDATE public.books_financial_accounts fa
SET user_id = u.user_id
FROM public.books_udas u
WHERE fa.user_id IS NULL AND fa.uda_id = u.id;

UPDATE public.books_financial_accounts fa
SET user_id = pi.user_id
FROM public.books_plaid_items pi
WHERE fa.user_id IS NULL AND fa.plaid_item_id = pi.id;

ALTER TABLE public.books_transactions
  ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_transactions_user_plaid_txn
  ON public.books_transactions(user_id, plaid_transaction_id);

CREATE INDEX IF NOT EXISTS idx_books_plaid_items_tax_entity_id
  ON public.books_plaid_items(tax_entity_id);

CREATE INDEX IF NOT EXISTS idx_books_financial_accounts_user_id
  ON public.books_financial_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_books_financial_accounts_plaid_item_id
  ON public.books_financial_accounts(plaid_item_id);
