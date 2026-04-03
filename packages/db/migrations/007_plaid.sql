-- ============================================================================
-- Migration 007: Plaid Integration
-- Run in Cashpile Supabase SQL editor
-- ============================================================================

-- Plaid connected items (one per institution connection)
CREATE TABLE IF NOT EXISTS public.books_plaid_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uda_id            UUID        REFERENCES public.books_udas(id) ON DELETE SET NULL,
  access_token      TEXT        NOT NULL,
  item_id           TEXT        NOT NULL UNIQUE,
  institution_name  TEXT,
  institution_id    TEXT,
  cursor            TEXT,
  status            TEXT        NOT NULL DEFAULT 'active', -- active | error | disconnected
  error_code        TEXT,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.books_plaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage their own plaid items"
  ON public.books_plaid_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add plaid_account_id to financial accounts for mapping
ALTER TABLE public.books_financial_accounts
  ADD COLUMN IF NOT EXISTS plaid_account_id TEXT,
  ADD COLUMN IF NOT EXISTS plaid_item_id     UUID REFERENCES public.books_plaid_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_plaid_items_user    ON public.books_plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id ON public.books_plaid_items(item_id);
CREATE INDEX IF NOT EXISTS idx_fa_plaid_account_id ON public.books_financial_accounts(plaid_account_id);
