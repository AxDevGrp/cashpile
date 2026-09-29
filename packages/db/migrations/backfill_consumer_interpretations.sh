#!/usr/bin/env bash
# ============================================================================
# CASHPILE — Backfill consumer interpretation + job rows (Stage 09, primary-run)
#
# Per docs/plans/cashboard-stages/01-persistence.md §"Triggers/backfill":
#   "Backfill only missing interpretation/job rows for existing transactions in
#    bounded, restartable batches of 1,000 ... Do not infer confirmed meaning
#    from old categories. New data starts automatically through triggers."
#
# Usage:
#   DATABASE_URL="postgres://..." \
#     packages/db/migrations/backfill_consumer_interpretations.sh [batch_size]
#
# Safe to re-run: inserts are ON CONFLICT DO NOTHING and only missing rows are
# targeted. New rows start kind='unknown' (review required); no old category is
# treated as a confirmed consumer meaning. Independent of the Plaid sync path.
# ============================================================================

set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your Supabase Postgres connection string}"

BATCH="${1:-1000}"
if ! [[ "$BATCH" =~ ^[0-9]+$ ]] || [ "$BATCH" -lt 1 ] || [ "$BATCH" -gt 5000 ]; then
  echo "batch size must be an integer 1..5000" >&2
  exit 1
fi

PSQL="${PSQL:-psql}"
total_interp=0
total_jobs=0
round=0

while :; do
  round=$((round + 1))
  read -r interp jobs < <("$PSQL" "$DATABASE_URL" -v ON_ERROR_STOP=1 -tA -F' ' -c "
    WITH missing_interp AS (
      SELECT t.id, t.user_id
      FROM public.books_transactions t
      WHERE NOT EXISTS (
        SELECT 1 FROM public.books_transaction_interpretations i
        WHERE i.transaction_id = t.id
      )
      ORDER BY t.id
      LIMIT $BATCH
    ),
    inserted_interp AS (
      INSERT INTO public.books_transaction_interpretations (transaction_id, user_id)
      SELECT id, user_id FROM missing_interp
      ON CONFLICT (transaction_id) DO NOTHING
      RETURNING 1
    ),
    missing_jobs AS (
      SELECT t.id, t.user_id, t.source_revision
      FROM public.books_transactions t
      WHERE NOT EXISTS (
        SELECT 1 FROM public.books_interpretation_jobs j
        WHERE j.transaction_id = t.id
      )
      ORDER BY t.id
      LIMIT $BATCH
    ),
    inserted_jobs AS (
      INSERT INTO public.books_interpretation_jobs (transaction_id, user_id, source_revision)
      SELECT id, user_id, source_revision FROM missing_jobs
      ON CONFLICT (transaction_id) DO NOTHING
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM inserted_interp), (SELECT count(*) FROM inserted_jobs);")

  interp="${interp:-0}"
  jobs="${jobs:-0}"
  total_interp=$((total_interp + interp))
  total_jobs=$((total_jobs + jobs))

  echo "batch $round: +$interp interpretations, +$jobs jobs (total $total_interp / $total_jobs)"

  if [ "$interp" -eq 0 ] && [ "$jobs" -eq 0 ]; then
    break
  fi
done

echo "done: backfilled $total_interp interpretation rows and $total_jobs job rows"
