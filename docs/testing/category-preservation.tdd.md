# Consumer review category preservation — 2026-09-30

## Scope and acceptance

Derived from the reported historical review backlog and request to preserve categories.
A review with no replacement category preserves the locked ledger category for all
review kinds; review completion and remembered rules use that same category.
Explicit category replacement remains supported. Intentional clearing remains in
the regular transaction editor. The review screen preselects the existing category
and resets selections when the transaction changes, including at the same index.
No historical categories or interpretation flags are restored by this change.

## Evidence

- Baseline: existing `packages/db/tests/consumer-contracts.sql` passed in isolated
  PostgreSQL 17 with synthetic users and local `auth.uid()` / `auth.role()` stubs.
- RED: new SQL assertions failed with `review with no replacement erased category
  for income` against migration 027's unchanged function. Checkpoint: `b65182b`.
- GREEN: applied `packages/db/migrations/20260930092211_preserve_review_category.sql`
  to that isolated database, then reran the same full contracts:
  `psql -h /tmp -p 55439 -d cashpile_category -v ON_ERROR_STOP=1 -f packages/db/tests/consumer-contracts.sql`.
  All Stage 01/04 checks passed, including preserved category/rule/review flag for
  every kind, existing owner isolation, stale revision, and ingestion contracts.
- Node: `node --test 'apps/web/src/app/(app)/books/transactions/ai-review/_components/consumer-review-client.test.ts' apps/web/src/modules/books/services/consumer-review.test.ts apps/web/src/modules/books/services/consumer-interpretation.test.ts`
  passed 19 tests. Executor observed the UI source regression check RED before its fix.
- Coverage: `node --test --experimental-test-coverage apps/web/src/modules/books/services/consumer-review.test.ts apps/web/src/modules/books/services/consumer-interpretation.test.ts`:
  combined service coverage 98.82% lines / 80% branches / 100% functions.
  This does not measure SQL or React runtime coverage.
- `pnpm --filter @cashpile/web exec tsc --noEmit --incremental false`: passed.
- `git diff --check`: passed.

## Review and limits

The new migration differs from the existing save function only by resolving a null
category from the already locked, owner-scoped transaction before category
validation, rule creation, and ledger updates. Auth, grants, revision checking,
sign validation, and locking are unchanged. Live function inspection matched the
original function body. Production fixtures were not run.

UI check is structural, not browser/E2E; browser behavior is not independently
verified. The database migration protects all callers, including older clients,
from null-category clearing, but the UI state-reset fix requires web deployment.
Apply the new migration explicitly; the older release helper only lists 010–029.

## Historical recovery investigation (read-only)

- June 9 repair backup: five matching transaction IDs have a historical category
  and a currently null category; all have unchanged amount/date/description.
  All five previously had Income; their latest update timestamps match Sept 30
  user review confirmations. One is now classified as a refund, so restoring
  that historical label deserves explicit review rather than blind overwrite.
- 432 currently uncategorized rows retain meaningful `original_csv_category`
  labels. Exact owner-scoped name matching finds 26 unique matches, 401 with no
  current category-name match, and five ambiguous matches. These are import
  evidence, not proof of the latest manually confirmed category.
- Another 14 CSV rows say `Uncategorized`, not a usable recovery label.
- One uncategorized row retains an Income assignment audit in metadata.
- No agent audit log rows. No complete historical recovery source established.

No production data changed. Restoration requires a reviewed, owner-scoped candidate
list; do not infer categories or mark the historical interpretation backlog resolved.
