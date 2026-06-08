-- ============================================================================
-- CASHPILE — Migration 017: Books Category Rules
-- Explicit merchant/category rules for bulk transaction categorization.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.books_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'equals')),
  category_id INTEGER NOT NULL REFERENCES public.books_categories(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'learned', 'system')),
  match_count INTEGER NOT NULL DEFAULT 0,
  last_matched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, pattern)
);

ALTER TABLE public.books_category_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "books_category_rules_select_own" ON public.books_category_rules;
DROP POLICY IF EXISTS "books_category_rules_insert_own" ON public.books_category_rules;
DROP POLICY IF EXISTS "books_category_rules_update_own" ON public.books_category_rules;
DROP POLICY IF EXISTS "books_category_rules_delete_own" ON public.books_category_rules;

CREATE POLICY "books_category_rules_select_own" ON public.books_category_rules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books_category_rules_insert_own" ON public.books_category_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books_category_rules_update_own" ON public.books_category_rules
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "books_category_rules_delete_own" ON public.books_category_rules
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_books_category_rules_user_id
  ON public.books_category_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_books_category_rules_category_id
  ON public.books_category_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_books_category_rules_active_priority
  ON public.books_category_rules(user_id, is_active, priority DESC);

DROP TRIGGER IF EXISTS update_books_category_rules_updated_at ON public.books_category_rules;
CREATE TRIGGER update_books_category_rules_updated_at
  BEFORE UPDATE ON public.books_category_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
