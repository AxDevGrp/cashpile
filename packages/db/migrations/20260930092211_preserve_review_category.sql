-- Preserve existing categories for all consumer review callers, including older clients.
-- No historical transaction data is changed by this migration.

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

  -- Review changes meaning, not category unless a replacement is supplied.
  -- Use the locked row so the ledger, remembered rule, and review flag agree.
  -- Intentional category clearing remains in the regular transaction editor.
  p_category_id := COALESCE(p_category_id, v_t.category_id);

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
