# Frozen contracts — all stages

These decisions are prescriptive for Release A. Do not replace them with model guesses or subtly different UI definitions. New names below are proposed exact implementation names; their absence today is expected.

## 1. Experience gate and routes

- Reuse DB flag `decision_first_experience`. Eligibility: authenticated user AND (`enabled === true` OR UUID occurs in `cohorts`). Missing row/query error → disabled; log only a sanitized operational error.
- Add `apps/web/src/lib/consumer-experience-policy.ts`: pure `isConsumerEligible(flag, userId): boolean`.
- Add `apps/web/src/lib/consumer-experience.ts`: request-local cached `getConsumerExperience(): Promise<{ userId: string | null; enabled: boolean }>` using the session client. No process-global user cache.
- Eligible user → consumer shell independent of `NEXT_PUBLIC_UI_V2`. Noneligible → exactly the current UI-v2/legacy selection. Never trust query parameters to enable the experience.
- Consumer nav: Cashboard `/cashboard`; Activity `/books/transactions`; Accounts `/books/accounts`.
- `/cashflow*` belongs to Cashboard; `/books/transactions/ai-review*` belongs to Activity. `/cashboard?metric=passive-income|debt|cushion|net-worth` provides four read-only drill-ins. Invalid metric → home. Available tile → `/cashflow?view=details`.
- Profile/menu → `/settings`, Ask Gremmy → existing overlay or `/ai`; Advanced → existing `/books`, `/books/tax` only when authorized, `/trades`, `/pulse`. Keep existing entitlement checks; a menu is not authorization.
- Eligible consumers bypass intermediate ModuleHomeV2/WriteWorkflowV2 wrappers on the named consumer routes, not on advanced routes. `?view=advanced` on Activity/review shows existing advanced content inside the same consumer shell; it never widens privileges.

## 2. Currency, time and balances

- New consumer reports support USD only. Null currency is unknown, never USD by default. A manual account may explicitly confirm USD; existing rows are not silently backfilled as USD.
- Include active accounts with `cashflow_include === true` and role other than ignore. An unconfirmed role uses the current inferred role only for a labeled estimate; infer savings as reserve (not emergency), checking as spending_source, credit_card as credit_liability, investment as investment, loan as loan, other as ignore. Existing explicitly chosen roles win.
- New provider-linked accounts default `cashflow_include=false` until the owner confirms personal-plan inclusion. Connecting must offer that confirmation immediately, not require category setup. Preserve existing inclusion choices on reconnect.
- Currency mismatch/unknown in an included account → all five consumer metrics unavailable with `currency_unconfirmed`; no partial blended total (including a cross-currency cushion). User may explicitly exclude it. A provider transaction with a known currency different from its included account also blocks affected metrics; manual transaction currency inherits the explicitly confirmed account currency. Never convert a foreign amount by formatting it as dollars.
- Calendar dates use `user_settings.timezone`, default America/New_York. Compute today's ISO date with `Intl.DateTimeFormat(...).formatToParts`, never UTC date truncation for the consumer contract. Invalid saved timezone falls back with an assumption reason. All date fixtures supply explicit `now`.
- Cash availability uses provider `available_balance` if known, otherwise current balance. Unknown current+available means unavailable. If only current is known and pending debits exist, spending amount is unavailable (`pending_balance_uncertain`), rather than guessing whether holds are already included.
- Net worth/debt use **current balance**, not available credit/available spending balance. Positive credit/loan current balance is debt; a negative credit balance is an asset credit, not positive debt. Missing relevant current balances makes those totals unavailable.
- Linked balance timestamp comes from successful balance retrieval, not any account-setting update. Store `balance_as_of`. Manual balances receive it only on explicit balance edit. Older than 48 hours or unknown → spending unavailable; wealth/debt can show last-known values marked estimated/stale.

## 3. Transaction semantics

`ConsumerKind` values: `unknown | spend | income | passive_income | refund | internal_transfer | card_payment | asset_sale | loan_proceeds`.

