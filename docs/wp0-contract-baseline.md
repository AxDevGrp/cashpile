# WP0 — Contract Freeze and Baseline

Status: WP0–WP5 complete and primary-approved (2026-09-10). Release 1 implementation finished; awaiting migration runs (023, 024), live cross-user verification, and the reversible feature flag decision before cohort rollout. Release 2 (WP6) not started per plan sequencing.
Date: 2026-09-09. Branch: `AxDevGrp/wp0-decision-first-experience`.
All paths relative to repo root. Findings reconfirmed against this checkout.

## 1. Baseline results (recorded before any implementation)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | Pass — 4 tasks (ui, db, ai, web), turbo cache, no errors |
| Books tests | `pnpm --filter @cashpile/web test:books` | Pass — 6 suites, 11 tests, 0 fail (`node --test`, src/modules/books/services) |
| Cashflow tests | none exist | `test:books` is the only test script in the repo. Adding a cashflow suite is WP1 scope |
| Build | `pnpm build` | Pass — `@cashpile/web` Next.js build, 23.3s, 1 task, no warnings of note |

Pre-existing defects found during baseline (not regressions; disposition noted in §9):
- `books_transactions.notes` is selected by `apps/web/src/modules/agent/executor.ts:37`, `packages/ai/src/orchestrator/tools.ts:461,472,487,493`, and `apps/web/src/modules/books/actions/transaction.actions.ts:300` (typed at `apps/web/src/modules/books/types.ts:108`), but **no migration creates that column** (002 has `tax_notes` on a different table; 003 is Trades). Any agent/AI path selecting it fails at runtime.
- `generateCashboardBriefing` runs a full LLM tool-calling round-trip on every cashboard load (`apps/web/src/app/(app)/cashboard/page.tsx:758-760`) and the result is **never rendered** (only other match is an unused CSS class, line 187).
- `apps/web/src/app/api/plaid/webhook/route.ts:11-18` has **no Plaid webhook signature verification** (comment: "skipped in sandbox"). Unauthenticated POSTs can trigger syncs or flip item status by `item_id`. Security-relevant; outside this plan's feature scope — flagged for primary decision.
- `/api/cashflow/snapshot` does not clamp `horizonDays` (`route.ts:12-13`), while the affordability route clamps to 7–90. Unbounded horizon = unbounded `dailyBalances` allocation (`service.ts:235`).

## 2. Trace: balances, pending, imports, ownership, transfers

### Balance refresh
- `books_financial_accounts.current_balance` (migration 002:66) is written in exactly four places: Plaid incremental sync (`apps/web/src/lib/plaid-sync.ts:156-171`), Plaid connect/reconnect (`apps/web/src/app/api/plaid/exchange-token/route.ts` → `upsertPlaidAccount`), and manual account creation (`apps/web/src/modules/books/actions/account.actions.ts:182`). `updateAccount` (198-214) can technically write it but the only UI caller passes `{ name }` — balance is not editable after creation.
- Sync uses Plaid `balances.current ?? 0` — **null balance silently becomes 0**; `available` and Plaid's `last_updated_datetime` are never stored. There is no balance-as-of column; the only recency signals are account `updated_at` and `books_plaid_items.last_synced_at` (007:18, written at `plaid-sync.ts:176`).
- **Plaid historical backfill never refreshes balances** (`apps/web/src/lib/plaid-backfill.ts` has no balance write; backfill window also hard-coded to calendar 2025 at `plaid-backfill.ts:116-117`).

### Pending transactions
- No `pending`/`status` column. The Plaid pending flag is persisted only inside `metadata` JSONB (`plaid-sync.ts:65`) and **nothing ever reads it**. Pending→posted arrives as an update to the same `plaid_transaction_id` (upsert keyed on `(user_id, plaid_transaction_id)`, `plaid-sync.ts:99-104`). Pending rows are indistinguishable from posted in every ledger sum, report, and the recurring detector.

