#!/usr/bin/env bash
# ============================================================================
# CASHPILE — Apply release migrations and verify cross-user RLS in one command.
#
# Usage:
#   DATABASE_URL="postgres://..." ./packages/db/migrations/apply_cashpile_wp_migrations.sh
#
# DATABASE_URL is the Supabase Postgres connection string
# (Supabase Dashboard → Project Settings → Database → Connection string → URI).
#
# Each migration is applied only when its sentinel object is missing, so the
# script is safe to re-run and safe on a database that already has some of the
# chain. Order matters: 010 (agent tables) precedes 029, and 027 precedes 028.
# Afterwards the read-only cross-user RLS verification runs and rolls back.
#
# Production runs are a primary-owned release action (see docs/plans/
# cashboard-stages/09-acceptance.md). Back up first.
# ============================================================================

set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your Supabase Postgres connection string}"

BASE="$(cd "$(dirname "$0")" && pwd)"

# "sentinel SQL expression (non-null once applied)|migration file"
MIGRATIONS=(
  "to_regclass('public.agent_connections')|010_agentic_layer.sql"
  "(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='books_financial_accounts' AND column_name='available_balance')|023_cashflow_balance_basis.sql"
  "to_regclass('public.cashflow_recurring_items')|024_cashflow_persistence.sql"
  "to_regclass('public.app_feature_flags')|025_feature_flags.sql"
  "(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='books_transactions' AND column_name='notes')|026_books_transaction_notes.sql"
  "to_regclass('public.books_transaction_interpretations')|027_consumer_interpretation.sql"
  "to_regclass('public.books_interpretation_jobs')|028_consumer_ingestion.sql"
  "to_regclass('public.agent_rate_windows')|029_consumer_agent_controls.sql"
)

for entry in "${MIGRATIONS[@]}"; do
  sentinel="${entry%%|*}"
  file="${entry##*|}"
  applied="$(psql "$DATABASE_URL" -tAc "SELECT (${sentinel}) IS NOT NULL")"
  if [ "$applied" = "t" ]; then
    echo "==> Skipping $file (already applied)"
    continue
  fi
  echo "==> Applying $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$BASE/$file"
done

echo "==> Running cross-user RLS verification (read-only; rolls back)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$BASE/verify_cashflow_rls.sql"

echo "==> Done. To enable the new experience for a user, run:"
echo "    UPDATE app_feature_flags SET cohorts = cohorts || '<user-uuid>' WHERE key = 'decision_first_experience';"
echo "    To enable for everyone: UPDATE app_feature_flags SET enabled = true WHERE key = 'decision_first_experience';"
