# Stage 01 — correction-safe persistence

Requires stage 00. This is primary-designed schema/security work. Executor may author the specified migration and tests, but primary reviews SQL before any isolated-DB application. Production application is excluded.

## Allowed files

- New `packages/db/migrations/027_consumer_interpretation.sql`.
- New `packages/db/migrations/028_consumer_ingestion.sql`.
- New `packages/db/tests/consumer-contracts.sql` (rollback-only isolated-DB fixture script).
- `packages/db/src/types.ts` only to add the new table/column types matching SQL.

## Exact schema delta

All owner IDs below mean `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`, matching Books rather than a new user identity system. Ledger amount remains DECIMAL(14,2) dollars. New rule/RPC/application amounts are BIGINT/integer cents within ±99999999999999; convert once at the ledger boundary, never compare floating-point dollars for exact matching.

**027, existing tables**

- `books_financial_accounts`: nullable `currency_code TEXT` constrained to three uppercase ASCII letters when nonnull; nullable `balance_as_of TIMESTAMPTZ`. Do not default old rows to USD or today's time.
- `books_transactions`: `provider_data JSONB NOT NULL DEFAULT '{}'`, `source_revision INTEGER NOT NULL DEFAULT 1 CHECK (source_revision > 0)`. Raw provider mapping is specified in stage 02. Source revision changes only when source facts change, not when category or user notes change.
- Do not overwrite existing category, transfer flags or metadata during migration.

**027, new `books_transaction_interpretations`**

- `transaction_id UUID PRIMARY KEY REFERENCES books_transactions(id) ON DELETE CASCADE`.
- `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`.
- `kind TEXT NOT NULL DEFAULT 'unknown' CHECK (kind IN ('unknown','spend','income','passive_income','refund','internal_transfer','card_payment','asset_sale','loan_proceeds'))`.
- `source TEXT NOT NULL DEFAULT 'unknown' CHECK (source IN ('unknown','provider','rule','user'))`.
- `review_required BOOLEAN NOT NULL DEFAULT true`.
- `suggestion JSONB` nullable, shape validated by application before writing.
- `revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)`; optimistic concurrency token incremented on every interpretation/category-decision mutation and on source fact changes.
- `confirmed_at TIMESTAMPTZ` nullable; `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- Owner index `(user_id,review_required,transaction_id)`.

**027, new `books_consumer_rules`**

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id`, `financial_account_id UUID NOT NULL REFERENCES books_financial_accounts(id) ON DELETE CASCADE`.
- `normalized_description TEXT NOT NULL CHECK (char_length(normalized_description) BETWEEN 1 AND 512)`; `signed_amount_cents BIGINT NOT NULL CHECK (signed_amount_cents BETWEEN -99999999999999 AND 99999999999999)`; `kind TEXT NOT NULL CHECK (kind IN ('spend','income','passive_income','refund'))`; `category_id INTEGER REFERENCES public.books_categories(id) ON DELETE SET NULL` nullable.
- `created_at`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- Unique `(user_id,financial_account_id,normalized_description,signed_amount_cents)`.
- This narrow rule stores financial meaning plus an optional category; it is not a replacement for existing category rules. Normalization: Unicode NFKC, trim, lowercase, collapse whitespace; do not strip names/digits. Future matches only, exact amount/direction; no fuzzy match/backfill.

**028, new `books_interpretation_jobs`**

- `transaction_id UUID PRIMARY KEY REFERENCES books_transactions(id) ON DELETE CASCADE`, `user_id`, `source_revision INTEGER NOT NULL`.
- `status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed'))`; `attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3)`.
- `available_at TIMESTAMPTZ NOT NULL DEFAULT now()`, nullable `lease_token UUID`, `leased_until TIMESTAMPTZ`, `last_error_code TEXT`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- Index `(status,available_at)`; no raw exception text/provider payload in last_error_code.
- `books_plaid_items`: nullable `sync_lease_token UUID`, `sync_leased_until TIMESTAMPTZ`.

## Security and transactional functions

Implement the following exact SQL RPC boundaries. Set explicit `search_path`, schema-qualify objects, and revoke default PUBLIC execution. A security-definer function must never trust a supplied owner ID without checking its designated caller class.

