-- ============================================================================
-- CASHPILE — Stage 08 consumer agent controls (rollback-only fixture)
--
-- Run against an ISOLATED database that already has migrations 001–029:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/tests/consumer-agent-controls.sql
--
-- Never run against production. Everything is wrapped in BEGIN/ROLLBACK.
-- Exercises the rate window (allow/reject/reset/purge), connection create cap,
-- direct-write denial, revoke idempotency and unauthenticated rejection.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Idempotent synthetic owners (auth.users insert fires handle_new_user).
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

DELETE FROM public.agent_connections
 WHERE user_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- ── Assertion 1: rate window allows limit then rejects; invalid limit denied ─

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';

DO $$
DECLARE
  v_owner UUID := '11111111-1111-1111-1111-111111111111';
  v_retry INT;
  i INT;
BEGIN
  FOR i IN 1..60 LOOP
    v_retry := public.consume_agent_rate(v_owner, 'cashboard.summary.get', 60);
    IF v_retry IS NOT NULL THEN
      RAISE EXCEPTION 'FAIL: request % was rejected early (retry %)', i, v_retry;
    END IF;
  END LOOP;

  v_retry := public.consume_agent_rate(v_owner, 'cashboard.summary.get', 60);
  IF v_retry IS NULL OR v_retry < 1 OR v_retry > 60 THEN
    RAISE EXCEPTION 'FAIL: 61st request not rejected with retry-after (got %)', v_retry;
  END IF;

  -- Rejection did not increment beyond the limit.
  IF (SELECT request_count FROM public.agent_rate_windows
       WHERE user_id = v_owner AND capability = 'cashboard.summary.get') <> 60 THEN
    RAISE EXCEPTION 'FAIL: rejected request incremented the counter';
  END IF;
  RAISE NOTICE 'PASS: 60 allowed then rate_limited with retry-after';
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.consume_agent_rate('11111111-1111-1111-1111-111111111111', 'cashboard.summary.get', 0);
    RAISE EXCEPTION 'FAIL: limit 0 accepted';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'invalid_input' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.consume_agent_rate('11111111-1111-1111-1111-111111111111', 'cashboard.summary.get', 121);
    RAISE EXCEPTION 'FAIL: limit 121 accepted';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'invalid_input' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: invalid limits rejected';
END $$;

-- ── Assertion 2: next window resets; purge retains nothing unbounded ────────

DO $$
DECLARE
  v_owner UUID := '11111111-1111-1111-1111-111111111111';
  v_retry INT;
  v_purged INT;
BEGIN
  UPDATE public.agent_rate_windows
     SET window_start = window_start - interval '2 minutes'
   WHERE user_id = v_owner AND capability = 'cashboard.summary.get';

  v_retry := public.consume_agent_rate(v_owner, 'cashboard.summary.get', 60);
  IF v_retry IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: next minute did not reset (retry %)', v_retry;
  END IF;

  -- Seed exactly one stale bucket, then confirm bounded purge removes it.
  DELETE FROM public.agent_rate_windows
   WHERE user_id = v_owner AND capability = 'cashboard.summary.get';
  INSERT INTO public.agent_rate_windows (user_id, capability, window_start, request_count)
  VALUES (v_owner, 'cashboard.summary.get', now() - interval '25 hours', 5);

  v_purged := public.purge_agent_rate_windows();
  IF v_purged < 1 THEN RAISE EXCEPTION 'FAIL: purge deleted nothing'; END IF;
  IF EXISTS (SELECT 1 FROM public.agent_rate_windows
              WHERE user_id = v_owner AND window_start < now() - interval '24 hours') THEN
    RAISE EXCEPTION 'FAIL: purge left stale buckets';
  END IF;
  RAISE NOTICE 'PASS: window reset and bounded purge';
END $$;

-- ── Assertion 3: token-hash-only create, fixed scope, cap of 10 ─────────────

RESET ROLE;
RESET request.jwt.claims;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
  v_id UUID;
  v_row public.agent_connections%ROWTYPE;
BEGIN
  v_id := public.consumer_create_agent('  My device  ', repeat('a', 64));
  SELECT * INTO v_row FROM public.agent_connections WHERE id = v_id;
  IF v_row.agent_name <> 'My device' THEN RAISE EXCEPTION 'FAIL: name not trimmed'; END IF;
  IF v_row.scopes <> '["cashboard:read"]'::jsonb THEN RAISE EXCEPTION 'FAIL: scope not fixed'; END IF;
  IF v_row.status <> 'active' THEN RAISE EXCEPTION 'FAIL: status not active'; END IF;
  IF v_row.token_hash <> repeat('a', 64) THEN RAISE EXCEPTION 'FAIL: hash not stored verbatim'; END IF;

  BEGIN
    PERFORM public.consumer_create_agent(repeat('x', 81), repeat('a', 64));
    RAISE EXCEPTION 'FAIL: over-long name accepted';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'invalid_input' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.consumer_create_agent('Bad hash', 'not-a-hash');
    RAISE EXCEPTION 'FAIL: bad hash accepted';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'invalid_input' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: create stores hash-only row with fixed scope';