- Existing amount convention remains: credits positive, debits negative; normalize once, not per screen.
- A known debit changes observed cash regardless of category. No past debit is subtracted again from a current balance already reflecting it.
- Confirmed ordinary income/spend/passive receipt feeds semantic reporting; refunds reduce recorded spending, not passive income. Own-account transfers and card payments are excluded from income/expense totals but outgoing future payments still consume spending cash.
- Unknown inflows are not reliable future income. Unknown outflows remain expenses for observed totals, except confirmed internal movements. Use a visible unresolved-amount disclosure; no classification percentage as financial accuracy.
- Pending observations do not count as posted monthly/passive income. Confirmed source semantics override keyword/amount-pair heuristics in new consumer calculations.
- Passive income is **posted positive USD cash receipts explicitly marked passive_income by the user or that user's exact remembered rule**. Provider/model guesses can suggest it but cannot assert it. Count deposits in included spending/reserve accounts, not reinvestments in investment accounts. Label the tile “Identified this month”; detail says “Cash receipts, before related expenses/taxes.” No `/mo` suffix for a partial month's actual receipts.
- No extra provider product is purchased to fill missing investment/rental coverage in this release. Show identified amounts and unresolved-credit disclosure rather than inventing coverage.

## 4. Spending and cushion formulas

- Consumer spending = minimum forecast aggregate spending balance from today through the day before the next confirmed payday, minus buffer. If payday is inferred, label provisional; no payday → next 14 calendar days. Load at least that window plus the 30-day risk window, maximum 90 days; a payday beyond 90 days triggers the labeled 14-day fallback.
- Preserve negative amounts and show “Projected shortfall: $X.” Per-account shortfall is an independent warning; pooled money does not imply an automatic transfer between banks.
- User buffer overrides default, including zero. Existing default `max($250, 10% of monthly recurring expenses)` is retained and labeled assumed until explicitly set.
- Missing essential_weekly_allowance does not mean zero: show spending estimate plus prominent “Everyday essentials not confirmed.” Zero is valid only if explicitly saved. No “all bills covered” or “safe” verdict when missing/stale data materially affects it.
- Cushion = explicitly designated emergency reserve current balances / monthly equivalent of included standard recurring cash outflows + confirmed weekly essential allowance × 52/12. All recurring cash outflows are a conservative proxy for essentials, labeled **estimated monthly commitments**; not a claimed three-month historical essential-spending average. Missing allowance or nonpositive/unknown denominator → cushion unavailable. Do not infer card minimums; show a missing-debt-commitments note when applicable. Round displayed months to one decimal, not stored math.
- Keep old `safeToSpend` API meaning (30-day clamped amount) for compatibility. New consumer tools/views use the explicit metric, never relabel old `safeToSpend` as payday availability.
- Simulations never transfer funds. Preview type/date/amount must be visible and confirmed if extracted from chat.

## 5. Typed consumer response

Add the following types to `packages/ai/src/cashflow/types.ts` (names/field semantics fixed). Export through existing package indexes; no package reorganization.

```ts
type CashboardMetricId = 'available' | 'passive-income' | 'debt' | 'cushion' | 'net-worth';
type MetricQuality = 'estimated' | 'available' | 'unavailable';
interface CashboardMetric {
  id: CashboardMetricId;
  value: number | null; // integer cents for money; unrounded months for cushion
  unit: 'USD_cents' | 'months';
  quality: MetricQuality;
  period: { from: string; through: string } | null; // YYYY-MM-DD; balance metrics use null
  asOf: string | null;
  reasons: string[];
  rows: Array<{ id: string; label: string; value: number | null; href?: string }>;
}
interface CashboardSnapshot {
  version: 1;
  asOf: string; // snapshot generation time, NOT provider freshness
  timezone: string;
  currency: 'USD';
  metrics: Record<CashboardMetricId, CashboardMetric>;
  cashflow: CashflowSnapshot;
  review: { count: number; debitCents: number; creditCents: number };
  warnings: Array<{ code: string; message: string; accountId?: string }>;
}
```