1. `consumer_save_review(p_transaction_id UUID,p_expected_revision INTEGER,p_kind TEXT,p_category_id INTEGER,p_remember BOOLEAN) RETURNS JSONB`: authenticated-only; resolve `auth.uid()`, lock owned transaction/interpretation, check all foreign IDs are owned, validate sign (spend debit; income/passive/refund/asset_sale/loan_proceeds credit; transfers either), version and remember constraints. Atomically update ledger category, interpretation, legacy is_transfer for internal_transfer/card_payment, and optional exact rule. Do not create a transfer_pair_id without a verified counterpart. Clear suggestion, increment revision, set confirmed_at/source=user. Set review_required to `(kind='unknown' OR (kind IN ('spend','income') AND category_id IS NULL))`; other explicit meanings resolve without a category. Return item revision; raise mapped `not_found`, `revision_conflict`, `invalid_input`. Never change amount/date/account or create tax assignments. Scope-changing tax workflow remains advanced.
2. `consumer_apply_interpretation(p_transaction_id UUID,p_source_revision INTEGER,p_expected_revision INTEGER,p_kind TEXT,p_source TEXT,p_suggestion JSONB,p_category_id INTEGER)`: service-only worker write. Lock row; stale source/interpretation revision or source=user → `{applied:false}` with no overwrite. Validate owned category and allowed sources provider/rule/unknown. Update semantics and optional category atomically; never use this function to confirm a model-only passive-income guess. Returns applied flag/revision.
3. `consumer_claim_sync(p_item_id TEXT,p_token UUID) RETURNS BOOLEAN`: service-only; atomically claim absent/expired lease for 120 seconds. Return false when busy.
4. `consumer_write_plaid_page(p_item_id TEXT,p_token UUID,p_rows JSONB) RETURNS UUID[]`: service-only; lock item, verify live matching lease, derive owner from item. Validate every account belongs to item/owner, normalized amounts/dates, and payload size ≤500 records. Preserve user fields and pending linkage as stage 02 specifies; increment source_revision only for changed facts; create interpretation/job for each new/changed record atomically. Renew lease 120 seconds. Return exact affected Cashpile IDs.
5. `consumer_finish_sync(p_item_id TEXT,p_token UUID,p_removed_ids TEXT[],p_balances JSONB,p_next_cursor TEXT)`: service-only; verify lease under row lock. Apply deferred removals, balances/currency/as-of and cursor in one DB transaction. Every account owner/item must match. Clear lease after success. Backfill does not use this function to advance the sync cursor.
6. `consumer_release_sync(p_item_id TEXT,p_token UUID)`: service-only; clear only matching token. It cannot release a later caller's lease.
7. `consumer_claim_jobs(p_token UUID) RETURNS SETOF books_interpretation_jobs`: service-only; claim at most 20 due jobs of the oldest eligible owner using row locks/SKIP LOCKED; processing lease 60 seconds; increment attempts; attempts cannot exceed 3. Expired processing becomes retryable unless exhausted, then failed. Do not combine financial data from different owners in a model request.
8. `consumer_finish_job(p_transaction_id UUID,p_token UUID,p_source_revision INTEGER,p_error_code TEXT DEFAULT NULL)`: service-only; match lease+revision. Success done. Failure after first attempt waits 60 sec, after second waits 300 sec, third failed. New source revision resets attempts; an old worker cannot finish the newer job.

9. In 027 implement `consumer_review_summary(p_user_id UUID,p_account_id UUID DEFAULT NULL)` and `consumer_review_page(p_user_id UUID,p_account_id UUID,p_limit INTEGER,p_after JSONB)` now, using the exact predicates/outputs in [stage 04](04-clarification.md). Stage 03 depends on them; do not defer their SQL until stage 04.

10. In 027 define immutable `consumer_effective_role(p_role TEXT,p_account_type TEXT) RETURNS TEXT`: a valid nonnull p_role wins; otherwise checking→spending_source, savings→reserve, credit_card→credit_liability, investment→investment, loan→loan, other/null→ignore. Unknown nonnull role returns ignore. Use it in both review SQL functions; application mapping must have matching fixture tests. No state or security-definer privileges required for this pure function.

Define table-dependent functions only after their tables exist: review/save/apply functions in 027; lease/page/job functions and all enqueue/backfill triggers in 028. SQL errors intended for application mapping use SQLSTATE P0001 with a fixed detail code from not_found/revision_conflict/invalid_input; never expose arbitrary SQL text.

**Triggers/backfill**

- AFTER INSERT on books_transactions: insert interpretation unknown and pending job, both with derived owner. Supports all import paths, not only Plaid.
- AFTER UPDATE of amount/date/description/merchant/financial_account_id/provider_data: only when values differ, increment source_revision using BEFORE logic; bump interpretation revision/review_required for any prior user decision while preserving its kind/source; enqueue new revision. Do not let worker bookkeeping/category edits recursively enqueue work.
- AFTER ledger category/is_transfer change: invalidate interpretation revision and review_required so advanced edits cannot leave silent stale consumer truth. Consumer RPC finalizes both fields in the same transaction; it must account for the trigger's version increment and return final revision. Do not use a client-settable bypass flag/GUC. A worker reloads current interpretation revision after the existing category engine writes, then performs the guarded semantic apply.
- Backfill only missing interpretation/job rows for existing transactions in bounded, restartable batches of 1,000 using an explicitly primary-run script/SQL loop. Do not infer confirmed meaning from old categories. New data starts automatically through triggers.

**RLS/grants**

- Interpretations: owner SELECT only; no direct authenticated INSERT/UPDATE/DELETE. Session writes only through consumer_save_review. Rules: owner SELECT/DELETE (user can revoke); creation/update only through save RPC. Validate account/category owner inside RPC; FK existence alone is insufficient.
- Jobs and sync leases: service-only; no authenticated job reads/writes or token exposure. Lock fields must not appear in account/Plaid status API responses.
- New table grants explicit; service gets needed access. Confirm existing broad account/item write policies cannot let users forge synchronization leases via the Data API; restrict lease-column writes to service using column grants or a service-validated trigger, without breaking legitimate existing edits.

## SQL fixtures / exit gate

Run in isolated DB inside BEGIN/ROLLBACK using actual role/JWT claims:

- Owner A reads A decisions, cannot read B; A cannot categorize using B's category/account/transaction. Unauthenticated cannot invoke save. Direct update/insert to interpretation denied.
- A saves version 1 → new revision; a second version-1 save fails and creates no rule/category partial write.
- Rule match is account+full-normalized-description+signed-amount exact; one mismatch creates no match.
- A worker cannot overwrite user confirmation or stale revision; missing lease prevents page/finish writes.
- Two sync claimers → exactly one success; expired lease allows new owner; old token cannot finish/release.
- New row → one job; identical source replay → no revision/job reset; modified amount → revision increment + retry reset; third failure terminal.
- Migration leaves all preexisting monetary/category fields unchanged. Null currency/as-of remains null.

Exit: primary approves SQL/security, runs these fixtures and typecheck, and records isolated migration success. No production migration is implied.
