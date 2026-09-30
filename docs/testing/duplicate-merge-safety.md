# Duplicate merge safety

## Bounded plan

Keep bank-linked transactions rather than moving provider IDs between rows.
1. Reproduce provider-ID loss through the actual single, bulk, and direct-delete actions using mocked database boundaries (executor owns tests).
2. Primary: prefer bank-linked default keepers; reject missing/foreign requested rows and deletion of bank-linked rows before merge writes. Preserve existing category fallback.
3. Primary: constrain delete statements to null provider IDs so a concurrent change cannot remove a bank ID; check affected rows and request refresh on mismatch.
4. Review executor tests and diff; run targeted tests, nearby ingestion/dedup tests and typecheck.

No schema change, provider-ID alias system, deployment, or live data cleanup.
Groups with multiple provider IDs must not discard any of those IDs. This is a conservative guard, not a solution for reconnection duplicates. Existing multi-request merges/batches remain non-transactional; this change does not claim otherwise.

## Acceptance evidence

- Baseline: dedup fingerprint and Plaid ingestion tests passed (12 tests).
- RED: the executor's server-action harness ran the real transpiled actions against mocked auth/database boundaries. Single/bulk merge and direct deletion lacked the expected rejection for a bank-linked duplicate. Primary independently reproduced the single-merge `Missing expected rejection` before changing production code. Local RED checkpoint: `507eac6` (initial harness; subsequently corrected projection/delete chaining and fixture issues).
- GREEN: `node --test --experimental-test-coverage apps/web/src/modules/books/actions/duplicate.actions.test.ts apps/web/src/modules/books/services/duplicate-detection.test.ts apps/web/src/lib/plaid-ingestion.test.ts` passed 26 tests.
- Guarantees exercised: bank keeper priority; single/bulk/direct-delete refusal; two bank IDs blocked; missing and foreign duplicate rejection; existing category retained and missing category copied; repeated IDs normalized; delete-time provider-link races protected and not reported as success.
- `pnpm --filter @cashpile/web exec tsc --noEmit --incremental false` passed. `git diff --check` passed.
- Primary reviewed executor test implementation and UI help text. The guards and deletion predicate were implemented/reviewed by primary. No auth policy or schema changes.

## Limits

Tests mock database boundaries and execute the actual action code, but are not live Supabase integration or browser tests. Node coverage does not instrument the transpiled VM action code; no action coverage percentage is claimed. Adjacent instrumented modules report 83.52% lines / 82.22% branches / 58.82% functions; unrelated fuzzy matching is not exercised by this targeted suite.

This guards the duplicate-review merge and delete paths, not every general-purpose transaction deletion feature. It does not recover already-deleted bank IDs, prevent CSV re-imports after a CSV fingerprint is removed, or merge multiple provider IDs into an alias system. No production data was read or changed. No database migration is needed; web deployment is still pending.

References checked: [Supabase delete API](https://supabase.com/docs/reference/javascript/delete) and official changelog (fetched to a temporary file). Delete filters and returning selected IDs follow the existing client API.

Broader verification: `node --test apps/web/src/modules/books/services/*.test.ts apps/web/src/modules/books/actions/duplicate.actions.test.ts apps/web/src/lib/plaid-ingestion.test.ts` passed all 52 tests.
