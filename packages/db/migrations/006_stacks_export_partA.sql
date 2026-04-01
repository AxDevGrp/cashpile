-- ============================================================================
-- STACKS EXPORT QUERY
-- Run this in your STACKS Supabase SQL editor.
-- Results appear in the "Results" tab as a single column called "sql".
-- Select all rows → copy the values → paste into 006_stacks_import_partB.sql
-- ============================================================================

SELECT sql FROM (

  -- Categories (only ones used by your transactions)
  SELECT 1 AS sort_order, c.id AS sub_order,
    'INSERT INTO public.books_categories (name, description, is_tax_deductible, color, icon, user_id, category_type) VALUES ('
    || quote_literal(c.name) || ', '
    || COALESCE(quote_literal(c.description), 'NULL') || ', '
    || c.is_tax_deductible || ', '
    || quote_literal(c.color) || ', '
    || quote_literal(c.icon) || ', '
    || quote_literal('c685fe3e-f2ec-47a2-9efc-46e2e8086b0a') || ', '
    || quote_literal(
         CASE
           WHEN c.name ILIKE '%income%'
             OR c.name ILIKE '%revenue%'
             OR c.name ILIKE '%salary%'   THEN 'income'
           WHEN c.name ILIKE '%transfer%' THEN 'transfer'
           WHEN c.name ILIKE '%investment%'
             OR c.name ILIKE '%asset%'    THEN 'asset'
           ELSE 'expense'
         END
       ) || ') ON CONFLICT (user_id, name) DO NOTHING;' AS sql
  FROM public.categories c
  WHERE c.id IN (
    SELECT DISTINCT category_id
    FROM public.transactions
    WHERE user_id = '272c4e7d-0877-4e67-bac1-f7493964ca7f'
      AND category_id IS NOT NULL
  )

  UNION ALL

  -- User-Defined Accounts (UDAs)
  SELECT 2, 0,
    'INSERT INTO public.books_udas (id, user_id, name, description, created_at, updated_at) VALUES ('
    || quote_literal(id::text) || ', '
    || quote_literal('c685fe3e-f2ec-47a2-9efc-46e2e8086b0a') || ', '
    || quote_literal(name) || ', '
    || COALESCE(quote_literal(description), 'NULL') || ', '
    || quote_literal(created_at::text) || ', '
    || quote_literal(updated_at::text)
    || ') ON CONFLICT (user_id, name) DO NOTHING;'
  FROM public.user_defined_accounts
  WHERE user_id = '272c4e7d-0877-4e67-bac1-f7493964ca7f'

  UNION ALL

  -- Financial Accounts
  SELECT 3, 0,
    'INSERT INTO public.books_financial_accounts (id, uda_id, name, account_type, institution_name, last_four_digits, account_identifier, current_balance, is_active, created_at, updated_at) VALUES ('
    || quote_literal(fa.id::text) || ', '
    || quote_literal(fa.user_defined_account_id::text) || ', '
    || quote_literal(fa.name) || ', '
    || quote_literal(fa.account_type) || ', '
    || COALESCE(quote_literal(fa.institution_name), 'NULL') || ', '
    || COALESCE(quote_literal(fa.last_four_digits), 'NULL') || ', '
    || COALESCE(quote_literal(fa.account_identifier), 'NULL') || ', '
    || '0, true, '
    || quote_literal(fa.created_at::text) || ', '
    || quote_literal(fa.updated_at::text)
    || ') ON CONFLICT DO NOTHING;'
  FROM public.financial_accounts fa
  INNER JOIN public.user_defined_accounts uda
    ON uda.id = fa.user_defined_account_id
  WHERE uda.user_id = '272c4e7d-0877-4e67-bac1-f7493964ca7f'

  UNION ALL

  -- Transactions
  SELECT 4, 0,
    'INSERT INTO stacks_txn_import (id, user_id, financial_account_id, description, amount, date, merchant, transaction_type, category_name_ref, is_transfer, import_source, import_batch_id, metadata, created_at, updated_at) VALUES ('
    || quote_literal(t.id::text) || ', '
    || quote_literal('c685fe3e-f2ec-47a2-9efc-46e2e8086b0a') || ', '
    || COALESCE(quote_literal(t.financial_account_id::text), 'NULL') || ', '
    || quote_literal(t.description) || ', '
    || t.amount || ', '
    || quote_literal(t.date::text) || ', '
    || COALESCE(quote_literal(t.merchant), 'NULL') || ', '
    || quote_literal(t.transaction_type) || ', '
    || COALESCE(quote_literal(c.name), 'NULL') || ', '
    || 'false, '
    || quote_literal(COALESCE(t.import_source, 'manual')) || ', '
    || COALESCE(quote_literal(t.import_batch_id::text), 'NULL') || ', '
    || quote_literal(t.metadata::text) || '::jsonb, '
    || quote_literal(t.created_at::text) || ', '
    || quote_literal(t.updated_at::text)
    || ');'
  FROM public.transactions t
  LEFT JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = '272c4e7d-0877-4e67-bac1-f7493964ca7f'

) sub
ORDER BY sort_order, sub_order;