### Imports (creators of `books_transactions`)
1. Plaid incremental sync — cursor-based, loops `has_more`, no window/cap; hard-deletes removed transactions (`plaid-sync.ts:106-120`).
2. Plaid backfill — pages of 500, offset loop; default window 2025-01-01→2025-12-31 (`route.ts:22-23`).
3. CSV import — `apps/web/src/modules/books/services/transaction-import.ts:135-241`; SHA-256 fingerprint dedupe (unique index 018:64-66) + fuzzy ±3-day candidates (threshold 0.86). `import_batch_id` is set per row but the `books_import_batches` table (002:133-146) is **never written**.
4. Manual add — `transaction.actions.ts:189-225`.
5. AI paths never create transactions (agent executor and orchestrator tools only categorize/update).
- Read-side truncation relevant to us: cashboard ledger query is `.gte("date", daysAgo(120)).limit(3000)` (`cashboard/page.tsx:487-489`) feeding a chart labeled "Last 6 months" — the two oldest bars are structurally near-empty.

### Account ownership
- `books_transactions` and `books_financial_accounts` are owner-scoped by RLS (`002:115-120`, `013_financial_accounts_user_rls.sql:12-34`); `books_plaid_items` owner-scoped (007:23-29); `user_settings` owner select/update/insert (001:90-94).
- **The entire cashflow stack runs on the service-role client** (`packages/db/src/server.ts:33-38`, used at `packages/ai/src/cashflow/service.ts:97,117,184`, agent module, Plaid libs, orchestrator tools) — RLS is bypassed and correctness depends entirely on manual `.eq("user_id", userId)` filters, which are present today. Any new persistence must keep this discipline and add owner-scoped RLS regardless.

### Transfer handling
- `is_transfer` is set **only by the CSV pipeline** (`transfer-detection.ts:120-170`: keywords/regexes + same-batch opposite-sign pair matching). **Plaid sync never sets it** — Plaid-sourced internal transfers default to `false` and are double-counted as income + expense in recurring detection, reports, and cashflow.
- `transfer_pair_id` is never written by any code (dead column); manual transfer flagging exists in `bulkUpdateTransactions` but no caller ever sends it.

### user_settings
- Columns: `default_currency`, `timezone`, `date_format`, `ai_categorization_enabled`, `email_notifications`, `preferences`, `minimum_cash_buffer` (015:11). **Only `minimum_cash_buffer` is ever read** (`cashflow/service.ts:184-194`); nothing ever writes the table beyond the signup trigger — the Settings page writes auth `user_metadata` instead. Buffer default when unset: `max($250, 10% of monthly recurring expenses)`.

## 3. Headline-number contract

For every number the new home will show. "Current" = what ships today; "Contract" = what WP1/WP3 must implement. Missing-data behavior is part of the contract.

### 3.1 Until payday (dominant number)

