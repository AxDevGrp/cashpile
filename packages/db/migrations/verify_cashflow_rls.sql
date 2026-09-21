-- ============================================================================
-- CASHPILE — Cross-user RLS verification for cashflow persistence (WP2 gate)
-- Simulates two users the way PostgREST does: SET ROLE authenticated/anon
-- plus request.jwt.claims, inside one transaction. Running as the table owner
-- (plain postgres) would bypass RLS entirely, so every probe switches role.
-- The transaction ROLLS BACK at the end: no data is left behind.
-- Execute after migrations 023–026 are applied.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  recurring_id uuid;
  account_id uuid;
  action_id uuid;
  pass_count int := 0;
  fail_count int := 0;
  blocked boolean;
BEGIN
  -- Create two throwaway users as postgres (rolled back at the end).
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (user_a, 'rls-probe-a@invalid.test', 'x', NOW(), NOW(), NOW()),
    (user_b, 'rls-probe-b@invalid.test', 'x', NOW(), NOW(), NOW());

  -- Act as user A through the same role PostgREST uses.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  INSERT INTO cashflow_recurring_items (user_id, stable_key, direction, merchant, description_pattern, amount_bucket, cadence, amount, next_date, included, confirmed_at, source)
  VALUES (user_a, 'expense|probe rent|1500', 'expense', 'Probe Rent', 'probe rent', 1500, 'monthly', 1500, '2026-10-01', true, NOW(), 'manual')
  RETURNING id INTO recurring_id;

  INSERT INTO books_financial_accounts (user_id, name, account_type, current_balance, is_active, cashflow_role, cashflow_include)
  VALUES (user_a, 'Probe Checking', 'checking', 1000, true, 'spending_source', true)
  RETURNING id INTO account_id;

  INSERT INTO cashflow_action_state (user_id, action_key, pinned)
  VALUES (user_a, 'priority_pin', true)
  RETURNING id INTO action_id;

  -- Probe 0: user A can read and update their own rows (positive control).
  blocked := EXISTS (SELECT 1 FROM cashflow_recurring_items WHERE id = recurring_id AND user_id = user_a);
  IF blocked THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: owner sees and manages their own recurring item';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: owner cannot see their own recurring item'; END IF;

  -- All remaining probes act as user B.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- Probe 1: user B cannot SELECT user A's recurring item.
  blocked := NOT EXISTS (SELECT 1 FROM cashflow_recurring_items WHERE id = recurring_id);
  IF blocked THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: cross-user recurring SELECT blocked';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: cross-user recurring SELECT returned data'; END IF;

  -- Probe 2: user B cannot UPDATE user A's recurring item.
  UPDATE cashflow_recurring_items SET amount = 42 WHERE id = recurring_id;
  IF NOT FOUND THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: cross-user recurring UPDATE blocked';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: cross-user recurring UPDATE succeeded'; END IF;

  -- Probe 3: user B cannot DELETE user A's recurring item.
  DELETE FROM cashflow_recurring_items WHERE id = recurring_id;
  IF NOT FOUND THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: cross-user recurring DELETE blocked';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: cross-user recurring DELETE succeeded'; END IF;

  -- Probe 4: user B cannot INSERT a recurring item forged as user A.
  blocked := false;
  BEGIN
    INSERT INTO cashflow_recurring_items (user_id, stable_key, direction, cadence, amount, merchant, description_pattern, amount_bucket)
    VALUES (user_a, 'expense|probe forged|100', 'expense', 'monthly', 100, 'Forged', 'probe forged', 100);
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    blocked := true;
  END;
  IF blocked THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: forged recurring INSERT (user B writing as user A) blocked';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: forged recurring INSERT succeeded'; END IF;

  -- Probe 5: user B cannot UPDATE user A's account plan settings.
  UPDATE books_financial_accounts SET cashflow_role = 'ignore' WHERE id = account_id;
  IF NOT FOUND THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: cross-user account UPDATE blocked';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: cross-user account UPDATE succeeded'; END IF;

  -- Probe 6: user B cannot read user A's action state.
  blocked := NOT EXISTS (SELECT 1 FROM cashflow_action_state WHERE id = action_id);
  IF blocked THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: cross-user action state SELECT blocked';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: cross-user action state SELECT returned data'; END IF;

  -- Probe 7: user B cannot update user A's settings (created by the signup trigger).
  UPDATE user_settings SET minimum_cash_buffer = 0 WHERE user_id = user_a;
  IF NOT FOUND THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: cross-user settings UPDATE blocked';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: cross-user settings UPDATE succeeded'; END IF;

  -- Probe 8: a user context with no valid claims sees nothing.
  PERFORM set_config('request.jwt.claims', NULL, true);
  blocked := NOT EXISTS (SELECT 1 FROM cashflow_recurring_items WHERE id = recurring_id);
  IF blocked THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: null-claims recurring SELECT blocked';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: null-claims recurring SELECT returned data'; END IF;

  -- Probe 9: feature flags are readable by authenticated users (needed by the app).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  blocked := EXISTS (SELECT 1 FROM app_feature_flags WHERE key = 'decision_first_experience');
  IF blocked THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: feature flags readable by authenticated users';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: feature flags not readable — the app cannot check the flag'; END IF;

  -- Probe 10: authenticated users cannot write feature flags.
  blocked := false;
  BEGIN
    UPDATE app_feature_flags SET enabled = true WHERE key = 'decision_first_experience';
    IF FOUND THEN blocked := false; ELSE blocked := true; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := true;
  END;
  IF blocked THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS: feature flag writes blocked for app users';
  ELSE fail_count := fail_count + 1; RAISE NOTICE 'FAIL: feature flag write succeeded — flag is not operator-controlled'; END IF;

  RAISE NOTICE 'RLS VERIFICATION RESULT: % passed, % failed', pass_count, fail_count;
  IF fail_count > 0 THEN
    RAISE EXCEPTION 'cross-user RLS verification FAILED (% probes)', fail_count;
  END IF;
END $$;

ROLLBACK;