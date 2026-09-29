# Stage 02 — reliable ingestion and background interpretation

Requires stage 01 isolated schema/security acceptance. No production feature enablement.

## Allowed files

- `apps/web/src/lib/plaid-sync.ts`, `plaid-backfill.ts`; new `plaid-ingestion.ts`, `plaid-ingestion.test.ts`.
- `apps/web/src/app/api/plaid/exchange-token/route.ts`, `api/cron/sync-plaid/route.ts`; existing Plaid sync/webhook/status routes only for explicit busy/status/error mapping.
- `apps/web/src/modules/books/services/transaction-import.ts`, `categorization-engine.ts`, `ai-review-suggestions.ts` and their focused tests.
- `packages/ai/src/books/categorization.ts` and new `categorization.test.ts` for duplicate-batch fallback regression only.
- New `apps/web/src/modules/books/services/consumer-interpretation.ts`, `consumer-interpretation.test.ts`; new `apps/web/src/lib/interpretation-worker.ts`, `.test.ts`; new `app/api/cron/interpret-transactions/route.ts`.
- Existing manual account/create/update actions only to preserve currency/balance-as-of as specified; new fields in existing Books types. Tests in existing service/lib test locations.

## Ordered implementation

1. Write pure mapper/retry fixtures first. Move duplicated Plaid row normalization from sync/backfill into `normalizePlaidTransaction(transaction, accountId)` in plaid-ingestion.ts. It returns ONLY provider-owned fields: financial_account_id, description, merchant, **amountCents** (integer), date, transaction_type, plaid_transaction_id and provider_data. Calculate amountCents from the provider's signed dollar amount once, validate finite/safe integer and ±99999999999999 bound. RPC converts amountCents to ledger DECIMAL dollars with numeric division by 100. Never supply category/user notes/consumer decision as null during import. Exact consumer rule matching uses signed_amount_cents, never a floating-point dollar comparison.
2. provider_data keys: `transaction_id`, `account_id`, `pending`, `pending_transaction_id`, `iso_currency_code`, `unofficial_currency_code`, `personal_finance_category` (full available object). Preserve missing values as null. Unknown provider fields do not become instructions. Mirror legacy metadata pending/category keys using atomic DB merge, not a read-modify-write client object.
3. Wrap sync in claim/release RPCs with a random UUID token. Busy returns a structured busy result to callers, never a successful fresh-sync timestamp. Heartbeat through each write; if a provider call outlives the lease, reject subsequent writes and let the next run retry.
4. Read provider pages sequentially; use page RPC for exact changed rows. Hold removed provider IDs until finalization. Save cursor only with balances/removals in final RPC. If `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` occurs, restart from the initial stored cursor; permit two restarts then return retryable failure without advancing cursor. The page upserts must be replay-idempotent.
5. Pending posting: find owned pending record using `pending_transaction_id`. If no posted-ID record exists, update the pending record's provider ID/facts in place to retain its Cashpile UUID, decisions and job. If both exist, lock in UUID order, keep posted record; migrate a sole user decision to it. If both have conflicting user decisions, keep posted decision, mark review_required, retain the displaced decision in the surviving record's suggestion/evidence as a conflict (never silently choose it as truth). Transfer dependents referencing the old row before deletion, then delete old pending row. In a standard posting path the deferred removal of old provider ID finds nothing. No guessing by amount/date to merge identities.
6. Before deletion in finish RPC, ensure no replacement row still uses that provider ID; provider removal of a truly cancelled transaction removes that row and its derived job/interpretation. Do not delete unrelated manual/CSV rows. Check every DB/provider failure; do not mark item synced on partial failure.
7. Backfill uses the same lease and page-write mapper/RPC, but does not alter sync cursor or claim balances were refreshed. Release its lease in finally; no legacy private upsert path remains. Return actual affected row counts.
8. Remove `limit(added * 2)` and synchronous LLM categorization from sync/backfill/import request paths. Existing tax assignment still uses exact inserted/changed IDs with its current user access constraints. Category rule/AI processing happens through the durable worker, not unawaited promises. New transaction triggers enqueue manual/CSV/Plaid rows; no redundant enqueue API needed.
9. Exchange/reconnect writes actual provider currency, current/available values and balance_as_of at successful retrieval time. Never coerce missing current balance to zero. Existing explicit role/include settings survive reconnect; new account inclusion is false pending confirmation. Manual account form accepts USD confirmation; balance_as_of changes only on actual explicit balance save.

