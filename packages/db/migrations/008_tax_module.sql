-- ============================================================================
-- CASHPILE — Migration 008: Tax Module
-- books_tax_transaction_views — links transactions to UDAs for tax purposes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.books_tax_transaction_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    uda_id UUID NOT NULL REFERENCES public.books_udas(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.books_transactions(id) ON DELETE CASCADE,
    tax_amount DECIMAL(14,2),
    tax_description TEXT,
    tax_date DATE,
    is_tax_deductible BOOLEAN DEFAULT false,
    business_percentage INTEGER DEFAULT 100 CHECK (business_percentage BETWEEN 0 AND 100),
    deduction_percentage INTEGER DEFAULT 100 CHECK (deduction_percentage BETWEEN 0 AND 100),
    tax_notes TEXT,
    category_id INTEGER REFERENCES public.books_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(uda_id, transaction_id)
);

ALTER TABLE public.books_tax_transaction_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_tax_views_select_own" ON public.books_tax_transaction_views
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books_tax_views_insert_own" ON public.books_tax_transaction_views
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books_tax_views_update_own" ON public.books_tax_transaction_views
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "books_tax_views_delete_own" ON public.books_tax_transaction_views
    FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_books_tax_views_updated_at
    BEFORE UPDATE ON public.books_tax_transaction_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_books_tax_views_user_id ON public.books_tax_transaction_views(user_id);
CREATE INDEX IF NOT EXISTS idx_books_tax_views_uda_id ON public.books_tax_transaction_views(uda_id);
CREATE INDEX IF NOT EXISTS idx_books_tax_views_tax_date ON public.books_tax_transaction_views(tax_date);
