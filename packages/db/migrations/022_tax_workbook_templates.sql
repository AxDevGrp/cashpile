-- ============================================================================
-- CASHPILE — Migration 022: Tax Workbook Templates
-- Uploaded preparer workbooks, discovered fill targets, category mappings, and
-- generated export history for the Taxes workflow.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tax_workbook_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_year INTEGER,
  preparer_name TEXT,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'analyzed', 'mapped', 'archived', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tax_workbook_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.tax_workbook_templates(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  label TEXT NOT NULL,
  target_cell TEXT NOT NULL,
  target_range TEXT,
  target_type TEXT NOT NULL DEFAULT 'currency_total',
  detected_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.5,
  is_formula_cell BOOLEAN NOT NULL DEFAULT false,
  is_writable BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (template_id, sheet_name, target_cell)
);

CREATE TABLE IF NOT EXISTS public.tax_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.tax_workbook_templates(id) ON DELETE CASCADE,
  tax_year INTEGER,
  tax_entity_id UUID REFERENCES public.books_business_entities(id) ON DELETE CASCADE,
  entity_type TEXT,
  cashpile_category_id INTEGER REFERENCES public.books_categories(id) ON DELETE CASCADE,
  cashpile_category_name_snapshot TEXT NOT NULL,
  target_id UUID REFERENCES public.tax_workbook_targets(id) ON DELETE CASCADE,
  aggregation_rule TEXT NOT NULL DEFAULT 'sum_deductible_amount' CHECK (aggregation_rule IN ('sum_deductible_amount', 'sum_gross_amount')),
  deduction_percentage_override INTEGER CHECK (deduction_percentage_override BETWEEN 0 AND 100),
  is_ignored BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (is_ignored OR target_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.tax_workbook_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.tax_workbook_templates(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  tax_entity_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error')),
  output_storage_path TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.tax_workbook_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_workbook_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_workbook_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_workbook_templates_select_own" ON public.tax_workbook_templates;
DROP POLICY IF EXISTS "tax_workbook_templates_insert_own" ON public.tax_workbook_templates;
DROP POLICY IF EXISTS "tax_workbook_templates_update_own" ON public.tax_workbook_templates;
DROP POLICY IF EXISTS "tax_workbook_templates_delete_own" ON public.tax_workbook_templates;

CREATE POLICY "tax_workbook_templates_select_own" ON public.tax_workbook_templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tax_workbook_templates_insert_own" ON public.tax_workbook_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_workbook_templates_update_own" ON public.tax_workbook_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tax_workbook_templates_delete_own" ON public.tax_workbook_templates
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tax_workbook_targets_select_own" ON public.tax_workbook_targets;
DROP POLICY IF EXISTS "tax_workbook_targets_insert_own" ON public.tax_workbook_targets;
DROP POLICY IF EXISTS "tax_workbook_targets_update_own" ON public.tax_workbook_targets;
DROP POLICY IF EXISTS "tax_workbook_targets_delete_own" ON public.tax_workbook_targets;

CREATE POLICY "tax_workbook_targets_select_own" ON public.tax_workbook_targets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tax_workbook_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "tax_workbook_targets_insert_own" ON public.tax_workbook_targets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tax_workbook_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "tax_workbook_targets_update_own" ON public.tax_workbook_targets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tax_workbook_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "tax_workbook_targets_delete_own" ON public.tax_workbook_targets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tax_workbook_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tax_category_mappings_select_own" ON public.tax_category_mappings;
DROP POLICY IF EXISTS "tax_category_mappings_insert_own" ON public.tax_category_mappings;
DROP POLICY IF EXISTS "tax_category_mappings_update_own" ON public.tax_category_mappings;
DROP POLICY IF EXISTS "tax_category_mappings_delete_own" ON public.tax_category_mappings;

CREATE POLICY "tax_category_mappings_select_own" ON public.tax_category_mappings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tax_category_mappings_insert_own" ON public.tax_category_mappings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_category_mappings_update_own" ON public.tax_category_mappings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tax_category_mappings_delete_own" ON public.tax_category_mappings
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tax_workbook_exports_select_own" ON public.tax_workbook_exports;
DROP POLICY IF EXISTS "tax_workbook_exports_insert_own" ON public.tax_workbook_exports;
DROP POLICY IF EXISTS "tax_workbook_exports_update_own" ON public.tax_workbook_exports;
DROP POLICY IF EXISTS "tax_workbook_exports_delete_own" ON public.tax_workbook_exports;

CREATE POLICY "tax_workbook_exports_select_own" ON public.tax_workbook_exports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tax_workbook_exports_insert_own" ON public.tax_workbook_exports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_workbook_exports_update_own" ON public.tax_workbook_exports
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tax_workbook_exports_delete_own" ON public.tax_workbook_exports
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tax_workbook_templates_user_id
  ON public.tax_workbook_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_workbook_targets_template_id
  ON public.tax_workbook_targets(template_id);
CREATE INDEX IF NOT EXISTS idx_tax_category_mappings_lookup
  ON public.tax_category_mappings(user_id, template_id, tax_entity_id, cashpile_category_id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tax_workbook_exports_user_id
  ON public.tax_workbook_exports(user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_tax_workbook_templates_updated_at ON public.tax_workbook_templates;
CREATE TRIGGER update_tax_workbook_templates_updated_at
  BEFORE UPDATE ON public.tax_workbook_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tax_workbook_targets_updated_at ON public.tax_workbook_targets;
CREATE TRIGGER update_tax_workbook_targets_updated_at
  BEFORE UPDATE ON public.tax_workbook_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tax_category_mappings_updated_at ON public.tax_category_mappings;
CREATE TRIGGER update_tax_category_mappings_updated_at
  BEFORE UPDATE ON public.tax_category_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Private user-owned storage bucket for uploaded templates and generated exports.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tax-workbooks', 'tax-workbooks', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tax_workbook_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "tax_workbook_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "tax_workbook_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "tax_workbook_storage_delete_own" ON storage.objects;

CREATE POLICY "tax_workbook_storage_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tax-workbooks'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "tax_workbook_storage_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tax-workbooks'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "tax_workbook_storage_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'tax-workbooks'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "tax_workbook_storage_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tax-workbooks'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
