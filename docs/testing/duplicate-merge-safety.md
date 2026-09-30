# Duplicate merge safety

## Bounded plan

Keep bank-linked transactions rather than moving provider IDs between rows.
1. Reproduce provider-ID loss through the actual single, bulk, and direct-delete actions using mocked database boundaries (executor owns tests).
2. Primary: prefer bank-linked default keepers; reject missing/foreign requested rows and deletion of bank-linked rows before merge writes. Preserve existing category fallback.
3. Primary: constrain delete statements to null provider IDs so a concurrent change cannot remove a bank ID; check affected rows and request refresh on mismatch.
4. Review executor tests and diff; run targeted tests, nearby ingestion/dedup tests and typecheck.

No schema change, provider-ID alias system, deployment, or live data cleanup.
Groups with multiple provider IDs must not discard any of those IDs. This is a conservative guard, not a solution for reconnection duplicates. Existing multi-request merges/batches remain non-transactional; this change does not claim otherwise.
