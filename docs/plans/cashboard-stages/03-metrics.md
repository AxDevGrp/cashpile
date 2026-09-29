# Stage 03 — canonical metric snapshot

Requires stage 02. Implement contracts.md exactly; no UI styling in this stage.

## Allowed files

- `packages/ai/src/cashflow/{calc,service,types,index}.ts`, new `cashboard.ts`, `cashboard.test.ts`, existing `calc.test.ts`; package root exports if necessary.
- New `apps/web/src/app/api/cashboard/snapshot/route.ts` and a testable session-handler helper under `apps/web/src/lib/cashboard-api.ts`, `.test.ts`.
- Existing cashflow API routes only to share validated input/loading helpers without breaking response semantics.

## Tasks

1. Add the contracts.md types. Extract `buildCashboardMetrics(input)` into cashboard.ts as a pure function. Normalize cents once in service.ts; tests import the pure module using existing Node-test conventions.
2. Extend private `buildCalcInput` to return normalized source facts required by passive receipts, debt/current balances, currency, review status and timestamps. Query interpretations with transaction rows; paginate rather than truncating with silent caps. Read settings timezone. Do not fetch these datasets again per tile.
3. Separate current balance from spendable balance in CalcAccount/CashflowAccount. Add nullable currentBalanceCents to calculation input; use it for wealth/debt/cushion. Keep spendableCents for forecasting. Update existing test fixtures deliberately, not via a zero default that hides missing data.
4. Source current_balance positive liability counts as debt; negative credit balance adds an asset credit. Null liabilities cannot become zero. Preserve existing consumers' required fields but attach missing-data state; new consumer contract never uses a coerced currentBalance=0 as truth.
5. Use timezone-derived today and horizon >=max(30,payday-window length), ≤90. Retain existing calendar-aware recurrence and expense-before-income risk handling. Fix any demonstrated discrepancy required by the fixtures; no wholesale forecast rewrite.
6. For observed semantic totals and recurring inference, feed confirmed kind to shared calculator/detector: exclude internal_transfer/card_payment from income/expense, refund offsets expense, exclude asset_sale/loan_proceeds from income. Unknown positive does not become future income merely through repetition. Unknown debit remains observed expense; ambiguous recurring rows remain suggestions. Existing inferred recurrence is not silently promoted to confirmed.
7. Produce all five metrics using contracts.md; mark currency, stale/missing balance and pending-only-current cases exactly as specified. Cushion denominator is the frozen estimated-commitments formula; do not implement an alternative historical estimator.
8. Compute review counts/sums via consumer_review_summary delivered by stage 01 and defined in stage 04, independent of pagination. Do not amend an applied migration here or scan only displayed rows.
9. Add evidence rows for included balances and changes through the actual low date. Rows reconcile to availability at that date; list later bills separately. Use integers for amounts and the existing forecast items as evidence.
10. API wrapper verifies session, calls `getCashboardSnapshot(user.id)`, returns private/no-store response; 503 on dependency error. No supplied owner ID. Pure helper tests inject session/snapshot loaders; route remains thin.

## Frozen fixtures (today 2026-09-28, America/New_York)

Use synthetic fixture accounts/rows in tests; no database/network/model calls in pure tests.

| Case | Input | Expected |
| --- | --- | --- |
| Approved visual number | Spending current/available $4,020; bills before Oct 2: 386+142+152+600; savings 400; buffer 500; explicit essential allowance 0; confirmed Oct 2 payday | availability 184000 cents; low 234000; window through Oct 1; breakdown reconciles |
| Essentials | Same case plus one $100 essential allowance inside window | availability 174000, not 184000 |
| Shortfall | Spending $400; pre-payday bill $600; buffer $100 | value -30000; label shortfall, not $0 |
| Cross-window | Before-payday availability $700; later bill causes 30-day deficit $200 | payday metric stays 70000 with separate risk; old safeToSpend stays 0 |
| Pending | current $1,000, available $800, pending debit $200 | opening 80000, not 60000; current-only variant unavailable |
| Wealth basis | current credit liability $500, available credit $9,500; cash asset $2,000 | debt 50000, net worth 150000, not debt 950000 |
| Credit balance | card current -$50; cash $2,000 | debt 0, assets/net worth 205000 |
| Passive | user-confirmed rent cash $2,000 + interest $310; wages $4,000; own transfer $500; pending dividend $50; reinvestment $80 | passive 231000; period Sept 1–28; no other inflow counted |
| Unknown credit | add unconfirmed $100 receipt to preceding case | passive still 231000; quality estimated + unresolved-credit reason |
| Cushion | emergency reserve $6,400; monthly included standard commitments $1,480; weekly essentials $120 | denominator $2,000; months 3.2; missing allowance → unavailable |
| Currency | included EUR or null-currency account alongside USD | all monetary metrics unavailable; USD-only exclusion restores them |
| Timezone | now 2026-09-29T02:00:00Z in America/New_York | today Sept 28, not Sept 29 |
| Stale | spending balance timestamp older than 48 hours | availability null + stale reason; no confident spending recommendation |
| Transfer | user confirms $300 checking→reserve, both legs posted | no margin income/expense; future outgoing commitment still consumes cash |

Also test zero/missing buffers distinctly, missing debt balance, no included account, no payday 14-day fallback, monthly end dates, multiple accounts with local shortfall, and no history (no fake trend).

## Exit gate

- `pnpm --filter @cashpile/ai test:cashflow`, web test:lib and typecheck pass (including any added scripts/globs required for new tests).
- Headline/evidence/API snapshots agree to the cent; forecasts remain labeled estimates.
- Pure metrics run without model availability/credits. Existing cashflow API/tool response fields retain documented meanings.
