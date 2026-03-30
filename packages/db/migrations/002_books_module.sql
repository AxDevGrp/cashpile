-- ============================================================================
-- CASHPILE — Migration 002: Books Module
-- Accounting tables (rebuilt from stacks blueprint, namespaced as books_*)
-- ============================================================================

-- ── Books Categories (Chart of Accounts) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_categories (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category_type TEXT CHECK (category_type IN ('income', 'expense', 'asset', 'liability', 'equity', 'transfer')) DEFAULT 'expense',
    is_tax_deductible BOOLEAN DEFAULT false,
    color TEXT DEFAULT '#6B7280',
    icon TEXT DEFAULT 'folder',
    parent_category_id INTEGER REFERENCES public.books_categories(id),
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

ALTER TABLE public.books_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_categories_select_own" ON public.books_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books_categories_insert_own" ON public.books_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books_categories_update_own" ON public.books_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "books_categories_delete_own" ON public.books_categories FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_books_categories_updated_at BEFORE UPDATE ON public.books_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── UDAs (User-Defined Account Groups) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_udas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

ALTER TABLE public.books_udas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_udas_select_own" ON public.books_udas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books_udas_insert_own" ON public.books_udas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books_udas_update_own" ON public.books_udas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "books_udas_delete_own" ON public.books_udas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_books_udas_updated_at BEFORE UPDATE ON public.books_udas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Financial Accounts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uda_id UUID NOT NULL REFERENCES public.books_udas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card', 'investment', 'loan', 'other')) DEFAULT 'other',
    institution_name TEXT,
    last_four_digits TEXT,
    account_identifier TEXT,
    current_balance DECIMAL(14, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.books_financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_financial_accounts_select_own" ON public.books_financial_accounts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.books_udas u WHERE u.id = uda_id AND u.user_id = auth.uid())
    );
CREATE POLICY "books_financial_accounts_insert_own" ON public.books_financial_accounts
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.books_udas u WHERE u.id = uda_id AND u.user_id = auth.uid())
    );
CREATE POLICY "books_financial_accounts_update_own" ON public.books_financial_accounts
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.books_udas u WHERE u.id = uda_id AND u.user_id = auth.uid())
    );
CREATE POLICY "books_financial_accounts_delete_own" ON public.books_financial_accounts
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.books_udas u WHERE u.id = uda_id AND u.user_id = auth.uid())
    );

CREATE TRIGGER update_books_financial_accounts_updated_at BEFORE UPDATE ON public.books_financial_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Transactions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    financial_account_id UUID REFERENCES public.books_financial_accounts(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    date DATE NOT NULL,
    merchant TEXT,
    transaction_type TEXT CHECK (transaction_type IN ('debit', 'credit')) DEFAULT 'debit',
    category_id INTEGER REFERENCES public.books_categories(id),
    is_transfer BOOLEAN DEFAULT false,
    transfer_pair_id UUID,
    import_source TEXT CHECK (import_source IN ('csv', 'excel', 'plaid', 'manual')) DEFAULT 'manual',
    import_batch_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.books_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_transactions_select_own" ON public.books_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books_transactions_insert_own" ON public.books_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books_transactions_update_own" ON public.books_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "books_transactions_delete_own" ON public.books_transactions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_books_transactions_updated_at BEFORE UPDATE ON public.books_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_books_transactions_user_id ON public.books_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_books_transactions_date ON public.books_transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_books_transactions_category ON public.books_transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_books_transactions_account ON public.books_transactions(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_books_transactions_batch ON public.books_transactions(import_batch_id);

-- ── Import Batches ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    financial_account_id UUID REFERENCES public.books_financial_accounts(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('csv', 'excel', 'plaid')),
    filename TEXT,
    total_transactions INTEGER DEFAULT 0,
    successful_imports INTEGER DEFAULT 0,
    failed_imports INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.books_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_import_batches_select_own" ON public.books_import_batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books_import_batches_insert_own" ON public.books_import_batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books_import_batches_update_own" ON public.books_import_batches FOR UPDATE USING (auth.uid() = user_id);

-- ── Duplicate Fingerprints ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_duplicate_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.books_transactions(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, fingerprint)
);

