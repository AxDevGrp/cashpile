-- ============================================================================
-- CASHPILE — Migration 006: Stacks Data Import
--
-- PART A: Run in your STACKS Supabase SQL editor
--         Produces a single column of INSERT statements — select all rows,
--         copy, and paste into Part B.
--
-- PART B: Run in your CASHPILE Supabase SQL editor
--         Paste the Part A output where indicated, then run the whole block.
--
-- User ID: c685fe3e-f2ec-47a2-9efc-46e2e8086b0a
-- ============================================================================


-- ============================================================================
-- PART A — Paste and run this entire block in your STACKS Supabase SQL editor
--
-- You will get one column called "sql" with many rows.
-- Select all rows → copy the "sql" column values → paste into Part B.
-- ============================================================================

/*

SELECT sql FROM (

  -- A1: Categories (only ones referenced by your transactions)
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
    WHERE user_id = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a'
      AND category_id IS NOT NULL
  )

  UNION ALL

  -- A2: User-Defined Accounts (UDAs)
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
  WHERE user_id = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a'

  UNION ALL

  -- A3: Financial Accounts
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
  WHERE uda.user_id = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a'

  UNION ALL

  -- A4: Transactions (category exported as name; remapped by name in Part B)
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
  WHERE t.user_id = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a'

) sub
ORDER BY sort_order, sub_order;

*/


-- ============================================================================
-- PART B — Run this in your CASHPILE Supabase SQL editor
--
-- 1. Paste ALL rows from the Part A "sql" column output below the
--    "Paste Part A output here" comment.
-- 2. Run the entire block — it is wrapped in a transaction so it will
--    roll back automatically if anything fails.
-- ============================================================================

BEGIN;

-- ── Staging table for transactions (must come before the pasted inserts) ─────
CREATE TEMP TABLE IF NOT EXISTS stacks_txn_import (
  id                   UUID,
  user_id              UUID,
  financial_account_id UUID,
  description          TEXT,
  amount               DECIMAL(14, 2),
  date                 DATE,
  merchant             TEXT,
  transaction_type     TEXT,
  category_name_ref    TEXT,
  is_transfer          BOOLEAN     DEFAULT false,
  import_source        TEXT        DEFAULT 'manual',
  import_batch_id      UUID,
  metadata             JSONB       DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ
);

-- ── Paste ALL Part A output rows here ────────────────────────────────────────
-- (categories, UDAs, financial accounts, and stacks_txn_import inserts
--  will all be mixed in — that is fine, the ORDER BY in Part A groups them)



-- ── Resolve category_id by name and insert into books_transactions ───────────
INSERT INTO public.books_transactions (
  id,
  user_id,
  financial_account_id,
  description,
  amount,
  date,
  merchant,
  transaction_type,
  category_id,
  is_transfer,
  import_source,
  import_batch_id,
  metadata,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.user_id,
  s.financial_account_id,
  s.description,
  s.amount,
  s.date,
  s.merchant,
  s.transaction_type,
  bc.id AS category_id,
  s.is_transfer,
  s.import_source,
  s.import_batch_id,
  s.metadata,
  s.created_at,
  s.updated_at
FROM stacks_txn_import s
LEFT JOIN public.books_categories bc
  ON  bc.name    = s.category_name_ref
  AND bc.user_id = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a'
ON CONFLICT (id) DO NOTHING;

DROP TABLE stacks_txn_import;

-- ── Verification — row counts should match your Stacks totals ────────────────
SELECT 'books_categories'         AS table_name, COUNT(*) AS rows
FROM public.books_categories
WHERE user_id = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a'

UNION ALL

SELECT 'books_udas',              COUNT(*)
FROM public.books_udas
WHERE user_id = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a'

UNION ALL

SELECT 'books_financial_accounts', COUNT(*)
FROM public.books_financial_accounts bfa
INNER JOIN public.books_udas u ON u.id = bfa.uda_id
WHERE u.user_id = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a'

UNION ALL

SELECT 'books_transactions',       COUNT(*)
FROM public.books_transactions
WHERE user_id = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a';

COMMIT;
