#!/usr/bin/env bash
# ============================================================================
# CASHPILE — Stage 08: agent connection cap is atomic (rollback-safe)
#
# Usage:
#   DATABASE_URL="postgres://..." ./packages/db/tests/consumer-agent-concurrency.sh
#
# Runs two simultaneous "tenth active connection" attempts for one owner and
# asserts exactly one succeeds. The per-owner advisory lock in
# consumer_create_agent serializes them, so the second sees the cap and is
# rejected with limit_reached. A dedicated test owner is created and removed.
# Never run against production. Requires migrations 010 + 029.
# ============================================================================

set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your Supabase Postgres connection string}"

PSQL="${PSQL:-psql}"
OWNER='88888888-8888-8888-8888-888888888888'
CLAIMS='{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}'
TMP="$(mktemp -d)"
trap 'cleanup; rm -rf "$TMP"' EXIT

cleanup() {
  "$PSQL" "$DATABASE_URL" -q -c "
    DELETE FROM public.agent_rate_windows WHERE user_id = '$OWNER';
    DELETE FROM public.agent_connections WHERE user_id = '$OWNER';
    DELETE FROM auth.users WHERE id = '$OWNER';" >/dev/null 2>&1 || true
}

# Test owner + exactly nine active connections.
"$PSQL" "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '$OWNER', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'concurrency@example.test', '', now(), '{}', '{}', now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  DELETE FROM public.agent_connections WHERE user_id = '$OWNER';
  INSERT INTO public.agent_connections (user_id, agent_name, token_hash, scopes, status)
  SELECT '$OWNER', 'filler ' || g, repeat(md5(g::text), 2),
         '[\"cashboard:read\"]'::jsonb, 'active'
  FROM generate_series(1, 9) g;"

"$PSQL" "$DATABASE_URL" -tAc \
  "SET request.jwt.claims='$CLAIMS'; SELECT public.consumer_create_agent('Race A', repeat('a',64));" \
  > "$TMP/a.out" 2>&1 &
P1=$!
"$PSQL" "$DATABASE_URL" -tAc \
  "SET request.jwt.claims='$CLAIMS'; SELECT public.consumer_create_agent('Race B', repeat('b',64));" \
  > "$TMP/b.out" 2>&1 &
P2=$!

set +e
wait "$P1"; R1=$?
wait "$P2"; R2=$?
set -e

OK=0
FAIL=0
if [ "$R1" -eq 0 ] && [ "$R2" -ne 0 ]; then OK=1; fi
if [ "$R1" -ne 0 ] && [ "$R2" -eq 0 ]; then OK=1; fi
REJECTED="$(grep -l 'ERROR:  limit_reached' "$TMP/a.out" "$TMP/b.out" 2>/dev/null | wc -l | tr -d ' ')"
ACTIVE="$("$PSQL" "$DATABASE_URL" -tAc \
  "select count(*) from public.agent_connections where user_id='$OWNER' and status='active';")"

if [ "$OK" -ne 1 ] || [ "$REJECTED" -ne 1 ] || [ "$ACTIVE" -ne 10 ]; then
  echo "FAIL: expected exactly one success, one limit_reached, 10 active (ok=$OK rejected=$REJECTED active=$ACTIVE)"
  FAIL=1
else
  echo "PASS: concurrent 10th creation — one success, one limit_reached, 10 active"
fi

exit "$FAIL"
