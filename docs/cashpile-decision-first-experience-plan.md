# Cashpile Decision-First Experience — Implementation Plan

Status: Ready for executor planning; implementation not started.
Created: 2026-09-09.

## Objective

Turn Cashpile's customer home into a decision tool: **see what is available, understand what is coming, preview a change, and track real progress.**

The product loop is: see your position → try a change → see the consequence → act → see progress.

This plan is grounded in repository inspection. It is an implementation brief, not evidence that the proposed features or validations are complete.

## 1. Scope and release boundaries

### Release 1 — Trustworthy daily money view

- Until payday, with a cash forecast.
- Monthly surplus/deficit.
- Emergency cushion.
- Editable recurring income and bills.
- Subscription review.
- Simple purchase and savings-transfer previews.
- One evidence-backed next action.
- Current net worth, where account coverage supports it.

### Release 2 — Connected progress

- Debt payoff comparisons.
- A persisted goal and contribution plan.
- Subscription savings redirected toward that plan.
- Goal-date consequences in What if.
- Net-worth history as valid snapshots accumulate.

### Deferred

Refinancing offers, employer match, investment-fee analysis, financed-car affordability, retirement projections, household mode, automatic cancellation, money movement, and financial-health scores.

Release 1 must not display goal-delay or debt-free dates until Release 2 can calculate them credibly.

## 2. Existing implementation and identified issues

| Existing area | Implementation implication |
| --- | --- |
| `apps/web/src/app/(app)/cashboard/page.tsx` | Replace the crowded home composition rather than build another dashboard. |
| `packages/ai/src/cashflow/service.ts` and `types.ts` | Extend the existing deterministic forecast; do not create a competing engine. |
| `/cashflow` and `/cashflow/recurring` | Reuse these routes for forecasting and recurring review. |
| `apps/web/src/components/cashflow/affordability-form.tsx` and cashflow API routes | Evolve the existing interaction into explicit scenario inputs and trade-offs. |
| Account cashflow roles and minimum buffer | Reuse these concepts and add user confirmation. |
| Agent executor and AI tools | Keep their answers consistent with customer-facing calculation contracts. |

Issues identified during inspection that belong in this scope:

- “Upcoming bills: Covered” currently depends on a snapshot existing, not whether bills are actually covered.
- Emergency/progress percentages are heuristic, not measured progress toward a real emergency target.
- The six-month spending chart receives only 120 days of transactions, with an additional 3,000-row cap.
- Recurring review is read-only.
- Monthly recurrence uses 30-day increments, which can drift from actual due dates.
- Forecasts rely on recurring transactions without an explicit everyday-essential spending allowance.
- The purchase form extracts an amount but does not interpret dates or distinguish purchases from savings transfers, despite presenting those example prompts.
- Before/after affordability calculations reload financial data separately, allowing inconsistent comparison inputs.

Correct these before making the charts more persuasive. Reconfirm findings against the current checkout before editing.

## 3. Product and calculation rules

These are proposed implementation defaults. Material ambiguities must be resolved with the primary planner rather than silently inventing behavior.

### Customer navigation

Preserve existing routes and broader Books/Tax navigation. Introduce local consumer navigation:

- **Today:** `/cashboard`
- **Ahead:** `/cashflow`
- **What if?:** `/cashflow/what-if`
- **Recurring review:** existing `/cashflow/recurring`

Avoid a global navigation redesign.

### Financial boundaries

- Start with one user and one reporting currency. Do not silently combine currencies.
- Ask users to confirm which accounts belong in their personal plan; do not automatically blend business and personal finances.
- Distinguish spending cash, emergency reserves, investments, and liabilities.
- Missing data is unknown, not zero.
- Keep calculations deterministic. AI may explain results but must not invent balances, dates, or savings.

### Metric definitions

| Metric | Required definition |
| --- | --- |
| Until payday | Additional discretionary spending possible now without crossing the chosen cash buffer during the forecast window ending immediately before the next confirmed payday. Include bills, essential spending allowances, and committed contributions. |
| Upcoming cash risk | Separate 30-day forecast warning, including risks after that payday. |
| Monthly margin | Income minus expenses, counting card purchases once and excluding internal transfers. Show debt principal and savings allocations separately in the breakdown. |
| Emergency cushion | User-designated, uncommitted emergency cash divided by average monthly essential outflows over the last three complete months. Include minimum debt obligations without double-counting card spending. |
| Subscription total | Monthly equivalent and estimated next-year cost of confirmed recurring subscriptions—not automatically waste. |
| Net worth | Included assets minus liabilities, with account coverage and valuation dates visible. |

If payday cannot be confirmed, use “Next 14 days” and label the estimate provisional.

For a shortfall, display “Projected shortfall: $X” rather than hiding the negative result behind “$0 available.”

