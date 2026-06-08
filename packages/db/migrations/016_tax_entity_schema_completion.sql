-- ============================================================================
-- CASHPILE — Migration 016: Complete Tax Entity Schema
-- Ensure live DB matches app code after tax entity refactor.
-- ============================================================================

-- Tax views now link directly to books_business_entities.
ALTER TABLE public.books_tax_transaction_views
  ADD COLUMN IF NOT EXISTS tax_entity_id UUID REFERENCES public.books_business_entities(id) ON DELETE CASCADE;

-- Backfill from legacy UDA IDs where those IDs are now business entities.
UPDATE public.books_tax_transaction_views tv
SET tax_entity_id = tv.uda_id
WHERE tv.tax_entity_id IS NULL
  AND tv.uda_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.books_business_entities be
    WHERE be.id = tv.uda_id
  );

-- New app code writes tax_entity_id and no longer writes uda_id.
ALTER TABLE public.books_tax_transaction_views
  ALTER COLUMN uda_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_books_tax_views_tax_entity_id
  ON public.books_tax_transaction_views(tax_entity_id);

ALTER TABLE public.books_tax_transaction_views
  DROP CONSTRAINT IF EXISTS books_tax_transaction_views_uda_id_transaction_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'books_tax_transaction_views_tax_entity_id_transaction_id_key'
      AND conrelid = 'public.books_tax_transaction_views'::regclass
  ) THEN
    ALTER TABLE public.books_tax_transaction_views
      ADD CONSTRAINT books_tax_transaction_views_tax_entity_id_transaction_id_key
      UNIQUE (tax_entity_id, transaction_id);
  END IF;
END $$;

-- Rules used by the tax assignment UI and Plaid auto-assignment path.
CREATE TABLE IF NOT EXISTS public.books_tax_assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'equals')),
  tax_entity_id UUID NOT NULL REFERENCES public.books_business_entities(id) ON DELETE CASCADE,
  business_percentage INTEGER NOT NULL DEFAULT 100 CHECK (business_percentage BETWEEN 0 AND 100),
  deduction_percentage INTEGER NOT NULL DEFAULT 100 CHECK (deduction_percentage BETWEEN 0 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.books_tax_assignment_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "books_tax_rules_select_own" ON public.books_tax_assignment_rules;
DROP POLICY IF EXISTS "books_tax_rules_insert_own" ON public.books_tax_assignment_rules;
DROP POLICY IF EXISTS "books_tax_rules_update_own" ON public.books_tax_assignment_rules;
DROP POLICY IF EXISTS "books_tax_rules_delete_own" ON public.books_tax_assignment_rules;

CREATE POLICY "books_tax_rules_select_own" ON public.books_tax_assignment_rules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books_tax_rules_insert_own" ON public.books_tax_assignment_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books_tax_rules_update_own" ON public.books_tax_assignment_rules
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "books_tax_rules_delete_own" ON public.books_tax_assignment_rules
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_books_tax_rules_user_id
  ON public.books_tax_assignment_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_books_tax_rules_tax_entity_id
  ON public.books_tax_assignment_rules(tax_entity_id);
CREATE INDEX IF NOT EXISTS idx_books_tax_rules_active_priority
  ON public.books_tax_assignment_rules(user_id, is_active, priority DESC);

DROP TRIGGER IF EXISTS update_books_tax_rules_updated_at ON public.books_tax_assignment_rules;
CREATE TRIGGER update_books_tax_rules_updated_at
  BEFORE UPDATE ON public.books_tax_assignment_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