ALTER TABLE public.books_duplicate_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_dup_fingerprints_select_own" ON public.books_duplicate_fingerprints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books_dup_fingerprints_insert_own" ON public.books_duplicate_fingerprints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books_dup_fingerprints_delete_own" ON public.books_duplicate_fingerprints FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_books_dup_fingerprints_user ON public.books_duplicate_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_books_dup_fingerprints_fp ON public.books_duplicate_fingerprints(fingerprint);

-- ── Business Entities ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_business_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_type TEXT CHECK (entity_type IN ('llc', 'rental_property', 'corporation', 's_corp', 'partnership', 'sole_proprietorship')) NOT NULL,
    tax_id TEXT,
    address JSONB,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

ALTER TABLE public.books_business_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_entities_select_own" ON public.books_business_entities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books_entities_insert_own" ON public.books_business_entities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books_entities_update_own" ON public.books_business_entities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "books_entities_delete_own" ON public.books_business_entities FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_books_entities_updated_at BEFORE UPDATE ON public.books_business_entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Accounting Categories (per entity) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_accounting_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES public.books_business_entities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_type TEXT CHECK (category_type IN ('income', 'expense', 'asset', 'liability', 'equity')) NOT NULL,
    tax_code TEXT,
    description TEXT,
    parent_category_id UUID REFERENCES public.books_accounting_categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entity_id, name)
);

ALTER TABLE public.books_accounting_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_accounting_categories_select_own" ON public.books_accounting_categories
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.books_business_entities e WHERE e.id = entity_id AND e.user_id = auth.uid())
    );
CREATE POLICY "books_accounting_categories_insert_own" ON public.books_accounting_categories
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.books_business_entities e WHERE e.id = entity_id AND e.user_id = auth.uid())
    );
CREATE POLICY "books_accounting_categories_update_own" ON public.books_accounting_categories
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.books_business_entities e WHERE e.id = entity_id AND e.user_id = auth.uid())
    );
CREATE POLICY "books_accounting_categories_delete_own" ON public.books_accounting_categories
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.books_business_entities e WHERE e.id = entity_id AND e.user_id = auth.uid())
    );

-- ── Tax Transaction Views ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_tax_transaction_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES public.books_business_entities(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.books_transactions(id) ON DELETE CASCADE,
    tax_amount DECIMAL(14, 2),
    tax_description TEXT,
    tax_date DATE,
    accounting_category_id UUID REFERENCES public.books_accounting_categories(id),
    is_tax_deductible BOOLEAN DEFAULT false,
    deduction_percentage DECIMAL(5, 2) DEFAULT 100.00,
    business_percentage DECIMAL(5, 2) DEFAULT 100.00,
    tax_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entity_id, transaction_id)
);

ALTER TABLE public.books_tax_transaction_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books_tax_views_select_own" ON public.books_tax_transaction_views
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.books_business_entities e WHERE e.id = entity_id AND e.user_id = auth.uid())
    );
CREATE POLICY "books_tax_views_insert_own" ON public.books_tax_transaction_views
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.books_business_entities e WHERE e.id = entity_id AND e.user_id = auth.uid())
    );
CREATE POLICY "books_tax_views_update_own" ON public.books_tax_transaction_views
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.books_business_entities e WHERE e.id = entity_id AND e.user_id = auth.uid())
    );
CREATE POLICY "books_tax_views_delete_own" ON public.books_tax_transaction_views
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.books_business_entities e WHERE e.id = entity_id AND e.user_id = auth.uid())
    );

CREATE TRIGGER update_books_tax_views_updated_at BEFORE UPDATE ON public.books_tax_transaction_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_books_tax_views_entity ON public.books_tax_transaction_views(entity_id);
CREATE INDEX IF NOT EXISTS idx_books_tax_views_transaction ON public.books_tax_transaction_views(transaction_id);
CREATE INDEX IF NOT EXISTS idx_books_tax_views_deductible ON public.books_tax_transaction_views(entity_id, is_tax_deductible);
