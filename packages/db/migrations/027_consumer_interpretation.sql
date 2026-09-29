-- ============================================================================
-- CASHPILE — Migration 027: Consumer interpretation (Stage 01, part 1 of 2)
-- Correction-safe semantic layer over books_transactions:
--   * account currency / balance-as-of columns (no silent USD or timestamp)
--   * provider_data + source_revision source-fact tracking on transactions
--   * books_transaction_interpretations (one semantic row per transaction)
--   * books_consumer_rules (user-remembered exact matches)
--   * consumer_effective_role (pure role/type mapping)
--   * review summary/page RPCs (used by stage 03/04)
--   * save/apply RPCs, ledger-change trigger, insert-interpretation trigger
-- Job/sync primitives live in 028. No production application here.
-- ============================================================================

-- ── Existing tables: additive columns ───────────────────────────────────────

ALTER TABLE public.books_financial_accounts
  ADD COLUMN IF NOT EXISTS currency_code TEXT,
  ADD COLUMN IF NOT EXISTS balance_as_of TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'books_financial_accounts_currency_code_check'
      AND conrelid = 'public.books_financial_accounts'::regclass
  ) THEN
    ALTER TABLE public.books_financial_accounts
      ADD CONSTRAINT books_financial_accounts_currency_code_check
      CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$');
  END IF;
END $$;

ALTER TABLE public.books_transactions
  ADD COLUMN IF NOT EXISTS provider_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_revision INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'books_transactions_source_revision_check'
      AND conrelid = 'public.books_transactions'::regclass
  ) THEN
    ALTER TABLE public.books_transactions
      ADD CONSTRAINT books_transactions_source_revision_check
      CHECK (source_revision > 0);
  END IF;
END $$;

-- ── New table: interpretations ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_transaction_interpretations (
  transaction_id UUID PRIMARY KEY REFERENCES public.books_transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'unknown'
    CHECK (kind IN ('unknown','spend','income','passive_income','refund',
                    'internal_transfer','card_payment','asset_sale','loan_proceeds')),
  source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('unknown','provider','rule','user')),
  review_required BOOLEAN NOT NULL DEFAULT true,
  suggestion JSONB,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_tx_interpretations_owner_review
  ON public.books_transaction_interpretations(user_id, review_required, transaction_id);

DROP TRIGGER IF EXISTS update_books_tx_interpretations_updated_at
  ON public.books_transaction_interpretations;
CREATE TRIGGER update_books_tx_interpretations_updated_at
  BEFORE UPDATE ON public.books_transaction_interpretations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── New table: remembered exact rules ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_consumer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  financial_account_id UUID NOT NULL REFERENCES public.books_financial_accounts(id) ON DELETE CASCADE,
  normalized_description TEXT NOT NULL
    CHECK (char_length(normalized_description) BETWEEN 1 AND 512),
  signed_amount_cents BIGINT NOT NULL
    CHECK (signed_amount_cents BETWEEN -99999999999999 AND 99999999999999),
  kind TEXT NOT NULL CHECK (kind IN ('spend','income','passive_income','refund')),
  category_id INTEGER REFERENCES public.books_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT books_consumer_rules_unique_match
    UNIQUE (user_id, financial_account_id, normalized_description, signed_amount_cents)
);

CREATE INDEX IF NOT EXISTS idx_books_consumer_rules_owner
  ON public.books_consumer_rules(user_id, financial_account_id);

DROP TRIGGER IF EXISTS update_books_consumer_rules_updated_at
  ON public.books_consumer_rules;
CREATE TRIGGER update_books_consumer_rules_updated_at
  BEFORE UPDATE ON public.books_consumer_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- NFKC, trim, lowercase, collapse whitespace; names/digits preserved.
