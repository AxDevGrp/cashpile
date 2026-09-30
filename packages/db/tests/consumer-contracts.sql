-- ============================================================================
-- CASHPILE — Stage 01 consumer contracts (rollback-only fixture)
--
-- Run against an ISOLATED database that already has migrations 001–028:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/tests/consumer-contracts.sql
--
-- Never run against production. Everything is wrapped in BEGIN/ROLLBACK. The
-- script bootstraps synthetic owners A/B by id (auth.users insert fires the
-- handle_new_user trigger), builds a small ledger as the privileged role, then
-- exercises RLS, revision, rule, job and lease contracts as the real
-- authenticated / service roles with JWT claims.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Idempotent synthetic owners. Fixed ids so assertions can reference them.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner-a@example.test', '',
   now(), '{}', '{}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner-b@example.test', '',
   now(), '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ── Fixture ledger (privileged role; RLS bypassed) ──────────────────────────

INSERT INTO public.books_financial_accounts
  (id, user_id, name, account_type, currency_code, cashflow_include, is_active, current_balance)
VALUES
  ('aac00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'A Checking', 'checking', 'USD', true, true, 4020.00),
  ('aac00000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'A Excluded', 'checking', 'USD', false, true, 600.00),
  ('bbc00000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'B Checking', 'checking', 'USD', true, true, 500.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.books_categories (id, user_id, name, category_type)
VALUES (900001, '11111111-1111-1111-1111-111111111111', 'Housing', 'expense')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.books_transactions
  (id, user_id, financial_account_id, description, merchant, amount, date, transaction_type, import_source)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aac00000-0000-0000-0000-000000000001', 'Rent', 'Landlord', -1150.00, '2026-09-15', 'debit', 'manual'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aac00000-0000-0000-0000-000000000001', 'Paycheck', 'Employer', 2000.00, '2026-09-16', 'credit', 'manual'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'bbc00000-0000-0000-0000-000000000001', 'B Rent', 'Landlord', -900.00, '2026-09-15', 'debit', 'manual')
ON CONFLICT (id) DO NOTHING;

-- ── Assertion 1: trigger created one interpretation and one job per row ─────

DO $$
DECLARE
  n_interp INT;
  n_jobs INT;
BEGIN
  SELECT count(*) INTO n_interp FROM public.books_transaction_interpretations
   WHERE transaction_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  SELECT count(*) INTO n_jobs FROM public.books_interpretation_jobs
   WHERE transaction_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  IF n_interp <> 1 OR n_jobs <> 1 THEN
    RAISE EXCEPTION 'FAIL: insert triggers expected 1 interpretation/1 job, got %/%', n_interp, n_jobs;
  END IF;
  RAISE NOTICE 'PASS: insert creates 1 interpretation + 1 job';
END $$;

-- ── Assertion 2: unauthenticated callers are rejected by save ───────────────

DO $$
BEGIN
  BEGIN
    PERFORM public.consumer_save_review(
      'aaaaaaaa-0000-0000-0000-000000000001', 1, 'spend', 900001, false);
    RAISE EXCEPTION 'FAIL: unauthenticated save was allowed';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM <> 'not_found' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: unauthenticated save rejected';
END $$;

-- ── Assertion 3: owner A RLS + direct-write denial ──────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
  n_own INT;
  n_foreign INT;
BEGIN
  SELECT count(*) INTO n_own FROM public.books_transaction_interpretations
   WHERE user_id = '11111111-1111-1111-1111-111111111111';
  SELECT count(*) INTO n_foreign FROM public.books_transaction_interpretations
   WHERE user_id = '22222222-2222-2222-2222-222222222222';
  IF n_own < 2 THEN RAISE EXCEPTION 'FAIL: A cannot read own interpretations (%)', n_own; END IF;
  IF n_foreign <> 0 THEN RAISE EXCEPTION 'FAIL: A can read B interpretations (%)', n_foreign; END IF;
  RAISE NOTICE 'PASS: interpretation RLS isolates owners';
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.books_transaction_interpretations (transaction_id, user_id)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
    RAISE EXCEPTION 'FAIL: direct authenticated insert into interpretations allowed';
  EXCEPTION WHEN sqlstate '42501' OR sqlstate 'P0001' THEN
    NULL; -- expected: RLS / privilege denial
  END;
  RAISE NOTICE 'PASS: direct interpretation insert denied';
END $$;

-- ── Assertion 4: save bumps revision; stale save conflicts ──────────────────

DO $$
DECLARE
  res JSONB;
BEGIN
  res := public.consumer_save_review(
    'aaaaaaaa-0000-0000-0000-000000000001', 1, 'spend', 900001, false);
  IF (res->>'revision')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected revision 2 after save, got %', res->>'revision';
  END IF;
  RAISE NOTICE 'PASS: save advances revision to 2';
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.consumer_save_review(
      'aaaaaaaa-0000-0000-0000-000000000001', 1, 'spend', 900001, false);
    RAISE EXCEPTION 'FAIL: stale revision save succeeded';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'revision_conflict' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: stale revision save conflicts';
END $$;

-- A cannot use B's transaction.
DO $$
BEGIN
  BEGIN
    PERFORM public.consumer_save_review(
      'bbbbbbbb-0000-0000-0000-000000000001', 1, 'spend', 900001, false);
    RAISE EXCEPTION 'FAIL: A saved B transaction';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'not_found' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: foreign transaction rejected';
END $$;

-- ── Assertion 5: remember creates an exact rule only ────────────────────────

DO $$
DECLARE
  n_exact INT;
  n_wrong_amount INT;
BEGIN
  PERFORM public.consumer_save_review(
    'aaaaaaaa-0000-0000-0000-000000000002', 1, 'income', NULL, true);
  SELECT count(*) INTO n_exact FROM public.books_consumer_rules
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND financial_account_id = 'aac00000-0000-0000-0000-000000000001'
     AND normalized_description = 'paycheck'
     AND signed_amount_cents = 200000;
  SELECT count(*) INTO n_wrong_amount FROM public.books_consumer_rules
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND normalized_description = 'paycheck'
     AND signed_amount_cents = 199999;
  IF n_exact <> 1 THEN RAISE EXCEPTION 'FAIL: exact rule not stored'; END IF;
  IF n_wrong_amount <> 0 THEN RAISE EXCEPTION 'FAIL: rule matched wrong amount'; END IF;
  RAISE NOTICE 'PASS: exact rule stored, mismatch absent';
END $$;

-- Remove A rule rows before summary checks so nothing else surprises us.
DELETE FROM public.books_consumer_rules
 WHERE user_id = '11111111-1111-1111-1111-111111111111';

RESET ROLE;

-- ── Assertion 6: summary/page as service over owner A ───────────────────────

DO $$
DECLARE
  s JSONB;
  p JSONB;
BEGIN
  s := public.consumer_review_summary('11111111-1111-1111-1111-111111111111', NULL);
  -- A: Rent now spend+categorised (resolved), Paycheck income w/o category still
  -- review_required (spend/income requires category) => count >= 1, credit 200000.
  IF (s->>'creditCents')::bigint <> 200000 THEN
    RAISE EXCEPTION 'FAIL: summary creditCents = %', s->>'creditCents';
  END IF;
  IF (s->>'debitCents')::bigint <> 0 THEN
    RAISE EXCEPTION 'FAIL: resolved spend should not be in queue, debitCents = %', s->>'debitCents';
  END IF;

  p := public.consumer_review_page('11111111-1111-1111-1111-111111111111', NULL, 10, NULL);
  IF jsonb_array_length(p->'items') < 1 THEN
    RAISE EXCEPTION 'FAIL: page returned no items';
  END IF;
  IF (p->'items'->0->>'amountCents')::bigint <> 200000 THEN
    RAISE EXCEPTION 'FAIL: first item should be unknown positive credit';
  END IF;
  RAISE NOTICE 'PASS: review summary/page counts';
END $$;

-- Bad cursor rejected.
DO $$
BEGIN
  BEGIN
    PERFORM public.consumer_review_page(
      '11111111-1111-1111-1111-111111111111', NULL, 10, '{"up":true}'::jsonb);
    RAISE EXCEPTION 'FAIL: malformed cursor accepted';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'invalid_input' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: malformed cursor rejected';
END $$;

-- ── Assertion 7: source replay no-op, source change bumps + resets job ──────

DO $$
DECLARE
  r_before INT;
  r_after INT;
  job_rev INT;
BEGIN
  SELECT revision INTO r_before FROM public.books_transaction_interpretations
   WHERE transaction_id = 'aaaaaaaa-0000-0000-0000-000000000002';

  UPDATE public.books_transactions
     SET description = 'Paycheck'
   WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';

  SELECT revision INTO r_after FROM public.books_transaction_interpretations
   WHERE transaction_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  IF r_after <> r_before THEN
    RAISE EXCEPTION 'FAIL: identical replay changed revision % -> %', r_before, r_after;
  END IF;

  UPDATE public.books_transactions
     SET amount = 2100.00
   WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';

  SELECT revision INTO r_after FROM public.books_transaction_interpretations
   WHERE transaction_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  SELECT source_revision INTO job_rev FROM public.books_interpretation_jobs
   WHERE transaction_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  IF r_after <= r_before THEN
    RAISE EXCEPTION 'FAIL: source change did not bump interpretation revision';
  END IF;
  IF job_rev <> 2 THEN
    RAISE EXCEPTION 'FAIL: source change did not reset job to source_revision 2 (got %)', job_rev;
  END IF;
  RAISE NOTICE 'PASS: replay no-op; source change bumps revision + resets job';
END $$;

-- ── Assertion 8: claim/finish job lifecycle (service role) ──────────────────

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';

DO $$
DECLARE
  claimed RECORD;
  tok UUID := gen_random_uuid();
  n INT;
BEGIN
  SELECT * INTO claimed FROM public.consumer_claim_jobs(tok) LIMIT 1;
  IF claimed.transaction_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: claim_jobs returned nothing';
  END IF;
  PERFORM public.consumer_finish_job(claimed.transaction_id, tok, claimed.source_revision, NULL);
  SELECT count(*) INTO n FROM public.books_interpretation_jobs
   WHERE transaction_id = claimed.transaction_id AND status = 'done';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: finish_job did not mark done'; END IF;
  RAISE NOTICE 'PASS: claim/finish job lifecycle';
END $$;

-- Exhausted attempts become terminal on failure.
DO $$
DECLARE
  tok UUID := gen_random_uuid();
  tx UUID := 'aaaaaaaa-0000-0000-0000-000000000002';
  sr INT;
  st TEXT;
BEGIN
  SELECT source_revision INTO sr FROM public.books_interpretation_jobs WHERE transaction_id = tx;
  UPDATE public.books_interpretation_jobs
     SET status = 'processing', attempts = 3, lease_token = tok,
         leased_until = now() + interval '60 seconds'
   WHERE transaction_id = tx;
  PERFORM public.consumer_finish_job(tx, tok, sr, 'model_error');
  SELECT status INTO st FROM public.books_interpretation_jobs WHERE transaction_id = tx;
  IF st <> 'failed' THEN RAISE EXCEPTION 'FAIL: third failure not terminal (status %)', st; END IF;
  RAISE NOTICE 'PASS: third failure terminal';
END $$;

-- ── Assertion 9: sync lease single-owner + finish applies balances ──────────

DO $$
DECLARE
  item TEXT := 'item-fixture-1';
  tok1 UUID := gen_random_uuid();
  tok2 UUID := gen_random_uuid();
  ok1 BOOLEAN;
  ok2 BOOLEAN;
  aid UUID := 'aac00000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.books_plaid_items (id, user_id, item_id, access_token, status)
  VALUES ('cccc0000-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', item, 'token-x', 'active')
  ON CONFLICT (item_id) DO NOTHING;

  UPDATE public.books_financial_accounts
     SET plaid_item_id = 'cccc0000-0000-0000-0000-000000000001'
   WHERE id = aid;

  ok1 := public.consumer_claim_sync(item, tok1);
  ok2 := public.consumer_claim_sync(item, tok2);
  IF NOT ok1 OR ok2 THEN
    RAISE EXCEPTION 'FAIL: sync lease not exclusive (%, %)', ok1, ok2;
  END IF;

  -- Old token cannot finish once lease is held by tok1? tok1 still holds it.
  PERFORM public.consumer_finish_sync(item, tok1, ARRAY[]::TEXT[],
    jsonb_build_array(jsonb_build_object(
      'account_id', aid, 'current_balance', 1234.56,
      'available_balance', 1200.00, 'currency_code', 'USD',
      'balance_as_of', '2026-09-20T12:00:00Z')),
    'cursor-1');

  IF (SELECT current_balance FROM public.books_financial_accounts WHERE id = aid) <> 1234.56 THEN
    RAISE EXCEPTION 'FAIL: finish_sync did not apply balance';
  END IF;
  IF (SELECT balance_as_of FROM public.books_financial_accounts WHERE id = aid) IS NULL THEN
    RAISE EXCEPTION 'FAIL: finish_sync did not set balance_as_of';
  END IF;
  IF (SELECT sync_lease_token FROM public.books_plaid_items WHERE item_id = item) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: finish_sync did not clear lease';
  END IF;
  RAISE NOTICE 'PASS: sync lease exclusive; finish applies balances + clears lease';
END $$;

RESET ROLE;

-- ============================================================================
-- Stage 04 — consumer review queue fixtures (rollback-only)
-- Rebuild owner A's ledger, then verify queue order/counts, pagination,
-- eligibility inference and revision-guarded resolve.
-- ============================================================================

DELETE FROM public.books_transactions WHERE user_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.books_financial_accounts WHERE user_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.books_categories WHERE user_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.books_financial_accounts
  (id, user_id, name, account_type, currency_code, cashflow_include, is_active, current_balance)
VALUES
  ('aac00000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'A Checking', 'checking', 'USD', true, true, 4020),
  ('aac00000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'A Excluded', 'checking', 'USD', false, true, 600);

INSERT INTO public.books_categories (id, user_id, name, category_type)
VALUES (900001, '11111111-1111-1111-1111-111111111111', 'Housing', 'expense');

INSERT INTO public.books_transactions
  (id, user_id, financial_account_id, description, merchant, amount, date, transaction_type, import_source, provider_data, category_id)
VALUES
  ('a4010000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aac00000-0000-0000-0000-0000000000a1', 'Unknown credit', 'X', 2000.00, '2026-09-10', 'credit', 'manual', '{}', NULL),
  ('a4010000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aac00000-0000-0000-0000-0000000000a1', 'Rent', 'Landlord', -1150.00, '2026-09-15', 'debit', 'manual', '{}', NULL),
  ('a4010000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aac00000-0000-0000-0000-0000000000a1', 'Fee', 'Bank', -90.00, '2026-09-16', 'debit', 'manual', '{}', NULL),
  ('a4010000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aac00000-0000-0000-0000-0000000000a1', 'Categorized', 'Store', -50.00, '2026-09-17', 'debit', 'manual', '{}', 900001),
  ('a4010000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'aac00000-0000-0000-0000-0000000000a1', 'Pending', 'P', -500.00, '2026-09-18', 'debit', 'manual', '{"pending":true}', NULL),
  ('a4010000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'aac00000-0000-0000-0000-0000000000a2', 'Excluded acct', 'E', -600.00, '2026-09-19', 'debit', 'manual', '{}', NULL);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
  s JSONB;
  p JSONB;
  p2 JSONB;
BEGIN
  s := public.consumer_review_summary('11111111-1111-1111-1111-111111111111', NULL);
  IF (s->>'count')::int <> 4 THEN RAISE EXCEPTION 'FAIL queue count=%', s->>'count'; END IF;
  IF (s->>'debitCents')::bigint <> 129000 THEN RAISE EXCEPTION 'FAIL queue debit=%', s->>'debitCents'; END IF;
  IF (s->>'creditCents')::bigint <> 200000 THEN RAISE EXCEPTION 'FAIL queue credit=%', s->>'creditCents'; END IF;

  p := public.consumer_review_page('11111111-1111-1111-1111-111111111111', NULL, 2, NULL);
  IF jsonb_array_length(p->'items') <> 2 THEN RAISE EXCEPTION 'FAIL page1 length'; END IF;
  IF (p->'items'->0->>'amountCents')::bigint <> 200000 THEN RAISE EXCEPTION 'FAIL order0'; END IF;
  IF (p->'items'->1->>'amountCents')::bigint <> -115000 THEN RAISE EXCEPTION 'FAIL order1'; END IF;
  IF p->'nextCursor' IS NULL THEN RAISE EXCEPTION 'FAIL page1 cursor'; END IF;

  p2 := public.consumer_review_page('11111111-1111-1111-1111-111111111111', NULL, 2, p->'nextCursor');
  IF jsonb_array_length(p2->'items') <> 2 THEN RAISE EXCEPTION 'FAIL page2 length'; END IF;
  IF (p2->'items'->0->>'amountCents')::bigint <> -9000 THEN RAISE EXCEPTION 'FAIL order2'; END IF;
  IF (p2->'items'->1->>'amountCents')::bigint <> -5000 THEN RAISE EXCEPTION 'FAIL order3'; END IF;
  RAISE NOTICE 'PASS: stage 04 queue order, counts and pagination';
END $$;

DO $$
DECLARE
  res JSONB;
  s JSONB;
BEGIN
  res := public.consumer_save_review('a4010000-0000-0000-0000-000000000002', 1, 'spend', 900001, false);
  IF (res->>'revision')::int <> 2 THEN RAISE EXCEPTION 'FAIL rent revision=%', res->>'revision'; END IF;
  s := public.consumer_review_summary('11111111-1111-1111-1111-111111111111', NULL);
  IF (s->>'count')::int <> 3 THEN RAISE EXCEPTION 'FAIL resolved count=%', s->>'count'; END IF;
  IF (s->>'debitCents')::bigint <> 14000 THEN RAISE EXCEPTION 'FAIL resolved debit=%', s->>'debitCents'; END IF;
  RAISE NOTICE 'PASS: stage 04 resolve rent at expected revision';
END $$;

-- Eligibility: null role on included USD checking is eligible; null include and
-- an unknown type with no role are excluded.
RESET ROLE;
INSERT INTO public.books_financial_accounts
  (id, user_id, name, account_type, currency_code, cashflow_include, cashflow_role, is_active, current_balance)
VALUES
  ('aac00000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'Null role', 'checking', 'USD', true, NULL, true, 100),
  ('aac00000-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 'Null include', 'checking', 'USD', NULL, NULL, true, 100),
  ('aac00000-0000-0000-0000-0000000000b3', '11111111-1111-1111-1111-111111111111', 'Weird type', 'other', 'USD', true, NULL, true, 100);
INSERT INTO public.books_transactions
  (id, user_id, financial_account_id, description, merchant, amount, date, transaction_type, import_source, provider_data)
VALUES
  ('a4020000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aac00000-0000-0000-0000-0000000000b1', 'Null role', 'N', -10.00, '2026-09-20', 'debit', 'manual', '{}'),
  ('a4020000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aac00000-0000-0000-0000-0000000000b2', 'Null include', 'I', -10.00, '2026-09-21', 'debit', 'manual', '{}'),
  ('a4020000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aac00000-0000-0000-0000-0000000000b3', 'Weird type', 'W', -10.00, '2026-09-22', 'debit', 'manual', '{}');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  s JSONB;
BEGIN
  s := public.consumer_review_summary('11111111-1111-1111-1111-111111111111', NULL);
  IF (s->>'count')::int <> 4 THEN RAISE EXCEPTION 'FAIL eligibility count=%', s->>'count'; END IF;
  RAISE NOTICE 'PASS: stage 04 eligibility inference';
END $$;
RESET ROLE;

\echo 'ALL STAGE 04 CONSUMER REVIEW CHECKS PASSED'

-- Review must preserve a saved category when no replacement is submitted.
-- Runs last so these category edits do not change the eligibility fixtures above.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  tx UUID := 'a4010000-0000-0000-0000-000000000001';
  rev INTEGER;
  result JSONB;
  review_kind TEXT;
BEGIN
  UPDATE public.books_transactions SET category_id = 900001 WHERE id = tx;
  FOREACH review_kind IN ARRAY ARRAY['income','refund','passive_income','internal_transfer',
                                     'card_payment','asset_sale','loan_proceeds','unknown'] LOOP
    SELECT revision INTO rev FROM public.books_transaction_interpretations WHERE transaction_id = tx;
    result := public.consumer_save_review(tx, rev, review_kind, NULL, review_kind = 'income');
    IF (SELECT category_id FROM public.books_transactions WHERE id = tx) IS DISTINCT FROM 900001 THEN
      RAISE EXCEPTION 'FAIL: review with no replacement erased category for %', review_kind;
    END IF;
    IF (result->>'reviewRequired')::boolean IS DISTINCT FROM (review_kind = 'unknown') THEN
      RAISE EXCEPTION 'FAIL: review flag ignored preserved category for %', review_kind;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.books_consumer_rules WHERE category_id = 900001 AND kind = 'income') THEN
    RAISE EXCEPTION 'FAIL: remembered rule lost preserved category';
  END IF;
  tx := 'a4010000-0000-0000-0000-000000000002';
  SELECT revision INTO rev FROM public.books_transaction_interpretations WHERE transaction_id = tx;
  result := public.consumer_save_review(tx, rev, 'spend', NULL, false);
  IF (SELECT category_id FROM public.books_transactions WHERE id = tx) IS DISTINCT FROM 900001
     OR (result->>'reviewRequired')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: spend review did not preserve category';
  END IF;
  RAISE NOTICE 'PASS: review preserves category, completion flag, and remembered rule for all kinds';
END $$;
RESET ROLE;

\echo 'ALL STAGE 01 CONSUMER CONTRACT CHECKS PASSED'

ROLLBACK;