- **Formula (contract):** `available_until_payday = (min projected spending-cash balance over window [today → day before next confirmed payday]) − buffer`. Window includes confirmed recurring bills, the essential-spending allowance, and committed transfers/payments that leave spending cash. Paycheck itself is not counted (window ends before it).
- **Source:** sum of `current_balance` over accounts with role `spending_source` and `included=true`, projected forward by calendar-aware recurring schedule + essential allowance + committed outflows.
- **Time window:** today → day before next confirmed payday. If no confirmed payday: next 14 days, labeled "Next 14 days (estimate)".
- **Missing data:** stale balance (no `last_synced_at` within 48h) or any account with unknown balance → number renders with a "based on balances as of …" qualifier, never as an unqualified positive. No spending-source accounts → distinct empty state, not `$0`. Shortfall → "Projected shortfall: $X", never clamped to `$0 available` (today's `Math.max(0, …)` at `service.ts:260` clamps).
- **Current:** `safeToSpend = max(0, projectedLowBalance − buffer)` over a 14-day horizon on the cashboard / 30-day elsewhere; 30-day-increment cadences; no essential allowance; no payday confirmation concept.

### 3.2 Upcoming cash risk (30-day)

- **Formula:** minimum projected spending-cash balance over the next 30 calendar days, compared against buffer; report first breach date and the items causing it. Runs **independently** of the payday window (risks after payday count here).
- **Current:** `projectedLowBalance` exists but shares one simulation with safe-to-spend; no risk framing or breach date.

### 3.3 Monthly margin

- **Formula:** confirmed recurring income − (recurring bills + essential allowance + card purchases counted once) − non-recurring observed spending. Internal transfers and card payments excluded from expenses; savings allocations and debt principal shown separately in the breakdown, not as expenses.
- **Source:** confirmed recurring items + observed transactions of the calendar month; card purchases counted at purchase; card payment treated as internal transfer (interest portion is an expense).
- **Time window:** current calendar month to date, compared only against the same day-of-month in prior months (a partial month is never compared to a full month as equivalent).
- **Missing data:** months with incomplete import coverage are flagged, not silently averaged.
- **Current:** does not exist as a metric anywhere.

### 3.4 Emergency cushion

- **Formula:** designated uncommitted emergency reserves ÷ average monthly essential outflows over the last three complete months. Essentials include minimum debt obligations without double-counting card spending.
- **Source:** accounts with role `reserve` marked `included` and emergency-designated (WP2 confirmation), plus essential outflows.
- **Missing data:** no designated reserve → "No emergency reserve set" with the setup action, not `0 months` or a fabricated percentage.
- **Current:** the "Emergency shield" bar (`cashboard/page.tsx:1041`) is `savingsProgress = clamp(12, 100, round(safeToSpend / (projectedLow + safeToSpend) × 100))` (`page.tsx:856-858`) — an invented ratio with a 12% floor, not a cushion measurement. Removed in WP3.

### 3.5 Subscription total

- **Formula:** sum of monthly equivalents of confirmed recurring subscriptions; annual cost shown as next-12-months cost. Detection proposes; only user-confirmed items count toward headline totals until confirmation.
- **Current:** `getSubscriptionSummary` (`cashboard/page.tsx:406-448`) regex-matches brand names from unconfirmed recurring items; "Subscriptions flagged" card shows the monthly total; the "Subscription leaks" bar is `100 − count×12` (floor 8) — fabricated (page.tsx:1042). Removed in WP3.

### 3.6 Net worth

- **Formula:** sum of all included accounts: assets (spending, reserve, investment at `current_balance`) minus liabilities (credit_card/loan at `−current_balance` where balance is amount owed). Quiet footer with composition and as-of dates.
- **Missing data:** accounts missing balances are excluded and counted as "N accounts not included" — never silently zero.
- **Current:** net worth does not exist anywhere in the app.

### 3.7 Claims that must disappear (WP3)

- `"Upcoming bills: Covered"` is hardcoded whenever a snapshot exists (`cashboard/page.tsx:958`) regardless of the actual low balance.
- "Budget confidence" bar: hardcoded 86/58/28 mapping (page.tsx:1043).
- "Stash $25" CTA is a plain link; nothing is stashed (page.tsx:862, 908-916).

## 4. Calculation rules — hand-calculated fixtures

These fixtures are the WP1 test-suite seed. Rounding: compute in cents, round half-up only at display.

### Fixture A — payday window availability
Today 2026-09-09. Spending balance $1,200, buffer $250. Confirmed payday 2026-09-18 (biweekly $2,000). Window 09-09→09-17 contains: internet $80 due 09-10; essential allowance $70 on 09-14; committed savings transfer $100 on 09-15.
Walk: 1200 − 80 = 1120 → − 70 = 1050 → − 100 = **950** (low, first reached 09-15, holds through 09-17).
`available_until_payday = 950 − 250 = $700`. Rent $1,500 due 09-30 does **not** reduce this number (separate 30-day metric), but must appear in the 30-day risk.

### Fixture B — monthly margin
September 2026: income 2 paychecks × $2,000 = $4,000. Rent 1,500 + utilities 200 + essentials 600 + subscriptions 90 + card purchases 800 = $3,190 expenses. Card payment $800 is an internal transfer — excluded. Margin = **$810**. Breakdown shows savings transfer $100 and card principal as allocations, not expenses.

### Fixture C — emergency cushion
Emergency reserve (role `reserve`, confirmed) $3,600. Last three complete months essentials: (1,500 + 200 + 600 + 50 minimum debt) = $2,400/month. Cushion = 3600 / 2400 = **1.5 months**.

### Fixture D — 30-day cash risk and shortfall display
Same facts as A plus paycheck 09-18 (+2000) and rent 09-30 (−1500). Balances: 950 (09-15) → 2,950 (09-18) → 1,450 (09-30). 30-day low = **$950**, first reached 09-15; no breach (≥ 250).
Shortfall variant: balance $400, no detected income in 30 days, plus the $100 savings transfer and weekly $70 allowance (Mondays 09-14, 09-21, 09-28, 10-05): 400 − 80 − 70 − 100 − 70 − 70 − 1500 − 70 = **−$1,560** at 10-05, first negative 09-30 → headline "Projected shortfall: $1,560", not "$0 available". (Simplified illustration: the full-month walk in `calc.test.ts` is authoritative.)

### Fixture E — calendar-aware monthly recurrence (current bug)
Item seen 2026-09-30, cadence monthly. Current engine: `addDays(lastSeen, 30)` → next 2026-10-30 (service.ts:156, 74-83), drifting 1–3 days per cycle; over 12 months rent lands on the 27th. Contract: monthly anchors to **day-of-month** (30 → Oct 30? no: due 09-30 means due on the 30th; October has a 31st, so next = 10-30; a due-on-31st item clamps to month end (Sept → 09-30, Feb → 02-28)). Twice-monthly pay (1st and 15th) must land on the 1st/15th, not +15/+16-day offsets.

### Fixture F — card purchase + payment (no double count)
Checking $1,000, buffer $250, credit card (role `credit_liability`). Card purchase $300 on 09-12: no effect on spending cash. Card payment $300 from checking on 09-25: spending cash −300 once. 30-day low = **$700**. Margin (Fixture B rule) counts the $300 purchase as expense once; the payment is a transfer. Purchase and payment on the same day with unknown posting order: forecast must sequence expenses before income **within a day** when computing the low (conservative), so a same-day paycheck never erases a bill-timing risk.

### Fixture G — pending transactions
Balance $1,000 (Plaid `current`, includes a $200 pending debit). Rule (proposed, needs primary approval): spendable basis = Plaid `available` when present, else `current`; pending rows are labeled in drill-ins and excluded from "posted spending" trend counts so they are never counted twice. Fixture: `available` = 800 → spendable = **$800**, forecast starts from 800, and the pending $200 appears as "pending" in the ledger, not as a second deduction.

### Fixture H — savings transfer is not spendable, purchase doesn't touch reserves
Transfer $400 checking→savings (role `reserve`): spending cash −400, reserves +400; "available until payday" reduces by 400, emergency cushion months increase. A $400 purchase: spending −400, reserves unchanged. The What-if preview must show exactly this asymmetry.

### Fixture I — history truncation disclosure
Only 45 days of transactions imported: recurring detection requires 3+ occurrences, so nothing monthly is detected. Contract: snapshot carries `dataQuality = { historyDays: 45, complete: false }` and the UI says "Based on 45 days of data" rather than showing an unqualified forecast.

## 5. Consumer inventory — cashflow types & functions

Every consumer of `packages/ai/src/cashflow/*` (types + service) today:

| Consumer | Uses | Notes for compatibility |
| --- | --- | --- |
| `apps/web/src/app/(app)/cashboard/page.tsx:20,759` | `getCashflowSnapshot(user.id, 14)`, `generateCashboardBriefing` | Horizon 14; replaced in WP3 |
| `apps/web/src/app/(app)/cashflow/page.tsx:5,13` | `getCashflowSnapshot(user.id, 30)` | "Ahead" page basis |
| `apps/web/src/app/(app)/cashflow/recurring/page.tsx:3,10` | `detectRecurringItems` | Read-only list today |
| `apps/web/src/app/api/cashflow/snapshot/route.ts:3,13` | `getCashflowSnapshot` | Unbounded horizon (see §1) |
| `apps/web/src/app/api/cashflow/affordability/route.ts:3,18` | `checkAffordability` | Auth + amount>0 validation |
| `apps/web/src/components/cashflow/affordability-form.tsx:6` | `AffordabilityResult` (type only, client) | Renders Yes/Caution/No badge |
| `apps/web/src/modules/agent/executor.ts:2,154,168-170` | all three functions; tools `cashflow.snapshot.get`, `cashflow.affordability.check`, `cashflow.recurring_items.list` | Agent contract — names/shapes must stay additive |
| `packages/ai/src/orchestrator/tools.ts:4,517,530` | `get_cashflow_snapshot`, `check_affordability` tools | Cash AI chat contract |

### Planned API compatibility changes (explicit)

1. **Additive only.** Existing exported function signatures, tool names, and response fields stay. New data arrives as new optional fields; no field is repurposed.
2. `CashflowSnapshot` gains `dataQuality: { balanceAsOf: string|null, historyDays: number, complete: boolean, accountsIncluded: number, accountsExcluded: number }` and `paydayWindow: { end: string, nextPayday: string|null, provisional: boolean } | null`. `safeToSpend` stays for agent compatibility but the cashboard renders `availableUntilPayday` (new field) instead.
3. `AffordabilityResult.status` ("yes"/"caution"/"no") **stays in the API** for the agent tools, but WP4 stops rendering the verdict in the UI and adds `scenario: { type: "purchase" | "savings_transfer", amount, date, reserveAccountId? }` plus before/after `emergencyCushMonths` where relevant. `checkAffordability` gains an optional `scenario` param; called without it, behavior is unchanged (zero-change baseline = current result).
4. `/api/cashflow/snapshot` gets the same 7–90 horizon clamp as affordability (bug-class fix, not a breaking change).
5. Recurring identity: `RecurringItem.id` today is a base64url slice of the detection key (service.ts:165) — **truncated and unstable across detection changes**. WP2 introduces persisted stable IDs; the in-memory detection ID remains for unconfirmed proposals only.

## 6. Low-fidelity layouts

### 6.1 Today — `/cashboard`
```
┌──────────────────────────────────────────────────────┐
│ CASHBOARD                              [Ahead] [Recurring] │
├──────────────────────────────────────────────────────┤
│ UNTIL PAYDAY                          Sep 18 (9 days) │
│                                      $700             │
│  ▁▂▄▆▅▃ mini forecast (solid=past, dashed=projected)  │
│  Based on balances as of Sep 9 · [Why this number?]  │
├───────────────────────────────┬──────────────────────┤
│ THIS MONTH                    │ YOUR PRIORITY         │
│ margin $810                   │ Emergency cushion     │
│ ▇▇▇▇▆▅ (6 months, dashed=     │ 1.5 months            │
│  current partial)             │ [Pin] [Change]        │
├───────────────────────────────┴──────────────────────┤
│ ONE NEXT STEP: Confirm rent is $1,500/mo (est. impact │
│ on forecast accuracy)            [Do it] [Not now]   │
├──────────────────────────────────────────────────────┤
│ Net worth $12,400 · [See composition]   (quiet)     │
└──────────────────────────────────────────────────────┘
```
Rules: no mascot above the first number; drill-ins (transactions, secondary insights) via links; loading/error/empty/stale states inline per module.

### 6.2 Ahead — `/cashflow`
```
┌──────────────────────────────────────────────────────┐
│ AHEAD — next 30 days                                 │
│ 30-day chart with buffer line; low point marked      │
│ ⚠ Cash risk card (if breach): "Projected shortfall    │
│   $1,350 on Sep 30 — rent"                           │
│ Upcoming: internet $80 Sep 10 · savings $100 Sep 15 · │
│           paycheck $2,000 Sep 18 · rent $1,500 Sep 30 │
│ Assumptions & data quality footer                     │
└──────────────────────────────────────────────────────┘
```

### 6.3 Recurring review — `/cashflow/recurring`
```
┌──────────────────────────────────────────────────────┐
│ RECURRING REVIEW      [confirmed: 4] [needs review: 3]│
│ ──────────────────────────────────────────────────── │
│ Rent        monthly · next Sep 30   $1,500  [Edit]    │
│   └ confirmed ✓ (corrections survive resync)          │
│ Spotify     monthly · next Oct 02   $11.99 [Keep][Review]│
│ Paycheck    biweekly · next Sep 18  $2,000  [Confirm payday]│
│ + [Add a missing bill / payday]                       │
└──────────────────────────────────────────────────────┘
```

### 6.4 What if — `/cashflow/what-if`
```
┌──────────────────────────────────────────────────────┐
│ WHAT IF?                                             │
│ Type:  (•) Purchase   ( ) Transfer to savings        │
│ Amount: [ $700 ]  Date: [ Sep 15 ]  (label optional) │
│                       [ Preview ]  (read-only)        │
│ ──────────────────────────────────────────────────── │
│            BEFORE      AFTER                         │
│ Available   $700   →   $0                            │
│ 30-day low  $950   →   $250   (Sep 15)               │
│ Cushion     1.5 mo  →   1.5 mo (purchase) / 1.7 (transfer)│
│ Missing inputs & assumptions listed                  │
└──────────────────────────────────────────────────────┘
```
Explicit controls carry the semantics; free text is a label only. No Yes/No verdict.

## 7. Minimum persistence additions (for primary approval — no schema work yet)

1. **`cashflow_recurring_items`** (new, owner-scoped): user-confirmed recurring items with stable identity — key = `(user_id, direction, normalized_merchant, amount_bucket)` so corrections survive re-detection; fields: cadence, amount, next_date, included, confirmed_at, is_subscription, review_status (`keep`/`review`/`cancel_help`), last_seen_source. Unconfirmed detections remain ephemeral proposals keyed by the current detection ID.
2. **`user_settings` additions** (columns exist or are single-purpose): `minimum_cash_buffer` (exists, gains a UI writer), `timezone` (exists, gains readers), new: `essential_weekly_allowance`, `emergency_target_months`, `emergency_reserve_allocated` (or derive from account roles + confirmation).
3. **Account roles**: `cashflow_role` / `cashflow_include` columns already exist (015) with **no UI writer** — WP2 adds a confirmation UI, plus an `emergency` designation (either a new role value or a boolean on accounts; recommend extending the role enum with `emergency_reserve` or reusing `reserve` + per-account flag — decision for primary).
4. **`cashflow_action_state`** (new, owner-scoped): pinned priority + per-action dismiss/complete, keyed by a deterministic action id so refresh-after-data-change works.
5. Security design: every new table gets owner-scoped RLS (`user_id = auth.uid()` for all four operations); server actions and routes authenticate and scope explicitly; service-role reads keep the `.eq("user_id", …)` discipline; cross-user read/write tests are part of WP2 acceptance.
6. Not persisted now (deferred per plan): debt terms, goal contributions, net-worth snapshot history (WP6).

## 8. Test suite plan (WP1)

New `packages/ai/src/cashflow/*.test.ts` (or `apps/web` script mirroring `test:books`) using pure calculation functions over §4 fixtures: payday window, 30-day low, margin, cushion, calendar recurrence (E), double-count guards (F), pending basis (G), reserve asymmetry (H), truncation disclosure (I), rounding-to-cent, and "stale balance never yields unqualified positive". Data loading is separated from pure calculation so fixtures need no DB.

## 9. Findings register and disposition

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | `notes` column selected but never created (agent + orchestrator paths fail) | Primary decision: add column vs remove references. Blocks agent-consistency work in WP1 |
| 2 | Plaid webhook unauthenticated | Security fix outside plan scope — recommend immediate primary action |
| 3 | Plaid sync never flags transfers (CSV-only detection) → double count | Fix in WP1 detection/forecast input stage |
| 4 | 30-day monthly cadence drift | Fix in WP1 (calendar-aware recurrence) |
| 5 | Backfill never refreshes balances; window hard-coded to 2025 | Fix opportunistically in WP1 balance-freshness work |
| 6 | `balances.current ?? 0` and no `available` / as-of storage | Fix in WP1 freshness metadata |
| 7 | 120-day/3000-row cap feeding a 6-month chart | Fix in WP3 (WP1 makes loading complete where the forecast needs it) |
| 8 | "Covered", savingsProgress, leaks %, confidence %, "Stash $25" fabricated | Remove in WP3 |
| 9 | Briefing computed and discarded | Remove the call in WP3 (costless win) |
| 10 | `minimum_cash_buffer` has no writer/UI; settings page writes auth metadata not `user_settings` | WP2 adds writers; unify settings target |
| 11 | Snapshot route unbounded horizon | Clamp in WP1 (§5.4) |
| 12 | `books_import_batches` / `transfer_pair_id` dead | Out of scope; noted |
| 13 | No cashflow test suite | WP1 |

## 10. Open decisions for primary review

1. **Balance basis** (Fixture G): use Plaid `available` for spendable when present, fallback `current`, reserves at `current` — approve?
2. **Verdict removal path**: keep `AffordabilityResult.status` in the API for agent tools while the UI shows trade-offs only — approve?
3. **Stable recurring identity**: `(user_id, direction, normalized_merchant, amount_bucket)` key on a persisted table — approve?
4. **Emergency designation**: new `emergency_reserve` role value vs `reserve` role + boolean flag — approve one (recommend: reuse `reserve` + `is_emergency` boolean to avoid a role migration on an existing CHECK constraint).
5. **`notes` column** (Finding 1): add the column (unblocks agent path) or strip the references — which?
6. **Plaid webhook** (Finding 2): fix now as a standalone security commit, or defer?

## Acceptance self-assessment (WP0)

- Every headline number has formula, source, window, missing-data behavior: §3. ✔
- Planned API compatibility changes explicit: §5. ✔
- Persistence and security design documented for approval before schema work: §7. ✔ (pending primary approval of §7 and §10)
- Baselines recorded: §1. ✔
