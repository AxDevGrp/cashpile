#!/usr/bin/env bash
# ============================================================================
# CASHPILE — Apply WP migrations and verify cross-user RLS in one command.
#
# Usage:
#   DATABASE_URL="postgres://..." ./packages/db/migrations/apply_cashpile_wp_migrations.sh
#
# DATABASE_URL is the Supabase Postgres connection string
# (Supabase Dashboard → Project Settings → Database → Connection string → URI).
# Applies 023–026 (idempotent, each in its own transaction) and then runs the
# read-only cross-user RLS verification, which rolls itself back.
# ============================================================================

set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your Supabase Postgres connection string}"

BASE="$(cd "$(dirname "$0")" && pwd)"

MIGRATIONS=(
  "023_cashflow_balance_basis.sql"
  "024_cashflow_persistence.sql"
  "025_feature_flags.sql"
  "026_books_transaction_notes.sql"
)

for file in "${MIGRATIONS[@]}"; do
  echo "==> Applying $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$BASE/$file"
done

echo "==> Running cross-user RLS verification (read-only; rolls back)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$BASE/verify_cashflow_rls.sql"

echo "==> Done. To enable the new experience for a user, run:"
echo "    UPDATE app_feature_flags SET cohorts = cohorts || '<user-uuid>' WHERE key = 'decision_first_experience';"
echo "    To enable for everyone: UPDATE app_feature_flags SET enabled = true WHERE key = 'decision_first_experience';"