# Stage 06 — the three live consumer screens

Requires 03,04,05. Use typed server data, not numbers copied from the approved image.

## Allowed files

- `app/(app)/cashboard/page.tsx`, `_components/new-dashboard.tsx`, `until-payday-card.tsx`, `urgent-cash-risk-card.tsx`, `one-next-step-card.tsx`, `cash-input-strip.tsx`.
- New Cashboard components `_components/metric-tile.tsx`, `metric-detail.tsx`, `consumer-dashboard.module.css` only; reuse existing risk/dismissal/input/chart behavior.
- `apps/web/src/app/(app)/cashflow/page.tsx`; new `apps/web/src/app/(app)/cashflow/_components/consumer-spending-detail.tsx`.
- `apps/web/src/app/(app)/books/transactions/ai-review/page.tsx`; new `apps/web/src/app/(app)/books/transactions/ai-review/_components/consumer-review-client.tsx`.
- New `components/ui-v2/consumer-model.ts`, `consumer-model.test.ts` for pure presentation choices/routes (no financial math).
- Additive shared primitive props if required; no independent UI library or client financial calculator.

## Screen 1: Cashboard

1. NewDashboard loads getCashboardSnapshot once and existing dismissed action state. Keep unauthenticated/failed/zero-account states distinct; API failure is not “connect an account.”
2. Layout: heading/greeting + small Gremmy avatar; CashInputStrip; dominant full-width available tile; 2×2 secondary passive/debt/cushion/net-worth tiles; clarification strip; one insight. Payment-request slot is omitted entirely in Release A.
3. Money uses existing currency formatter on value/100. Cushion displays one decimal. Do not append `/mo` to actual monthly receipts; use “Identified this month.” No debt-free dates or net-worth sparkline in Release A.
4. Tile hrefs fixed in contracts.md. Extend page searchParams with metric string and route valid four detail IDs to MetricDetail. Unknown metric→home. Nonconsumer page retains existing behavior; query cannot activate consumer.
5. Available positive estimate uses lime; negative shows absolute shortfall with danger icon/text on dark surface. Unavailable shows em dash and explicit reason/action (Accounts or Settings), never zero. Estimated-essential warning must be visible on home when present, not tooltip-only.
6. Reuse one-next-step selection priority but remove wording claiming confirmations make a forecast “exact.” Priority: urgent cash risk; account freshness/coverage; essential allowance; unresolved questions; confirmed subscription review; nothing needed. Existing dismissal persists, but a currently material risk remains visible in the independent risk banner.
7. Insight numbers come from evidence. Until verified change/usage data exists, show confirmed subscription amount/review—not hardcoded “rose $47” or “unused since July.”

## Screen 2: spending detail

1. /cashflow page calls the stage-05 getConsumerExperience() server resolver before selecting any view. Eligible branch loads consumer snapshot once and renders ConsumerSpendingDetail directly regardless of view query; noneligible path unchanged. Do not use only isUiV2Enabled() for this branch.
2. Header/back /cashboard, metric amount+period, estimate reasons/as-of, breakdown rows from metrics.available.rows, chart from same cashflow snapshot, upcoming bills with links to recurring review, Preview action to /cashflow/what-if.
3. Chart has readable textual low date/balance, data table disclosure and visible buffer reference. Projected line dashed; actual/current point distinct; no hover-only information.
4. Breakdown must reconcile at forecast low point, not pretend every later payment reduced it already. Missing data keeps evidence available where known but no unqualified spending amount.
5. Preview savings CTA may prefill amount/date/type via validated query parameters, but first implementation simply links to existing form. Do not invent an auto-optimized $400 suggestion. No Move/Pay label.

## Other tile drill-ins

MetricDetail takes `{metric:CashboardMetric,warnings}`. Render title/value/unit/period/as-of, reasons, evidence rows, back link. Passive shows included receipts and gross-cash disclaimer; debt account balances; cushion reserves/denominator/settings link; net worth assets/liabilities. Hrefs come from server contract. Unavailable drill-ins explain the missing input; no charts without source history.

## Screen 3: clarification

1. Page calls the same stage-05 getConsumerExperience() server resolver first; eligible renders ConsumerReviewClient from stage 04 list, otherwise existing AiReviewClient. Eligible `?view=advanced` retains advanced review. Do not call old AI-generating list endpoint for consumer initial render.
2. Display current transaction/account/date/signed amount; suggestion reason; radio options mapped to ConsumerKind. Debit primary options Spend (optional existing category selector), Own-account transfer, Card payment, Something else. Credit options Income, Passive-income receipt, Refund, Own-account transfer, Asset-sale proceeds, Loan proceeds, Something else. A suggested category/label can be “Rent / housing” when actually supplied; not hardcoded for every transfer.
3. Initial selection empty even if suggested. Save disabled until explicit choice; other/unknown is valid with remember off. Category choices from owned categories; do not create categories on save. Rent example uses an existing category if available.
4. Remember checkbox off, disabled for prohibited kinds, exact-rule explanation shown. Skip advances session only; Done returns /cashboard. Progress is local reviewed/skipped count, not accuracy. Global unresolved count changes only on confirmed resolution.
5. On save success update queue/count, router.refresh affected views, advance. A spend/income choice without a category saves meaning but remains globally unresolved; show “Meaning saved; category still unconfirmed,” do not decrement the global count. On 409 reload current item and explain “This transaction changed; review it again.” On failure preserve selection and offer retry; disable duplicate clicks while pending.
6. Keep skipped IDs only in user-scoped sessionStorage. After exhausting loaded page fetch next; all-skipped message “Done for now” with unresolved count and restart. Never claim all resolved if only skipped.

## Tests / exit gate

- Pure presentation tests: fixed hrefs; money unit formatting, null vs zero, negative shortfall, unknown metric fallback; no UI money arithmetic beyond formatting.
- Browser journey fixtures: home $1,840 → detail $1,840 with rows; review rent reduces four-item queue to three; resync still reflects correction; Skip leaves global count; stale case shows no spendable amount.
- A 360px viewport keeps 2×2 tiles if text fits; use single column at enlarged text/narrow overflow instead of clipping. Controls ≥44px, content clears navigation/keyboard; keyboard radios/checkbox/save, status announcements, readable focus.
- Run test:ui-v2, test:books, test:lib, AI cashflow tests, typecheck/build. Capture home/details/review at 390×844 and 1440×1000, plus unavailable and failure states.

Exit: primary visually accepts three functional screens; no fake payment tile and no static fixture values in production branches.