CREATE OR REPLACE FUNCTION public.consumer_normalize_description(p_description TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(regexp_replace(btrim(normalize(COALESCE(p_description, ''), NFKC)), '\s+', ' ', 'g'));
$$;

-- Pure mapping: valid explicit role wins; otherwise infer from account type.
CREATE OR REPLACE FUNCTION public.consumer_effective_role(p_role TEXT, p_account_type TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_role IS NOT NULL THEN
      CASE
        WHEN p_role IN ('spending_source','reserve','credit_liability','investment','loan','ignore')
          THEN p_role
        ELSE 'ignore'
      END
    ELSE
      CASE p_account_type
        WHEN 'checking'   THEN 'spending_source'
        WHEN 'savings'    THEN 'reserve'
        WHEN 'credit_card' THEN 'credit_liability'
        WHEN 'investment' THEN 'investment'
        WHEN 'loan'       THEN 'loan'
        ELSE 'ignore'
      END
  END;
$$;

-- Shared joined predicate for review counts and pages. Owner + active + included
-- + confirmed USD + non-ignore role + posted + review_required.
CREATE OR REPLACE FUNCTION public.consumer_review_candidates(p_user_id UUID, p_account_id UUID)
RETURNS TABLE (
  transaction_id UUID,
  tx_date DATE,
  description TEXT,
  amount_cents BIGINT,
  account_id UUID,
  account_label TEXT,
  kind TEXT,
  category_id INTEGER,
  suggestion JSONB,
  revision INTEGER
)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    t.id,
    t.date,
    t.description,
    round(t.amount * 100)::bigint,
    a.id,
    a.name,
    i.kind,
    t.category_id,
    i.suggestion,
    i.revision
  FROM public.books_transactions t
  JOIN public.books_transaction_interpretations i
    ON i.transaction_id = t.id AND i.user_id = p_user_id
  JOIN public.books_financial_accounts a
    ON a.id = t.financial_account_id AND a.user_id = p_user_id
  WHERE t.user_id = p_user_id
    AND a.is_active IS TRUE
    AND a.cashflow_include IS TRUE
    AND a.currency_code = 'USD'
    AND public.consumer_effective_role(a.cashflow_role, a.account_type) <> 'ignore'
    AND COALESCE(t.provider_data->>'pending', 'false') = 'false'
    AND i.review_required IS TRUE
    AND (p_account_id IS NULL OR a.id = p_account_id);
$$;

-- Raise a mapped error the application can translate to a status code.
CREATE OR REPLACE FUNCTION public.consumer_raise(p_code TEXT)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = p_code, DETAIL = p_code;
END;
$$;

-- Caller gate: authenticated callers may only act on their own id; service
-- callers (no auth.uid()) are trusted to supply the owner.
CREATE OR REPLACE FUNCTION public.consumer_assert_owner(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    PERFORM public.consumer_raise('not_found');
  END IF;
  -- No session and not a trusted service caller (e.g. anon) is never allowed.
  IF auth.uid() IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    PERFORM public.consumer_raise('not_found');
  END IF;
END;
$$;

-- Account filter must be owned, active, included, confirmed USD, non-ignore.
CREATE OR REPLACE FUNCTION public.consumer_assert_account_filter(p_user_id UUID, p_account_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_account_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.books_financial_accounts a
    WHERE a.id = p_account_id
      AND a.user_id = p_user_id
      AND a.is_active IS TRUE
      AND a.cashflow_include IS TRUE
      AND a.currency_code = 'USD'
      AND public.consumer_effective_role(a.cashflow_role, a.account_type) <> 'ignore'
  ) THEN
    PERFORM public.consumer_raise('not_found');
  END IF;
END;
$$;

-- ── Review summary / page ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consumer_review_summary(
  p_user_id UUID,
  p_account_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count BIGINT;
  v_debit BIGINT;
  v_credit BIGINT;
BEGIN
  PERFORM public.consumer_assert_owner(p_user_id);
  PERFORM public.consumer_assert_account_filter(p_user_id, p_account_id);

  SELECT
    count(*),
    COALESCE(sum(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0),
    COALESCE(sum(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0)
  INTO v_count, v_debit, v_credit
  FROM public.consumer_review_candidates(p_user_id, p_account_id);

  RETURN jsonb_build_object('count', v_count, 'debitCents', v_debit, 'creditCents', v_credit);
END;
$$;

CREATE OR REPLACE FUNCTION public.consumer_review_page(
  p_user_id UUID,
  p_account_id UUID,
  p_limit INTEGER,
  p_after JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_up BOOLEAN;
  v_abs BIGINT;
  v_date DATE;
  v_id UUID;
  v_items JSONB;
  v_next JSONB;
BEGIN
  PERFORM public.consumer_assert_owner(p_user_id);
  PERFORM public.consumer_assert_account_filter(p_user_id, p_account_id);

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;

  IF p_after IS NOT NULL THEN
    IF jsonb_typeof(p_after) <> 'object'
       OR (SELECT count(*) FROM jsonb_object_keys(p_after)) <> 4
       OR NOT (p_after ?& ARRAY['up','abs','date','id']) THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;
    BEGIN
      v_up   := (p_after->>'up')::boolean;
      v_abs  := (p_after->>'abs')::bigint;
      v_date := (p_after->>'date')::date;
      v_id   := (p_after->>'id')::uuid;
    EXCEPTION WHEN others THEN
      PERFORM public.consumer_raise('invalid_input');
    END;
  END IF;

  WITH base AS (
    SELECT
      c.*,
      (c.amount_cents > 0 AND c.kind = 'unknown') AS unknown_positive,
      abs(c.amount_cents) AS abs_cents
    FROM public.consumer_review_candidates(p_user_id, p_account_id) c
  ),
  filtered AS (
    SELECT * FROM base
    WHERE p_after IS NULL
       OR (unknown_positive::int < v_up::int)
       OR (unknown_positive = v_up AND abs_cents < v_abs)
       OR (unknown_positive = v_up AND abs_cents = v_abs AND tx_date < v_date)
       OR (unknown_positive = v_up AND abs_cents = v_abs AND tx_date = v_date AND transaction_id > v_id)
  ),
  ordered AS (
    SELECT
      *,
      row_number() OVER (
        ORDER BY unknown_positive DESC, abs_cents DESC, tx_date DESC, transaction_id ASC
      ) AS rn,
      count(*) OVER () AS total
    FROM filtered
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'transactionId', transaction_id,
          'revision', revision,
          'date', to_char(tx_date, 'YYYY-MM-DD'),
          'description', description,
          'amountCents', amount_cents,
          'accountId', account_id,
          'accountLabel', account_label,
          'kind', kind,
          'categoryId', category_id,
          'suggestion', suggestion
        ) ORDER BY rn
      ) FILTER (WHERE rn <= p_limit),
      '[]'::jsonb
    ),
    CASE
      WHEN max(total) > p_limit THEN (
        SELECT jsonb_build_object(
          'up', o.unknown_positive,
          'abs', o.abs_cents,
          'date', to_char(o.tx_date, 'YYYY-MM-DD'),
          'id', o.transaction_id
        )
        FROM ordered o
        WHERE o.rn = p_limit
      )
      ELSE NULL
    END
  INTO v_items, v_next
  FROM ordered;

  RETURN jsonb_build_object('items', v_items, 'nextCursor', v_next);
END;
$$;

-- ── Save (user confirmation) ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consumer_save_review(
  p_transaction_id UUID,
  p_expected_revision INTEGER,
  p_kind TEXT,
  p_category_id INTEGER,
  p_remember BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_t public.books_transactions%ROWTYPE;
  v_i public.books_transaction_interpretations%ROWTYPE;
  v_rev INTEGER;
  v_review_required BOOLEAN;
  v_amount_cents BIGINT;
  v_normalized TEXT;
BEGIN
  IF v_uid IS NULL THEN
    PERFORM public.consumer_raise('not_found');
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN
     ('unknown','spend','income','passive_income','refund',
      'internal_transfer','card_payment','asset_sale','loan_proceeds') THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;

  SELECT * INTO v_t
  FROM public.books_transactions
  WHERE id = p_transaction_id AND user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.consumer_raise('not_found');
  END IF;

  SELECT * INTO v_i
  FROM public.books_transaction_interpretations
  WHERE transaction_id = p_transaction_id AND user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.consumer_raise('not_found');
  END IF;

  IF v_i.revision <> p_expected_revision THEN
    PERFORM public.consumer_raise('revision_conflict');
  END IF;

  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.books_categories c
    WHERE c.id = p_category_id AND c.user_id = v_uid
  ) THEN
    PERFORM public.consumer_raise('not_found');
  END IF;

  v_amount_cents := round(v_t.amount * 100)::bigint;

  -- sign constraints
  IF p_kind = 'spend' AND v_amount_cents > 0 THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;
  IF p_kind IN ('income','passive_income','refund','asset_sale','loan_proceeds')
     AND v_amount_cents < 0 THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;

  -- remember constraints
  IF p_remember IS TRUE AND p_kind NOT IN ('spend','income','passive_income','refund') THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;

  v_review_required := (
    p_kind = 'unknown'
    OR (p_kind IN ('spend','income') AND p_category_id IS NULL)
  );

  IF p_remember IS TRUE THEN
    IF v_t.financial_account_id IS NULL THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;
    v_normalized := public.consumer_normalize_description(v_t.description);
    IF v_normalized = '' THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;
    INSERT INTO public.books_consumer_rules (
      user_id, financial_account_id, normalized_description,
      signed_amount_cents, kind, category_id
    )
    VALUES (
      v_uid, v_t.financial_account_id, v_normalized,
      v_amount_cents, p_kind, p_category_id
    )
    ON CONFLICT (user_id, financial_account_id, normalized_description, signed_amount_cents)
    DO UPDATE SET kind = EXCLUDED.kind,
                  category_id = EXCLUDED.category_id,
                  updated_at = now();
  END IF;

  -- Ledger write first: this fires the ledger-change trigger, which bumps the
  -- interpretation revision (and review_required) so an advanced edit can never
  -- leave silent stale truth. The RPC then finalizes the interpretation.
  UPDATE public.books_transactions
  SET category_id = p_category_id,
      is_transfer = CASE
        WHEN p_kind IN ('internal_transfer','card_payment') THEN TRUE
        WHEN p_kind = 'unknown' THEN is_transfer
        ELSE FALSE
      END
  WHERE id = p_transaction_id;

  SELECT revision INTO v_rev
  FROM public.books_transaction_interpretations
  WHERE transaction_id = p_transaction_id
  FOR UPDATE;
  IF v_rev = p_expected_revision THEN
    v_rev := p_expected_revision + 1;
  END IF;

  UPDATE public.books_transaction_interpretations
  SET kind = p_kind,
      source = 'user',
      suggestion = NULL,
      confirmed_at = now(),
      review_required = v_review_required,
      revision = v_rev,
      updated_at = now()
  WHERE transaction_id = p_transaction_id;

  RETURN jsonb_build_object(
    'transactionId', p_transaction_id,
    'revision', v_rev,
    'reviewRequired', v_review_required
  );
END;
$$;

-- ── Apply (worker/service write) ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consumer_apply_interpretation(
  p_transaction_id UUID,
  p_source_revision INTEGER,
  p_expected_revision INTEGER,
  p_kind TEXT,
  p_source TEXT,
  p_suggestion JSONB,
  p_category_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.books_transactions%ROWTYPE;
  v_i public.books_transaction_interpretations%ROWTYPE;
  v_rev INTEGER;
  v_review_required BOOLEAN;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN
     ('unknown','spend','income','passive_income','refund',
      'internal_transfer','card_payment','asset_sale','loan_proceeds') THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('provider','rule','unknown') THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;
  -- passive income is only ever asserted by a user or their exact rule.
  IF p_kind = 'passive_income' AND p_source <> 'rule' THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;

  SELECT * INTO v_t
  FROM public.books_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.consumer_raise('not_found');
  END IF;

  SELECT * INTO v_i
  FROM public.books_transaction_interpretations
  WHERE transaction_id = p_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.consumer_raise('not_found');
  END IF;

  -- stale source/interpretation revision or a user decision is never overwritten.
  IF v_t.source_revision <> p_source_revision
     OR v_i.revision <> p_expected_revision
     OR v_i.source = 'user' THEN
    RETURN jsonb_build_object('applied', false, 'revision', v_i.revision);
  END IF;

  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.books_categories c
    WHERE c.id = p_category_id AND c.user_id = v_t.user_id
  ) THEN
    PERFORM public.consumer_raise('not_found');
  END IF;

  v_review_required := (
    p_kind = 'unknown'
    OR (p_kind IN ('spend','income') AND p_category_id IS NULL)
  );

  UPDATE public.books_transactions
  SET category_id = COALESCE(p_category_id, category_id),
      is_transfer = CASE
        WHEN p_kind IN ('internal_transfer','card_payment') THEN TRUE
        ELSE is_transfer
      END
  WHERE id = p_transaction_id;

  SELECT revision INTO v_rev
  FROM public.books_transaction_interpretations
  WHERE transaction_id = p_transaction_id
  FOR UPDATE;
  IF v_rev = p_expected_revision THEN
    v_rev := p_expected_revision + 1;
  END IF;

  UPDATE public.books_transaction_interpretations
  SET kind = p_kind,
      source = p_source,
      suggestion = p_suggestion,
      review_required = v_review_required,
      revision = v_rev,
      updated_at = now()
  WHERE transaction_id = p_transaction_id;

  RETURN jsonb_build_object('applied', true, 'revision', v_rev);
END;
$$;

-- ── Triggers on books_transactions (interpretation side) ────────────────────

-- Every inserted transaction (any import path) gets an unknown interpretation.
CREATE OR REPLACE FUNCTION public.books_tx_create_interpretation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.books_transaction_interpretations (transaction_id, user_id)
  VALUES (NEW.id, NEW.user_id)
  ON CONFLICT (transaction_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_tx_create_interpretation ON public.books_transactions;
CREATE TRIGGER trg_books_tx_create_interpretation
  AFTER INSERT ON public.books_transactions
  FOR EACH ROW EXECUTE FUNCTION public.books_tx_create_interpretation();

-- Source facts changed => source_revision increments (BEFORE logic).
CREATE OR REPLACE FUNCTION public.books_tx_bump_source_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.date IS DISTINCT FROM OLD.date
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.merchant IS DISTINCT FROM OLD.merchant
     OR NEW.financial_account_id IS DISTINCT FROM OLD.financial_account_id
     OR NEW.provider_data IS DISTINCT FROM OLD.provider_data THEN
    NEW.source_revision := OLD.source_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_tx_bump_source_revision ON public.books_transactions;
CREATE TRIGGER trg_books_tx_bump_source_revision
  BEFORE UPDATE ON public.books_transactions
  FOR EACH ROW EXECUTE FUNCTION public.books_tx_bump_source_revision();

-- Ledger category / transfer edits invalidate prior consumer truth.
CREATE OR REPLACE FUNCTION public.books_tx_invalidate_interpretation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.is_transfer IS DISTINCT FROM OLD.is_transfer THEN
    UPDATE public.books_transaction_interpretations
    SET revision = revision + 1,
        review_required = (
          kind = 'unknown'
          OR (kind IN ('spend','income') AND NEW.category_id IS NULL)
        ),
        updated_at = now()
    WHERE transaction_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_tx_invalidate_interpretation ON public.books_transactions;
CREATE TRIGGER trg_books_tx_invalidate_interpretation
  AFTER UPDATE OF category_id, is_transfer ON public.books_transactions
  FOR EACH ROW EXECUTE FUNCTION public.books_tx_invalidate_interpretation();

-- ── RLS and grants ──────────────────────────────────────────────────────────

ALTER TABLE public.books_transaction_interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books_consumer_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interpretations_select_own" ON public.books_transaction_interpretations;
CREATE POLICY "interpretations_select_own" ON public.books_transaction_interpretations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "consumer_rules_select_own" ON public.books_consumer_rules;
CREATE POLICY "consumer_rules_select_own" ON public.books_consumer_rules
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "consumer_rules_delete_own" ON public.books_consumer_rules;
CREATE POLICY "consumer_rules_delete_own" ON public.books_consumer_rules
  FOR DELETE USING (auth.uid() = user_id);

-- Interpretations: owner read only; writes go through consumer_save_review /
-- consumer_apply_interpretation. Rules: owner read/delete; creation via RPC.
REVOKE ALL ON public.books_transaction_interpretations FROM PUBLIC;
REVOKE ALL ON public.books_consumer_rules FROM PUBLIC;

-- Functions are not callable by PUBLIC by default; grant deliberately.
REVOKE EXECUTE ON FUNCTION public.consumer_review_candidates(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_normalize_description(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_raise(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_assert_owner(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_assert_account_filter(UUID, UUID) FROM PUBLIC;

DO $$
DECLARE
  r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['authenticated','service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      CONTINUE;
    END IF;

    EXECUTE format('GRANT SELECT ON public.books_transaction_interpretations TO %I', r);
    EXECUTE format('GRANT SELECT, DELETE ON public.books_consumer_rules TO %I', r);

    EXECUTE format('GRANT EXECUTE ON FUNCTION public.consumer_effective_role(TEXT, TEXT) TO %I', r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.consumer_review_summary(UUID, UUID) TO %I', r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.consumer_review_page(UUID, UUID, INTEGER, JSONB) TO %I', r);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_save_review(UUID, INTEGER, TEXT, INTEGER, BOOLEAN) TO authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_apply_interpretation(UUID, INTEGER, INTEGER, TEXT, TEXT, JSONB, INTEGER) TO service_role';
    EXECUTE 'GRANT ALL ON public.books_transaction_interpretations TO service_role';
    EXECUTE 'GRANT ALL ON public.books_consumer_rules TO service_role';
  END IF;
END $$;
