-- ============================================================================
-- CASHPILE — Migration 026: books_transactions.notes
-- The agent executor and orchestrator tools already select this column; the
-- column never existed, so those paths failed at runtime. Adds it now.
-- ============================================================================

ALTER TABLE public.books_transactions
  ADD COLUMN IF NOT EXISTS notes TEXT;