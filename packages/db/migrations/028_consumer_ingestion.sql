-- ============================================================================
-- CASHPILE — Migration 028: Consumer ingestion (Stage 01, part 2 of 2)
-- Provider-sync leases and the bounded interpretation job queue:
--   * books_interpretation_jobs
--   * books_plaid_items sync lease columns
--   * insert/source-change triggers that enqueue work
--   * claim/release sync, page write, finish sync RPCs
--   * claim/finish job RPCs
-- Depends on 027 (interpretations). No production application here.
-- ============================================================================

-- ── New table: interpretation jobs ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.books_interpretation_jobs (
  transaction_id UUID PRIMARY KEY REFERENCES public.books_transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_revision INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_token UUID,
  leased_until TIMESTAMPTZ,
  last_error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_interpretation_jobs_due
  ON public.books_interpretation_jobs(status, available_at);

DROP TRIGGER IF EXISTS update_books_interpretation_jobs_updated_at
  ON public.books_interpretation_jobs;
CREATE TRIGGER update_books_interpretation_jobs_updated_at
  BEFORE UPDATE ON public.books_interpretation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Plaid sync lease columns ────────────────────────────────────────────────

ALTER TABLE public.books_plaid_items
  ADD COLUMN IF NOT EXISTS sync_lease_token UUID,
  ADD COLUMN IF NOT EXISTS sync_leased_until TIMESTAMPTZ;

-- ── Triggers on books_transactions (job side) ───────────────────────────────

CREATE OR REPLACE FUNCTION public.books_tx_sync_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.books_interpretation_jobs (transaction_id, user_id, source_revision)
    VALUES (NEW.id, NEW.user_id, NEW.source_revision)
    ON CONFLICT (transaction_id) DO UPDATE
      SET source_revision = EXCLUDED.source_revision,
          status = 'pending', attempts = 0, available_at = now(),
          lease_token = NULL, leased_until = NULL, last_error_code = NULL,
          updated_at = now();
  ELSIF TG_OP = 'UPDATE' AND NEW.source_revision IS DISTINCT FROM OLD.source_revision THEN
    -- A source change invalidates prior consumer truth; a user decision is kept
    -- but must be reconfirmed.
    UPDATE public.books_transaction_interpretations
    SET revision = revision + 1,
        review_required = CASE WHEN source = 'user' THEN TRUE ELSE review_required END,
        updated_at = now()
    WHERE transaction_id = NEW.id;

    INSERT INTO public.books_interpretation_jobs (transaction_id, user_id, source_revision)
    VALUES (NEW.id, NEW.user_id, NEW.source_revision)
    ON CONFLICT (transaction_id) DO UPDATE
      SET source_revision = EXCLUDED.source_revision,
          status = 'pending', attempts = 0, available_at = now(),
          lease_token = NULL, leased_until = NULL, last_error_code = NULL,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_tx_job_insert ON public.books_transactions;
CREATE TRIGGER trg_books_tx_job_insert
  AFTER INSERT ON public.books_transactions
  FOR EACH ROW EXECUTE FUNCTION public.books_tx_sync_job();

DROP TRIGGER IF EXISTS trg_books_tx_job_source_change ON public.books_transactions;
CREATE TRIGGER trg_books_tx_job_source_change
  AFTER UPDATE ON public.books_transactions
  FOR EACH ROW EXECUTE FUNCTION public.books_tx_sync_job();

-- ── Sync lease RPCs (service-only) ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consumer_claim_sync(p_item_id TEXT, p_token UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE public.books_plaid_items
  SET sync_lease_token = p_token,
      sync_leased_until = now() + interval '120 seconds',
      updated_at = now()
  WHERE item_id = p_item_id
    AND (sync_leased_until IS NULL OR sync_leased_until < now())
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.consumer_release_sync(p_item_id TEXT, p_token UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.books_plaid_items
  SET sync_lease_token = NULL, sync_leased_until = NULL, updated_at = now()
  WHERE item_id = p_item_id AND sync_lease_token = p_token;
END;
$$;

-- ── Page write (service-only) ───────────────────────────────────────────────
--
-- p_rows is a JSON array (<=500) of provider-owned records:
-- {
--   "plaid_transaction_id": text,
--   "financial_account_id": uuid,
--   "description": text,
--   "merchant": text|null,
--   "amountCents": integer (provider signed dollars * 100),
--   "date": "YYYY-MM-DD",
--   "transaction_type": "debit"|"credit",
--   "provider_data": object   -- keys per stage 02; "pending" must be boolean|null
-- }
-- Category, notes, transfer flags and consumer decisions are never supplied here.

CREATE OR REPLACE FUNCTION public.consumer_write_plaid_page(
  p_item_id TEXT,
  p_token UUID,
  p_rows JSONB
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.books_plaid_items%ROWTYPE;
  v_row JSONB;
  v_owner UUID;
  v_account UUID;
  v_cents BIGINT;
  v_dollars NUMERIC(14,2);
  v_date DATE;
  v_type TEXT;
  v_provider JSONB;
  v_plaid_id TEXT;
  v_pending_id TEXT;
  v_pending BOOLEAN;
  v_tx_id UUID;
  v_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;

  SELECT * INTO v_item FROM public.books_plaid_items WHERE item_id = p_item_id;
  IF NOT FOUND THEN
    PERFORM public.consumer_raise('not_found');
  END IF;
  IF v_item.sync_lease_token IS DISTINCT FROM p_token
     OR v_item.sync_leased_until IS NULL
     OR v_item.sync_leased_until < now() THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;
  v_owner := v_item.user_id;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF jsonb_typeof(v_row) <> 'object'
       OR NOT (v_row ?& ARRAY['plaid_transaction_id','financial_account_id',
                               'description','amountCents','date','transaction_type']) THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;

    v_plaid_id := NULLIF(v_row->>'plaid_transaction_id', '');
    IF v_plaid_id IS NULL THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;

    BEGIN
      v_account := (v_row->>'financial_account_id')::uuid;
      v_cents   := (v_row->>'amountCents')::bigint;
      v_date    := (v_row->>'date')::date;
    EXCEPTION WHEN others THEN
      PERFORM public.consumer_raise('invalid_input');
    END;

    IF v_cents < -99999999999999 OR v_cents > 99999999999999 THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;

    v_type := v_row->>'transaction_type';
    IF v_type NOT IN ('debit','credit') THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.books_financial_accounts a
      WHERE a.id = v_account AND a.user_id = v_owner AND a.plaid_item_id = v_item.id
    ) THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;

    v_provider := COALESCE(v_row->'provider_data', '{}'::jsonb);
    IF jsonb_typeof(v_provider) <> 'object' THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;
    IF jsonb_typeof(v_provider->'pending') NOT IN ('boolean', 'null') THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;
    v_pending := COALESCE((v_provider->>'pending')::boolean, false);
    v_pending_id := NULLIF(v_provider->>'pending_transaction_id', '');

    v_dollars := (v_cents::numeric / 100)::numeric(14,2);

    -- Resolve the local row: exact provider id, else promote a matching pending
    -- row in place so its Cashpile UUID (and user decisions) survive posting.
    SELECT id INTO v_tx_id
    FROM public.books_transactions
    WHERE user_id = v_owner AND plaid_transaction_id = v_plaid_id;

    IF v_tx_id IS NULL AND v_pending_id IS NOT NULL THEN
      SELECT id INTO v_tx_id
      FROM public.books_transactions
      WHERE user_id = v_owner AND plaid_transaction_id = v_pending_id
      FOR UPDATE;
      IF v_tx_id IS NOT NULL THEN
        UPDATE public.books_transactions
        SET plaid_transaction_id = v_plaid_id
        WHERE id = v_tx_id;
      END IF;
    END IF;

    IF v_tx_id IS NULL THEN
      INSERT INTO public.books_transactions (
        user_id, financial_account_id, description, merchant, amount, date,
        transaction_type, import_source, plaid_transaction_id, provider_data, metadata
      )
      VALUES (
        v_owner, v_account, COALESCE(v_row->>'description',''), v_row->>'merchant',
        v_dollars, v_date, v_type, 'plaid', v_plaid_id, v_provider,
        jsonb_build_object('pending', v_pending)
      )
      RETURNING id INTO v_tx_id;
    ELSE
      UPDATE public.books_transactions
      SET financial_account_id = v_account,
          description = COALESCE(v_row->>'description',''),
          merchant = v_row->>'merchant',
          amount = v_dollars,
          date = v_date,
          transaction_type = v_type,
          provider_data = v_provider,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('pending', v_pending)
      WHERE id = v_tx_id;
    END IF;

    v_ids := array_append(v_ids, v_tx_id);
  END LOOP;

  UPDATE public.books_plaid_items
  SET sync_leased_until = now() + interval '120 seconds', updated_at = now()
  WHERE id = v_item.id;

  RETURN v_ids;
END;
$$;

-- ── Finish sync (service-only) ──────────────────────────────────────────────
--
-- p_balances is a JSON array of
-- { "account_id": uuid, "current_balance": number|null,
--   "available_balance": number|null, "currency_code": text|null,
--   "balance_as_of": timestamptz|null }

CREATE OR REPLACE FUNCTION public.consumer_finish_sync(
  p_item_id TEXT,
  p_token UUID,
  p_removed_ids TEXT[],
  p_balances JSONB,
  p_next_cursor TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.books_plaid_items%ROWTYPE;
  v_bal JSONB;
  v_account UUID;
  v_currency TEXT;
BEGIN
  SELECT * INTO v_item FROM public.books_plaid_items WHERE item_id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.consumer_raise('not_found');
  END IF;
  IF v_item.sync_lease_token IS DISTINCT FROM p_token
     OR v_item.sync_leased_until IS NULL
     OR v_item.sync_leased_until < now() THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;

  IF p_removed_ids IS NOT NULL AND array_length(p_removed_ids, 1) > 0 THEN
    DELETE FROM public.books_transactions t
    USING public.books_financial_accounts a
    WHERE t.financial_account_id = a.id
      AND a.plaid_item_id = v_item.id
      AND t.user_id = v_item.user_id
      AND t.plaid_transaction_id = ANY(p_removed_ids);
  END IF;

  IF p_balances IS NOT NULL THEN
    IF jsonb_typeof(p_balances) <> 'array' THEN
      PERFORM public.consumer_raise('invalid_input');
    END IF;
    FOR v_bal IN SELECT value FROM jsonb_array_elements(p_balances) LOOP
      BEGIN
        v_account := (v_bal->>'account_id')::uuid;
      EXCEPTION WHEN others THEN
        PERFORM public.consumer_raise('invalid_input');
      END;
      IF NOT EXISTS (
        SELECT 1 FROM public.books_financial_accounts a
        WHERE a.id = v_account AND a.user_id = v_item.user_id AND a.plaid_item_id = v_item.id
      ) THEN
        PERFORM public.consumer_raise('invalid_input');
      END IF;

      v_currency := NULLIF(v_bal->>'currency_code', '');
      IF v_currency IS NOT NULL AND v_currency !~ '^[A-Z]{3}$' THEN
        PERFORM public.consumer_raise('invalid_input');
      END IF;

      UPDATE public.books_financial_accounts
      SET current_balance = CASE
            WHEN v_bal ? 'current_balance' AND v_bal->>'current_balance' IS NOT NULL
              THEN (v_bal->>'current_balance')::numeric(14,2)
            ELSE current_balance
          END,
          available_balance = CASE
            WHEN v_bal ? 'available_balance' AND v_bal->>'available_balance' IS NOT NULL
              THEN (v_bal->>'available_balance')::numeric(14,2)
            ELSE available_balance
          END,
          currency_code = COALESCE(v_currency, currency_code),
          balance_as_of = CASE
            WHEN v_bal ? 'balance_as_of' AND v_bal->>'balance_as_of' IS NOT NULL
              THEN (v_bal->>'balance_as_of')::timestamptz
            ELSE balance_as_of
          END
      WHERE id = v_account;
    END LOOP;
  END IF;

  UPDATE public.books_plaid_items
  SET cursor = p_next_cursor,
      sync_lease_token = NULL,
      sync_leased_until = NULL,
      last_synced_at = now(),
      updated_at = now()
  WHERE id = v_item.id;
END;
$$;

-- ── Job RPCs (service-only) ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consumer_claim_jobs(p_token UUID)
RETURNS SETOF public.books_interpretation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner UUID;
BEGIN
  -- Expired processing leases: retryable unless attempts are exhausted.
  UPDATE public.books_interpretation_jobs
  SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
      lease_token = NULL, leased_until = NULL, available_at = now(), updated_at = now()
  WHERE status = 'processing' AND leased_until IS NOT NULL AND leased_until < now();

  SELECT user_id INTO v_owner
  FROM public.books_interpretation_jobs
  WHERE status = 'pending' AND attempts < 3 AND available_at <= now()
  ORDER BY available_at ASC, transaction_id ASC
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT j.transaction_id
    FROM public.books_interpretation_jobs j
    WHERE j.user_id = v_owner
      AND j.status = 'pending'
      AND j.attempts < 3
      AND j.available_at <= now()
    ORDER BY j.available_at ASC, j.transaction_id ASC
    LIMIT 20
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.books_interpretation_jobs j
  SET status = 'processing',
      attempts = j.attempts + 1,
      lease_token = p_token,
      leased_until = now() + interval '60 seconds',
      updated_at = now()
  FROM due
  WHERE j.transaction_id = due.transaction_id
  RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.consumer_finish_job(
  p_transaction_id UUID,
  p_token UUID,
  p_source_revision INTEGER,
  p_error_code TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempts INTEGER;
BEGIN
  IF p_error_code IS NULL THEN
    UPDATE public.books_interpretation_jobs
    SET status = 'done', lease_token = NULL, leased_until = NULL,
        last_error_code = NULL, updated_at = now()
    WHERE transaction_id = p_transaction_id
      AND lease_token = p_token
      AND source_revision = p_source_revision;
    RETURN;
  END IF;

  SELECT attempts INTO v_attempts
  FROM public.books_interpretation_jobs
  WHERE transaction_id = p_transaction_id
    AND lease_token = p_token
    AND source_revision = p_source_revision
  FOR UPDATE;

  IF NOT FOUND THEN
    -- stale worker against newer data; leave the newer job untouched.
    RETURN;
  END IF;

  IF v_attempts >= 3 THEN
    UPDATE public.books_interpretation_jobs
    SET status = 'failed', lease_token = NULL, leased_until = NULL,
        last_error_code = p_error_code, updated_at = now()
    WHERE transaction_id = p_transaction_id;
  ELSE
    UPDATE public.books_interpretation_jobs
    SET status = 'pending',
        lease_token = NULL,
        leased_until = NULL,
        available_at = now() + (CASE WHEN v_attempts >= 2
                                     THEN interval '300 seconds'
                                     ELSE interval '60 seconds' END),
        last_error_code = p_error_code,
        updated_at = now()
    WHERE transaction_id = p_transaction_id;
  END IF;
END;
$$;

-- ── RLS, lease guard and grants ─────────────────────────────────────────────

ALTER TABLE public.books_interpretation_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.books_interpretation_jobs FROM PUBLIC;

-- Owners may edit their Plaid items, but lease columns are service-only; forged
-- writes are ignored rather than breaking legitimate edits.
CREATE OR REPLACE FUNCTION public.books_plaid_items_guard_lease()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.sync_lease_token := OLD.sync_lease_token;
    NEW.sync_leased_until := OLD.sync_leased_until;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_plaid_items_guard_lease ON public.books_plaid_items;
CREATE TRIGGER trg_books_plaid_items_guard_lease
  BEFORE UPDATE ON public.books_plaid_items
  FOR EACH ROW EXECUTE FUNCTION public.books_plaid_items_guard_lease();

REVOKE EXECUTE ON FUNCTION public.books_tx_sync_job() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_claim_sync(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_release_sync(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_write_plaid_page(TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_finish_sync(TEXT, UUID, TEXT[], JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_claim_jobs(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_finish_job(UUID, UUID, INTEGER, TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_claim_sync(TEXT, UUID) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_release_sync(TEXT, UUID) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_write_plaid_page(TEXT, UUID, JSONB) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_finish_sync(TEXT, UUID, TEXT[], JSONB, TEXT) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_claim_jobs(UUID) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_finish_job(UUID, UUID, INTEGER, TEXT) TO service_role';
    EXECUTE 'GRANT ALL ON public.books_interpretation_jobs TO service_role';
  END IF;
END $$;
