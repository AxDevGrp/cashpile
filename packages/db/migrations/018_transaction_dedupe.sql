-- ============================================================================
-- CASHPILE — Migration 018: Transaction De-duplication Hardening
-- Adds a canonical fingerprint directly to books_transactions so non-provider
-- imports can be de-duplicated atomically by Postgres.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.books_transactions
  ADD COLUMN IF NOT EXISTS dedupe_fingerprint TEXT;

-- Backfill one canonical fingerprint per existing non-Plaid transaction. If the
-- historical data already contains exact duplicates, keep the first row as the
-- canonical row and flag later rows for review instead of failing this migration.
WITH raw_candidates AS (
  SELECT
    id,
    user_id,
    encode(
      digest(
        concat_ws(
          '|',
          COALESCE(financial_account_id::text, 'unknown'),
          date::text,
          to_char(round(amount::numeric, 2), 'FM999999999999990.00'),
          lower(regexp_replace(btrim(description), '\s+', ' ', 'g'))
        ),
        'sha256'
      ),
      'hex'
    ) AS fingerprint,
    created_at
  FROM public.books_transactions
  WHERE dedupe_fingerprint IS NULL
    AND plaid_transaction_id IS NULL
    AND COALESCE(import_source, 'manual') IN ('csv', 'excel', 'manual')
), ranked_candidates AS (
  SELECT
    id,
    fingerprint,
    row_number() OVER (
      PARTITION BY user_id, fingerprint
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM raw_candidates
)
UPDATE public.books_transactions AS t
SET
  dedupe_fingerprint = CASE
    WHEN ranked_candidates.duplicate_rank = 1 THEN ranked_candidates.fingerprint
    ELSE NULL
  END,
  metadata = CASE
    WHEN ranked_candidates.duplicate_rank > 1 THEN
      COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
        'possible_duplicate', true,
        'duplicate_reason', 'historical_exact_fingerprint_collision'
      )
    ELSE COALESCE(t.metadata, '{}'::jsonb)
  END
FROM ranked_candidates
WHERE t.id = ranked_candidates.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_transactions_user_dedupe_fingerprint
  ON public.books_transactions(user_id, dedupe_fingerprint)
  WHERE dedupe_fingerprint IS NOT NULL;
