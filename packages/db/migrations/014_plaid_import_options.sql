-- ============================================================================
-- CASHPILE — Migration 014: Plaid Import Options
-- Stores user-selected import intent for audit/debugging of Plaid connections.
-- ============================================================================

ALTER TABLE public.books_plaid_items
  ADD COLUMN IF NOT EXISTS import_options JSONB DEFAULT '{}'::jsonb;
