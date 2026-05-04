-- ============================================================================
-- CASHPILE — Migration 013: Financial Account RLS by user_id
-- Plaid-created accounts may not have a legacy uda_id, so expose accounts owned
-- directly by user_id while preserving legacy UDA ownership behavior.
-- ============================================================================

DROP POLICY IF EXISTS "books_financial_accounts_select_own" ON public.books_financial_accounts;
DROP POLICY IF EXISTS "books_financial_accounts_insert_own" ON public.books_financial_accounts;
DROP POLICY IF EXISTS "books_financial_accounts_update_own" ON public.books_financial_accounts;
DROP POLICY IF EXISTS "books_financial_accounts_delete_own" ON public.books_financial_accounts;

CREATE POLICY "books_financial_accounts_select_own" ON public.books_financial_accounts
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.books_udas u WHERE u.id = uda_id AND u.user_id = auth.uid())
    );

CREATE POLICY "books_financial_accounts_insert_own" ON public.books_financial_accounts
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.books_udas u WHERE u.id = uda_id AND u.user_id = auth.uid())
    );

CREATE POLICY "books_financial_accounts_update_own" ON public.books_financial_accounts
    FOR UPDATE USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.books_udas u WHERE u.id = uda_id AND u.user_id = auth.uid())
    );

CREATE POLICY "books_financial_accounts_delete_own" ON public.books_financial_accounts
    FOR DELETE USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.books_udas u WHERE u.id = uda_id AND u.user_id = auth.uid())
    );