## 4. Implementation work packages

### WP0 — Freeze contracts and establish a baseline

**Owner: primary planner/reviewer.**

Before routine implementation:

1. Record baseline typecheck, Books tests, and build results.
2. Trace balance refresh, pending transactions, imports, account ownership, and transfer handling.
3. Document calculation rules with small, hand-calculated fixtures.
4. Inventory every consumer of the existing cashflow types: UI, API, AI tools, and agent endpoints.
5. Produce low-fidelity layouts for Today, Ahead, recurring review, and What if.
6. Identify the minimum persistence additions required.

**Acceptance criteria**

- Each headline number has a formula, source, time window, and missing-data behavior.
- Planned API compatibility changes are explicit.
- Primary approves persistence and security design before schema work.

### WP1 — Make the forecast trustworthy

**Primary files:** existing cashflow service/types; relevant import and balance code only where required.

**Executor tasks**

- Separate data loading from pure calculation functions.
- Calculate baseline and scenarios from one normalized input snapshot.
- Load complete required history through pagination or aggregation; disclose incomplete history.
- Add freshness, coverage, and missing-input metadata.
- Reconcile pending versus posted transactions and their effect on the chosen balance basis.
- Respect account inclusion throughout detection and forecasting.
- Add calendar-aware recurrence, including monthly dates, month-end handling, and twice-monthly pay.
- Include confirmed essential allowances and committed transfers/payments.
- Calculate both payday-window availability and the 30-day low point.
- Validate scenario dates and bound forecast horizons.
- Add a runnable cashflow calculation test suite.

**Acceptance criteria**

- Hand-calculated fixtures match results to the cent under documented rounding.
- Internal transfers and card payments are not counted twice.
- Savings reserves are not automatically spendable.
- A same-day paycheck does not silently erase a bill-timing risk when posting order is unknown.
- Missing or stale balance data cannot produce an unqualified positive spending recommendation.
- Calculation failures are distinguishable from “no accounts connected.”

**Gate:** Do not proceed with a prominent Until payday headline until this passes.

### WP2 — Persist user corrections and planning inputs

**Ownership:** Primary designs and reviews schema/security changes; executor implements approved application behavior.

Persist only what the releases need:

- Confirmed account roles and personal-plan inclusion.
- Buffer and forecast date/timezone preferences.
- Recurring-item corrections: amount, cadence, next date, inclusion, and confirmation.
- Essential spending classification and user-adjusted allowances.
- Emergency reserve allocation and target.
- Subscription review status.
- Pinned priority and action dismissal/completion state.

Add debt terms and goal contributions in Release 2, not speculatively now.

**Executor tasks**

- Upgrade recurring review from a read-only list to an editable confirmation workflow.
- Support manually adding a missing bill or payday.
- Preserve corrections across subsequent imports.
- Use stable recurring identities; do not base persisted edits on the current truncated detection ID.
- Invalidate affected forecasts after a correction.

**Acceptance criteria**

- A correction survives refresh and resync.
- Changing a bill updates the forecast exactly once.
- “Not recurring” does not hide the underlying transaction.
- An explicit zero buffer remains distinct from an unset buffer.
- Cross-user reads and writes fail, including attempts using another user's account or recurring-item ID.

### WP3 — Replace home with four modules

**Primary file:** existing cashboard page, supported by focused local components.

**Layout**

1. **Until payday:** dominant amount, date, mini forecast, “Why this number?”
2. **This month:** six surplus/deficit bars and comparable-period change.
3. **Your priority:** emergency cushion initially; debt/goal later.
4. **One next step:** observation, estimated impact, and a concrete action.
5. **Quiet footer:** current net worth and composition link.

**Executor tasks**

- Replace heuristic progress percentages and unsupported Covered claims.
- Move detailed transaction lists and secondary insights into drill-ins.
- Make navigation links functional.
- Retain existing brand assets without letting the mascot displace the financial answer.
- Use a shared visual convention: observed solid, projected dashed, proposed change accented.
- Add loading, incomplete-data, stale-data, error, and empty states.
- Provide accessible text summaries and chart values beyond hover tooltips.
- Let users pin their priority rather than automatically switching it to whichever metric looks worst. Show urgent cash risks separately.

**Acceptance criteria**

- Desktop and mobile share the same information hierarchy.
- All headline amounts reconcile to their drill-ins.
- A partial current month is not compared against a full previous month as though equivalent.
- No decorative percentage masquerades as financial progress.
- Keyboard and touch users can inspect chart values.

### WP4 — Ship the first What if interaction

**Primary files:** affordability form, existing API route, cashflow service, new What if page.

**Release 1 scenarios**

- One-time purchase.
- Transfer from spending cash into a selected emergency reserve.