END $$;

-- Top up to 10 active rows, then the 11th create is refused.
RESET ROLE;
INSERT INTO public.agent_connections (user_id, agent_name, token_hash, scopes, status)
SELECT '11111111-1111-1111-1111-111111111111',
       'filler ' || g, repeat(md5(g::text), 2), '["cashboard:read"]'::jsonb, 'active'
FROM generate_series(1, 9) g;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  n INT;
BEGIN
  SELECT count(*) INTO n FROM public.agent_connections
   WHERE user_id = '11111111-1111-1111-1111-111111111111' AND status = 'active';
  IF n <> 10 THEN RAISE EXCEPTION 'FAIL: expected 10 active rows, got %', n; END IF;
  BEGIN
    PERFORM public.consumer_create_agent('Eleventh', repeat('c', 64));
    RAISE EXCEPTION 'FAIL: 11th active connection allowed';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'limit_reached' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: 11th active creation rejected';
END $$;

-- ── Assertion 4: direct authenticated write denied ──────────────────────────

DO $$
DECLARE
  n INT;
BEGIN
  UPDATE public.agent_connections
     SET scopes = '["books:write"]'::jsonb
   WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: direct scope update affected % rows', n; END IF;

  UPDATE public.agent_connections
     SET status = 'revoked'
   WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: direct status update affected % rows', n; END IF;
  RAISE NOTICE 'PASS: direct authenticated scope/status update denied';
END $$;

-- Owner A cannot see owner B rows.
RESET ROLE;
INSERT INTO public.agent_connections (id, user_id, agent_name, token_hash, scopes, status)
VALUES ('dddd0000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222',
        'B agent', repeat('d', 64), '["cashboard:read"]'::jsonb, 'active')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  n INT;
BEGIN
  SELECT count(*) INTO n FROM public.agent_connections
   WHERE user_id = '22222222-2222-2222-2222-222222222222';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: A can see B connections (%)', n; END IF;
  RAISE NOTICE 'PASS: connection RLS isolates owners';
END $$;

-- ── Assertion 5: revoke is idempotent and owner-scoped ──────────────────────

DO $$
DECLARE
  v_id UUID := 'dddd0000-0000-0000-0000-0000000000a1';
  v_status TEXT;
BEGIN
  RESET ROLE;
  INSERT INTO public.agent_connections (id, user_id, agent_name, token_hash, scopes, status)
  VALUES (v_id, '11111111-1111-1111-1111-111111111111',
          'Revoke me', repeat('e', 64), '["cashboard:read"]'::jsonb, 'active');
  RESET request.jwt.claims;
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  PERFORM public.consumer_revoke_agent(v_id);
  SELECT status INTO v_status FROM public.agent_connections WHERE id = v_id;
  IF v_status <> 'revoked' THEN RAISE EXCEPTION 'FAIL: revoke did not set revoked'; END IF;

  -- Repeating revoke succeeds idempotently.
  PERFORM public.consumer_revoke_agent(v_id);

  -- Foreign id is not_found, not a silent success.
  BEGIN
    PERFORM public.consumer_revoke_agent('dddd0000-0000-0000-0000-0000000000b1');
    RAISE EXCEPTION 'FAIL: A revoked B connection';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'not_found' THEN RAISE; END IF;
  END;

  -- Nonexistent id is not_found.
  BEGIN
    PERFORM public.consumer_revoke_agent('dddd0000-0000-0000-0000-0000000000ff');
    RAISE EXCEPTION 'FAIL: nonexistent revoke succeeded';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'not_found' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: revoke idempotent, foreign/nonexistent rejected';
END $$;

-- ── Assertion 6: unauthenticated caller cannot create/revoke ────────────────

RESET ROLE;
RESET request.jwt.claims;
DO $$
BEGIN
  BEGIN
    PERFORM public.consumer_create_agent('No session', repeat('f', 64));
    RAISE EXCEPTION 'FAIL: unauthenticated create allowed';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'not_found' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.consumer_revoke_agent('dddd0000-0000-0000-0000-0000000000a1');
    RAISE EXCEPTION 'FAIL: unauthenticated revoke allowed';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'not_found' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: unauthenticated create/revoke rejected';
END $$;

\echo 'ALL STAGE 08 CONSUMER AGENT CONTROL CHECKS PASSED'

ROLLBACK;
