-- ============================================================================
-- CASHPILE — Migration 009: Tax Entity Refactor
-- Clarify separation between Financial Accounts and Tax Entities
-- ============================================================================

-- ============================================================================
-- PART 1: Add tax_entity_id to books_financial_accounts
-- ============================================================================

-- Add the new column (nullable, since not all accounts belong to a tax entity)
ALTER TABLE public.books_financial_accounts
    ADD COLUMN IF NOT EXISTS tax_entity_id UUID REFERENCES public.books_business_entities(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_books_financial_accounts_tax_entity_id 
    ON public.books_financial_accounts(tax_entity_id);

-- ============================================================================
-- PART 2: Migrate existing UDA data to Tax Entities
-- ============================================================================

-- Migrate books_udas to books_business_entities if they don't already exist
-- This preserves existing UDAs as Tax Entities
INSERT INTO public.books_business_entities (
    id,
    user_id,
    name,
    entity_type,
    tax_id,
    address,
    description,
    is_active,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.user_id,
    u.name,
    'sole_proprietorship'::TEXT as entity_type, -- Default type, user can change later
    NULL as tax_id,
    NULL as address,
    u.description,
    TRUE as is_active,
    u.created_at,
    u.updated_at
FROM public.books_udas u
LEFT JOIN public.books_business_entities be ON be.id = u.id
WHERE be.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Update financial accounts to link to their tax entity (from uda_id)
UPDATE public.books_financial_accounts fa
SET tax_entity_id = fa.uda_id::UUID
WHERE fa.tax_entity_id IS NULL 
  AND fa.uda_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.books_business_entities be WHERE be.id = fa.uda_id::UUID);

-- ============================================================================
-- PART 3: Update books_tax_transaction_views to use tax_entity_id
-- ============================================================================

-- Add tax_entity_id column
ALTER TABLE public.books_tax_transaction_views
    ADD COLUMN IF NOT EXISTS tax_entity_id UUID REFERENCES public.books_business_entities(id) ON DELETE CASCADE;

-- Migrate existing data: uda_id -> tax_entity_id
UPDATE public.books_tax_transaction_views tv
SET tax_entity_id = tv.uda_id
WHERE tv.tax_entity_id IS NULL AND tv.uda_id IS NOT NULL;

-- Create index on new column
CREATE INDEX IF NOT EXISTS idx_books_tax_views_tax_entity_id 
    ON public.books_tax_transaction_views(tax_entity_id);

-- Update unique constraint
ALTER TABLE public.books_tax_transaction_views 
    DROP CONSTRAINT IF EXISTS books_tax_transaction_views_uda_id_transaction_id_key;

ALTER TABLE public.books_tax_transaction_views
    ADD CONSTRAINT books_tax_transaction_views_tax_entity_id_transaction_id_key 
    UNIQUE (tax_entity_id, transaction_id);

-- ============================================================================
-- PART 4: Update RLS policies for books_tax_transaction_views
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "books_tax_views_select_own" ON public.books_tax_transaction_views;
DROP POLICY IF EXISTS "books_tax_views_insert_own" ON public.books_tax_transaction_views;
DROP POLICY IF EXISTS "books_tax_views_update_own" ON public.books_tax_transaction_views;
DROP POLICY IF EXISTS "books_tax_views_delete_own" ON public.books_tax_transaction_views;

-- Create new policies using user_id (which we already have)
CREATE POLICY "books_tax_views_select_own" ON public.books_tax_transaction_views
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "books_tax_views_insert_own" ON public.books_tax_transaction_views
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "books_tax_views_update_own" ON public.books_tax_transaction_views
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "books_tax_views_delete_own" ON public.books_tax_transaction_views
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- PART 5: Create helper view for account-to-entity relationships
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_accounts_by_tax_entity AS
SELECT 
    fa.id as account_id,
    fa.name as account_name,
    fa.account_type,
    fa.institution_name,
    fa.last_four_digits,
    fa.current_balance,
    fa.is_active,
    fa.created_at as account_created_at,
    be.id as tax_entity_id,
    be.name as tax_entity_name,
    be.entity_type as tax_entity_type,
    be.tax_id as tax_entity_tax_id,
    u.id as user_id
FROM public.books_financial_accounts fa
LEFT JOIN public.books_business_entities be ON be.id = fa.tax_entity_id
LEFT JOIN public.books_udas u ON u.id = fa.uda_id
WHERE u.user_id = auth.uid() OR be.user_id = auth.uid();

-- ============================================================================
-- PART 6: Verification
-- ============================================================================

-- Show migration summary
SELECT 
    'Financial accounts with tax_entity_id' as check_item,
    COUNT(*) as count
FROM public.books_financial_accounts 
WHERE tax_entity_id IS NOT NULL

UNION ALL

SELECT 
    'Tax views with tax_entity_id' as check_item,
    COUNT(*) as count
FROM public.books_tax_transaction_views 
WHERE tax_entity_id IS NOT NULL

UNION ALL

SELECT 
    'Business entities from UDAs' as check_item,
    COUNT(*) as count
FROM public.books_business_entities be
WHERE EXISTS (SELECT 1 FROM public.books_udas u WHERE u.id = be.id);