Use explicit amount, date, and scenario-type controls. Free text may provide a label, not silently determine financial semantics.

**Results**

- Available cash before and after.
- Projected low balance and date.
- Emergency cushion before and after, where relevant.
- Missing inputs and assumptions.

**Behavior**

- Preview is read-only.
- A savings transfer reduces spending cash but increases the selected reserve.
- A purchase does not automatically consume emergency reserves.
- Remove customer-facing Yes/No affordability verdicts in favor of explained trade-offs.
- Preserve or explicitly version existing API/agent contracts.

**Acceptance criteria**

- Zero-change baseline is identical to the original plan.
- Scenario date visibly affects the result.
- Dates outside the supported window cannot be silently ignored.
- Changing scenario type changes accounting correctly.
- Preview does not move money or create a commitment.

### WP5 — Add subscription review and one next action

**Executor tasks**

- Distinguish subscriptions from other recurring obligations.
- Rank review candidates by estimated cost; show monthly and annual equivalents.
- Provide Keep, Review, and Cancellation help actions.
- Label cancellation as user-reported unless actually verified.
- Generate the home action using deterministic rules and source evidence.
- Prioritize a projected cash shortfall over optional savings suggestions.
- Allow dismissal; refresh stale recommendations after data changes.

**Acceptance criteria**

- No unused claim without user confirmation or actual usage evidence.
- All subscriptions are not automatically labeled leaks.
- Annual subscriptions distinguish upcoming renewal savings from immediate monthly cash relief.
- Cancellation help does not imply Cashpile completed cancellation.
- When there is no supported dollar opportunity, show a useful data-confirmation action or “No action needed”—not an invented saving.

**Release 1 launch gate:** WP1–WP5 pass primary review and final validation.

### WP6 — Add debt finish dates and goal consequences

**Release 2; begin only after the first release is validated.**

**Required inputs**

- Debt balance, APR, minimum-payment rule, planned payment, and relevant dates.
- A user-confirmed contribution plan.
- One active goal with allocated funds and a target.

Do not infer APR or actual payment behavior from balances alone.

**Executor tasks**

- Calculate current pace, snowball, and avalanche using the same total payment budget.
- Show estimated interest remaining and payoff month.
- Support zero interest, insufficient payments, payment rollover, and unavailable payoff dates.
- Extend What if with extra debt payments and recurring savings contributions.
- Let users explicitly direct subscription savings to cash, a reserve, or debt.
- Recalculate goal dates only when the contribution plan supports them.
- Add net-worth snapshots prospectively, with consistent account coverage.

**Acceptance criteria**

- Reference amortization fixtures match.
- A non-amortizing debt displays no finite payoff date.
- Strategy comparisons do not gain an advantage through a larger payment budget.
- Freed cash is never allocated twice.
- No contribution plan means no promised goal date.
- No fabricated historical net-worth line; account additions are identified rather than presented as investment gains.

## 5. Testing and rollout

### Required fixture scenarios

- Paycheck-to-paycheck with rent before payday.
- Positive monthly margin but a mid-month shortfall.
- Irregular income and unknown payday.
- Pending transaction becoming posted.
- Credit-card purchase followed by card payment.
- Transfer into emergency savings.
- Annual subscription and cancellation before renewal.
- Short or truncated history.
- Disconnected account or stale balance.
- Multiple accounts where aggregate cash hides an individual account shortfall.
- Mixed currencies or personal/business accounts.
- Debt payment below accrued interest.

### Validation commands and checks

The executor must run and report:

- `pnpm typecheck`
- `pnpm --filter @cashpile/web test:books`
- New cashflow calculation and API tests.
- `pnpm build`
- Mobile, keyboard, and chart-accessibility checks.
- Cross-user authorization tests for all new persistence.

There was no cashflow-specific test script in the inspected package configuration. Adding a runnable suite is part of WP1. Report pre-existing failures separately from regressions; do not declare unrun checks passed.

### Rollout

- Release behind a reversible feature flag.
- Validate with internal fixtures before a small user cohort.
- Track comprehension, forecast errors, completed corrections, scenario use, and meaningful return visits.
- Do not include raw balances or transaction descriptions in general product analytics.
- Keep outbound engagement notifications out of Release 1.

## 6. Executor handoff rules

1. Execute one bounded work package at a time.
2. Submit changed-file summary, test results, and known limitations.
3. Primary reviews the diff and verifies acceptance before advancing.
4. Escalate material financial-model or product ambiguities rather than guessing.
5. Keep migrations, authorization changes, destructive operations, and final acceptance with the primary.
6. Do not expand into deferred features or refactor unrelated Books, Tax, Trades, or Pulse code.

**Starting assignment:** WP0, then WP1—not a visual dashboard rewrite. The charts should become compelling only after the numbers deserve that confidence.
