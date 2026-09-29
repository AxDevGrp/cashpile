# Stage 04 — clarification service and mutation contract

Requires stage 03. Build the service/API and tests only; visual screen is stage 06.

## Allowed files

- New `apps/web/src/modules/books/services/consumer-review.ts`, `consumer-review.test.ts`.
- New `apps/web/src/modules/books/actions/consumer-review.actions.ts`.
- New `apps/web/src/app/api/books/consumer-review/route.ts`, with thin HTTP mapping only.
- No migration edits: stage 01 already implements the SQL aggregate/list contracts below. If they differ, stop and return the defect to primary/stage 01 rather than editing applied SQL.
- `packages/db/tests/consumer-contracts.sql`; existing transaction/category actions only for the revalidation helper below.
- New `apps/web/src/lib/revalidate-consumer.ts` reused by relevant existing cashflow/account/transaction actions.

## DB query contract (implemented with stage 01)

Define `consumer_review_summary(p_user_id UUID,p_account_id UUID DEFAULT NULL) RETURNS JSONB` and `consumer_review_page(p_user_id UUID,p_account_id UUID,p_limit INTEGER,p_after JSONB) RETURNS JSONB` in stage 01; consume them here.

- Authenticated caller must have auth.uid()=p_user_id; trusted service callers supply a primary-authenticated owner. No unauthenticated execution. Explicit grants/RLS requirements from stage 01 apply.
- Shared base predicate: transaction+interpretation+account each owned by p_user_id; `a.is_active IS TRUE AND a.cashflow_include IS TRUE AND a.currency_code='USD' AND public.consumer_effective_role(a.cashflow_role,a.account_type)<>'ignore' AND COALESCE(t.provider_data->>'pending','false')='false' AND i.review_required IS TRUE`. Use the same joined predicate for page and summary. Null role uses stage-01 mapping; null inclusion is excluded. Provider mapper validates pending as boolean/null; SQL never casts arbitrary JSON text to boolean. Missing interpretation is a data-integrity error during release, not silently skipped forever.
- Summary `{count,debitCents,creditCents}` aggregates all rows. No cap, no netting. Count bigint converted to safe JS number with range check.
- Page sorts `(unknownPositive first, abs(amount) DESC, date DESC, id ASC)`; unknownPositive means amount>0 and kind=unknown. Validate p_limit 1..50; p_after is the four typed sort keys. Use lexicographic continuation appropriate to mixed directions. Cursor contents are untrusted filters, never SQL fragments.
- If p_account_id is supplied it must belong to owner and be included/eligible, otherwise not_found. Summary displayed for filtered screen uses same account filter; global home uses unfiltered summary. Add nullable p_account_id default null to summary for this purpose.
- Include a source_revision/interpretation revision in row payload. Page read returns item IDs plus required display facts and suggestion. No model call at read time.

## Ordered tasks

1. Add strict Zod schemas for list/save payloads matching contracts.md. Bounds: UUIDs, description display ≤512 chars, cursor decoded payload ≤1KB, request body ≤8KB, exact enum, no extra keys; reject NaN/noninteger category/revision and invalid sign/kind combinations.
2. Normalize and validate query arguments in consumer-review.ts. Call SQL list/summary and map dollars→integer cents once; no confidence-based filtering after counting.
3. Server actions authenticate via session and call save RPC. Never forward a supplied userId. Save validates category ownership again in SQL, so app validation cannot bypass it.
4. Treat `remember=true` for disallowed kinds as invalid_input, not silently ignored. Saving unknown allowed only remember=false; keeps question unresolved. Category-only edit still increments interpretation revision; no stale optimistic client save permitted.
5. POST route enforces same Origin as configured app/request origin for cookie auth. Return 401/400/404/409/503 using `{error:{code}}`, no raw SQL messages. GET is private/no-store. On success return `{item,review}`; queue updates only after confirmed persistence.
6. Use revalidate-consumer.ts with the seven exact paths in contracts.md. Call after review, recurring/settings/account inclusion/category changes. Do not introduce caching or subscriptions; client router.refresh plus API reload is sufficient.
7. Add “Change interpretation” action contract to existing Activity transaction detail consumer branch: it fetches the current row and reuses saveConsumerReview. User can correct prior answered rows even if no longer in queue. No new historical undo ledger.

## Required fixtures

- Owner A has unknown +$2,000, unknown -$1,150, unknown -$90, categorized/tax-assigned unknown -$50, pending -$500, excluded-account -$600. Queue exactly four rows; order +2000,-1150,-90,-50; debitCents=129000, creditCents=200000. Category/tax assignment alone must not remove an ambiguity.
- Paginate this list at limit 2: no duplicates or missing rows; count remains 4 on both pages. Equal amounts/dates tie by UUID. Bad cursor 400.
- Null role on included USD checking is eligible by inferred spending_source; null include excludes it. Empty provider_data is posted/unknown, pending=true excludes it. Unknown account type with no explicit role is ignored.
- Resolve rent at expected revision: save succeeds, count 3, debitCents=14000; refresh/resync retains user kind. Already-resolved row stays editable through detail lookup.
- Concurrent saves same revision: one succeeds, other 409; no partial category or rule from loser.
- Remember off → no rule. Remember on → one exact rule for that owner/account/full description/signed amount, future only. Similar name or different amount/account does not match.
- Own transfer save sets semantic and legacy transfer flag, never arbitrary transfer_pair_id; selecting spend later clears transfer flag. No counterpart transaction is fabricated.
- Unknown save/Skip does not falsely decrement global unresolved total. Client session progress may advance independently.
- Foreign IDs return 404, invalid enum/sign returns 400, wrong/missing origin denied, auth missing 401, RPC failure 503. No user financial payload in errors/logs.

## Exit gate

Existing test:books/test:lib and new isolated DB fixtures pass; typecheck passes. No model work during GET; all count/order/mutation semantics are tested. Do not alter the advanced tax instruction API's behavior to implement the consumer flow.