- `getCashboardSnapshot(userId, {now?} = {})` is server-only and uses one normalized load for metrics + cashflow. Do not call `getCashflowSnapshot` then reload inputs for the other metrics. Reuse extracted loading/calculation helpers in `service.ts`.
- Evidence rows identify underlying accounts/transactions/forecast items. All money rows use integer cents. Whitelist evidence hrefs built on the server, never model-supplied URLs.
- Live pages query this contract; fixtures do not appear in production. Same snapshot object feeds headline and drill-in. A later navigation may legitimately refresh; display its new as-of rather than promising a permanently frozen amount.
- API adds `/api/cashboard/snapshot`, session-authenticated GET, no userId input, `Cache-Control: private, no-store`. Unauthenticated 401; source outage 503 with `{error:{code:'snapshot_unavailable'}}`; metric-level missing data is 200 with unavailable metrics.
- Forecast quality is always estimated even with complete inputs. Passive income is estimated when unresolved positive receipts exist; “available” means recorded/computed, not guaranteed complete external coverage.

## 6. Review contract

- Queue includes posted, included, USD transactions with `review_required=true`; not only uncategorized rows. Sort unknown positive inflows first, then absolute cents descending, date descending, UUID ascending. Pending records wait until posted.
- Counts/sums use the identical predicate, across all matching rows; no 5,000-row hidden cap. Debit/credit sums are separate magnitudes, never netted into a misleading unresolved amount.
- `listConsumerReview({accountId?,limit=20,after?})` returns `{items,total,debitCents,creditCents,nextCursor}`. Keyset cursor is an opaque encoding of the four sort keys, validated on input. Limit 1–50; exact unknown account ID returns not_found, not an all-account fallback.
- Each item: `{transactionId,revision,date,description,amountCents,accountId,accountLabel,kind,categoryId,suggestion}`. Suggestion is nullable `{kind,categoryId,reason}`; no percentage badge.
- `saveConsumerReview({transactionId,expectedRevision,kind,categoryId,remember})`: user identity comes only from session. categoryId is integer or null, remember boolean. Valid category ownership required. Return updated item/counts; 409 on revision mismatch; 404 for nonexistent/foreign IDs; 400 invalid input; 401 no session. Do not expose foreign record existence.
- `remember` is allowed only for spend/income/passive_income/refund. Match exact account, normalized full description, signed cents; this is intentionally narrow. Checkbox defaults off, explains exact scope, and never applies to history. Disable it for internal_transfer/card_payment/asset_sale/loan_proceeds/unknown.
- User may save unknown with remember=false; keep review_required=true and advance only the current session. Skip/Done do not write financial state. Use sessionStorage for reviewed/skipped IDs only, scoped to user and tab, clear on sign-out; resuming refetches current rows.
- No bulk group approval in Release A. Existing advanced review remains reachable. Revision edit in Activity uses the same save contract; no separate undo engine.
- All user-confirmed semantics are stored outside replaceable provider metadata. Category and interpretation update atomically. Save leaves no half-created rule.

## 7. UI and payment boundaries

- Exact colors: canvas #181C21; surface #252B34; raised #303744; lime #C7F65A; on-lime #11180A; text #F5F7FA; muted #B8C0CC; teal #153F48; violet #403958; slate #303C54; border #46515F; attention #F3C76A; danger #FF8C88.
- Inter + existing Lucide, existing Tailwind 3/primitives. No new UI dependency. Scope tokens to `.cashpile-consumer`; existing light/legacy surfaces unchanged when outside it.
- Gremmy: use existing asset in a small circular avatar until a primary-approved transparent derivative is supplied. Do not make asset generation block functional implementation or use a white rectangular mascot on dark cards.
- All payments remain absent from live consumer data/capabilities. Do not add a passkey button that only generates a confirmation token. No bank/provider call from a preview.

## 8. Error, permission and consistency rules

- Session/RLS checks plus explicit ownership on service-role queries. Validate UUIDs, limits, kinds, finite cents and dates server-side; no client-provided owner/scopes trusted.
- Same-origin enforcement on cookie-authenticated JSON writes; bearer-only agent GETs never gain cookie authority. Tokens/transaction payloads excluded from generic analytics.
- Consumer data is request-time/no shared caching initially. After writes, revalidate `/cashboard`, `/cashflow`, `/cashflow/what-if`, `/cashflow/recurring`, `/books/transactions`, `/books/transactions/ai-review`, `/books/accounts`; client refreshes snapshot/queue. No cache infrastructure required.
- AI outage → unknown/suggestion unavailable, never invented successful categorization. Background AI disabled unless `CASHPILE_BACKGROUND_AI_ENABLED=true`; rules still run. Enabling the worker budget is a primary operating decision; executor must not enable it or debit user chat credits.