## Exact interpretation precedence

Implement `deriveConsumerInterpretation(row, exactRule, category): {kind,source,reviewRequired,suggestion}` as a pure function. Priority:

1. Existing source=user: retain meaning/category; source changes only mark it review-required until user reconfirms.
2. Exact `books_consumer_rules` match: use kind/category with source=rule; if referenced category is missing, retain kind but require category clarification for spend/income.
3. Clear provider facts (confidence exactly HIGH or VERY_HIGH): positive detailed category `INCOME_WAGES` → income; positive `INCOME_INTEREST_EARNED` or `INCOME_DIVIDENDS` → unknown with passive_income suggestion. Unrecognized taxonomy values remain unknown rather than approximate string matching.
4. Negative amount with confidently assigned expense category from existing engine and provider primary not TRANSFER_IN/TRANSFER_OUT/LOAN_PAYMENTS → spend. “Transfers,” Income, refund/return, asset-sale, loan and payment-keyword cases cannot be auto-converted by this rule. If provider category absent and text suggests Zelle/Venmo/transfer/card payment/refund, remain unknown. Do not treat all Zelle as transfers.
5. Otherwise unknown. Existing model output can propose a category, never self-authorize high-stakes financial meaning. Store suggestion and set review_required=true.

Review_required=false requires a nonunknown kind and, for spend/income, a known category. Confirmed internal_transfer/card_payment/refund/asset_sale/loan_proceeds/passive_income can be resolved without category. LLM-reported confidence is not a calibrated accuracy guarantee.

## Worker contract

- GET `/api/cron/interpret-transactions` requires a configured nonempty CRON_SECRET and exact `x-cron-secret`; otherwise 401. No browser/userID input.
- Claim ≤20 jobs for one owner. Load rows/categories/rules once. Use deterministic precedence first. If env `CASHPILE_BACKGROUND_AI_ENABLED` is not exactly `true`, finish using rules/unknown; do not charge user chat credits.
- If enabled, call existing category engine once for remaining ≤20 rows, with a 20-second request timeout and minConfidence=0.85. Ensure raw model results reference only requested IDs and allowed categories, have finite confidence in [0,1], and produce at most one result per ID.
- Fix existing batch fallback so an error in a later batch does not append fallback results for already successful IDs. Failures leave unresolved rows, not false “Other” resolutions.
- Apply decisions through source/interpretation-version guarded RPC. Stale completion requeues current work; cannot overwrite a correction. Error retry schedule is stage 01; log only error code/job IDs.
- Bound route to one claim/run, no recursive drain. Primary schedules it once/minute using deployment's external scheduler. Do not add a Redis/service dependency or call the cron handler from a page render.
- Repair/retry failed work is an explicit primary operation resetting failed rows, not an infinite loop. Disabling optional background AI does not disable sync, corrections or deterministic metrics.

## Required tests / expected results

- Provider debit 42.10 → -4210 cents; unknown balance/currency remain null; category/user notes not in mapper output.
- Pending P → posted Q across separate pages retains Cashpile UUID and confirmation; replay same page yields one row, unchanged source revision.
- Mid-page failure leaves old cursor; rerun yields no duplicates. Concurrent sync/backfill: one lease owner. Old worker cannot finish newer data.
- Provider-cancelled row removed only at successful finish; missing account mapping blocks the page rather than assigning null account.
- User-confirmed rent survives provider category/description refresh; it reappears for review if meaningful facts changed.
- Zelle debit stays unknown unless user/exact rule resolves it. Salary provider mapping → income. Interest provider mapping → unknown + passive suggestion. Unknown debit is still available to cashflow input.
- 21 categorization rows with second batch failure: exactly 21 unique outputs, no first-batch duplicate fallback.
- Worker with absent secret 401; AI disabled makes zero model calls; model timeout produces retry state; third failure terminal. Test model returns another user's ID/category → reject.

Run existing `test:books`, `test:lib`, AI categorization test with Node's existing test runner, and typecheck. Add tests to package scripts only where an existing glob does not include the new file. No dependency installation.

Exit: exact-ID lifecycle/retry fixtures and isolated SQL concurrency tests pass; primary confirms no direct synchronous model calls remain in import flows. Scheduler/AI budget not enabled automatically.
