# Cashpile: useful-by-default Cashboard + Midnight & Lime

Date: 2026-09-28  
Status: Proposed implementation plan; no product changes or migrations authorized by this document.  
Owner: Primary planner; bounded implementation assigned to executor after acceptance.

**Executor handoff:** use the newer [stage-by-stage executor pack](cashboard-stages/README.md) and its frozen contracts for implementation. This document remains the product/architecture overview; the staged pack resolves and supersedes its discretionary choices.

## 1. Objective and release boundaries

Make Cashpile an easy way to understand and act on personal finances, not an accounting workspace users must maintain. Connect accounts → see useful numbers → optionally clarify uncertainty → explore or approve an action.

Visual reference: [approved four-screen Midnight & Lime walkthrough](../../output/mockups/cashboard-midnight-lime-walkthrough.png). This is an image reference, not a functional specification or evidence that the illustrated data is available. The PNG is currently local/untracked. P0 must archive it with the approved plan in a versioned design location (or attach it to the executor handoff) and update this link; do not rely on a temporary image-generation path.

Two coordinated workstreams:

1. **App structure:** trustworthy shared metrics, automatic ingestion, optional clarification, simpler navigation, consistent assistant/agent answers, and separately gated payments.
2. **GUI:** a coherent charcoal-and-lime app, with rounded money tiles, progressive disclosure, and restrained Gremmy personality.

### Release A — the useful consumer app

- Cashboard, spending detail, clarification flow, Activity, Accounts, and contextual Ask Gremmy.
- Shared deterministic calculations and evidence-backed insights.
- Dark styling across the consumer journey, including forms, settings, overlays, and connection states.
- Read-only agent summary access after authorization validation.
- Payment screen available only in an explicitly labeled internal demo/sandbox, not as a fake live feature.

### Release B — user-approved agent payments

- Real payment requests, verified human approval, provider execution, status reconciliation, receipts, and revocation.
- Separate security/provider acceptance gate. Release A must not wait for this.

### Planning defaults

- Responsive web app using the existing stack, not a new native mobile app.
- One person's plan and one reporting currency initially. Keep personal/business account inclusion explicit; never silently add different currencies.
- Midnight & Lime is the new consumer experience's default. Preserve existing light/legacy surfaces during rollout; no new theme picker in this scope.
- Existing Books/Tax/Trades/Pulse workflows remain reachable under an Advanced/More entry with their existing permissions. Do not delete them or rewrite their business logic.
- New consumer metric wording is **Available to spend**, not a guarantee that spending is risk-free.
- No new microservices, vector database, generic workflow engine, dashboard builder, or parallel financial ledger for Release A.

This plan supersedes the home layout/navigation choices in [the earlier decision-first plan](../cashpile-decision-first-experience-plan.md), while retaining its calculation-safety principles. That earlier document's status and gap list are historical: several proposed features now exist in source and must be verified rather than rebuilt.

## 2. Current implementation: what to reuse and what to change

Repository inspection is source-level, not a runtime audit. Applied database migrations, deployed flags, and production correctness remain unverified.

| Area | Current source | Implementation implication |
| --- | --- | --- |
| Home | `apps/web/src/app/(app)/cashboard/page.tsx`, `_components/new-dashboard.tsx` | Existing `decision_first_experience` cohort flag and new/legacy dashboards. Evolve the new dashboard; do not add another competing home. |
| Cashflow | `packages/ai/src/cashflow/{calc,service,types}.ts` | Already has integer-cent calculation internals, payday availability, 30-day risk, cushion, net worth, scenarios, and tests. Extend these contracts. |
| Planning inputs | `packages/db/migrations/024_cashflow_persistence.sql`, settings and recurring UI | Reuse persisted recurring corrections, account roles, buffer, essentials allowance, emergency designation/target, and action state. |
| Plaid ingestion | `apps/web/src/lib/plaid-sync.ts`, `plaid-backfill.ts`, Plaid API/cron routes | Existing sync and automatic categorization; fix lifecycle/retry and correction preservation before relying on it for headline metrics. |
| Interpretation | `apps/web/src/modules/books/services/categorization-engine.ts`, `packages/ai/src/books/categorization.ts` | Existing manual/learned/default/AI paths and stored suggestions; do not introduce another category engine. |
| Review | `apps/web/src/modules/books/actions/ai-review.actions.ts`, `/api/books/ai-review`, `/books/transactions/ai-review` | Reuse mutation and rule infrastructure, but provide a consumer-first one-question flow and correct queue eligibility/counting. |
| App shell | `apps/web/src/app/(app)/layout.tsx`, `components/ui-v2/{components,model}.ts*` | Existing UI-v2 and legacy shell branches. Simplify navigation deliberately and test flag combinations. |
| Theme | `app/globals.css`, `components/ui-v2/ui-v2.module.css`, `apps/web/tailwind.config.ts`, `packages/ui` | Global HSL tokens coexist with hardcoded light colors in UI-v2. Updating `.dark` alone will not restyle the app. |
| Assistant | `app/(app)/_components/cash-overlay.tsx`, `/api/ai/chat`, `packages/ai/src/orchestrator/` | Reuse chat/overlay and shared tools; rename visible consumer identity to Gremmy without renaming every backend symbol. |
| External agents | `modules/agent/`, `/api/agent/*`, migration `010_agentic_layer.sql` | Existing scopes, token auth, capabilities, audit, and confirmation scaffolding. Not yet evidence of payment readiness or full MCP interoperability. |

### Specific structural gaps to address

1. **Different spending contracts:** `getCashflowSnapshot` exposes both `safeToSpend` (clamped 30-day low minus buffer) and `availableUntilPayday`. Existing `/cashflow` and agent consumers can show the former while the new home uses the latter. Standardize new customer answers on the explicit payday-window metric; retain/version legacy contracts rather than silently changing their meaning.
2. **Sync can replace interpretation metadata:** transaction upserts replace `metadata`, while review provenance and suggestions are stored there. Preserve user-owned fields atomically across import updates and concurrent corrections. Current categorization selects recent rows using `limit(added * 2)` rather than exact changed IDs; replace that heuristic and handle modified transactions deliberately.
3. **Missing provider context:** the inspected sync mapping does not retain pending-to-posted linkage, currency, or category-confidence detail. Preserve the fields needed for reconciliation and truthful coverage. A missing balance must remain unknown rather than becoming zero.
4. **Review is not a complete unknown queue:** the current list is capped at 5,000 rows, filters transfers, skips categorized/tax-assigned rows, and ranks by confidence/count. Those rules cannot define all meaningful financial ambiguities or an exact global pending count.
5. **Passive income lacks a dedicated snapshot contract:** the new home needs a defined, evidence-backed measure, not a renamed generic income total. Debt needs an included-liabilities breakdown, not a total derived from payment transactions.
6. **Navigation semantics are misleading:** UI-v2 currently labels `/cashflow` as Activity. In this design Activity means transaction activity; forecasting belongs in spending details.
7. **Agent preview is not human consent:** the executor returns a confirmation token to the requesting agent, which can submit it back. The signing helper also has a development-secret fallback. This is not an acceptable authorization boundary for payments.
8. **The current `/api/agent/mcp` GET is discovery JSON:** do not advertise it as a proven standards-compliant MCP transport. Verify protocol behavior with a real client before claiming interoperability.

## 3. App structure

### 3.1 Navigation and route ownership

Use the existing URLs where they serve the intended task; presentation changes should not break bookmarks or existing integrations.

| Visible destination | Proposed route | Behavior |
| --- | --- | --- |
| Cashboard | `/cashboard` | Money summary, one useful insight, optional clarification entry, eligible action request. |
| Available to spend | `/cashflow?view=details` | Evolve the existing detailed workspace into screen 2; skip the intermediate module entrance. |
| Clarify transactions | `/books/transactions/ai-review` | New consumer mode for screen 3; keep advanced tools reachable. |
| Activity | `/books/transactions` | Searchable activity feed with filters and transaction detail; advanced table remains available. |
| Accounts | `/books/accounts` | Connection health, balances, account inclusion/roles, connect/reconnect/manual entry. |
| What if? | `/cashflow/what-if` | Existing read-only purchase/savings scenario flow, reached from spending detail. |
| Recurring commitments | `/cashflow/recurring` | Existing confirmation/edit flow, reached from bill details. |
| Ask Gremmy | Existing overlay and `/ai` | Contextual explanation/scenario entry, not mandatory navigation to basic numbers. |
| Payment request | Proposed `/agent/requests/[id]` | Release B only; owner-scoped review/status screen. |
| Agent permissions | New section within existing Settings | Build connection scopes, status and revoke UI for Release A; no such section exists today. Release B adds verified payees/limits. |

- Mobile primary navigation: **Cashboard · Activity · Accounts**. Profile/menu opens Settings and Advanced.
- Desktop: compact labeled rail with the same three destinations, secondary Settings/Advanced access, and a wider content area.
- Use ordinary route navigation first, including browser back/history and deep links. Do not require intercepting routes or a new panel framework.
- All summary tiles must lead somewhere useful: passive income → filtered source breakdown; debt → included balances; cushion → reserves/essentials/target; net worth → assets/liabilities. These can reuse existing account/activity screens with explicit filters and a focused detail section.
- One server-resolved consumer-experience decision should coordinate shell and page behavior. Introduce a thin server layout wrapper and move the current interactive shell into a client component receiving eligibility as a prop. Reuse the same server resolver in the page/affected routes. Eligible users receive the consumer shell regardless of `NEXT_PUBLIC_UI_V2`; ineligible users retain the existing UI-v2/legacy behavior. Test the DB flag/cohort × UI-v2 environment flag × direct-link/query matrix, including rollback. Do not create a new flag per component. Payment execution remains independently disabled.

### 3.2 Connect accounts without onboarding homework

1. Reuse Plaid Link and import flows; show separate connecting, importing, interpreting, and ready states.
2. Render partial results promptly and label missing coverage. An LLM outage must not prevent balances and confirmed data from appearing.
3. Propose account roles using existing data. Ask only necessary questions: personal-plan inclusion, protected reserves, payday/bills or buffer when material. Unconfirmed assumptions remain visible.
4. Surface missing or disconnected accounts in Accounts and affected metric detail; elevate a warning on home if it changes spending guidance.
5. Manual accounts/imports remain supported. Do not treat all savings as disposable cash or count an unlinked debt as zero.

### 3.3 Ingestion and interpretation lifecycle

```text
Plaid / manual imports
  → normalize amounts, currency, IDs and pending/posted changes
  → preserve user corrections and reconcile account movements
  → user rules → provider/pattern evidence → AI for ambiguity → unknown
  → shared deterministic metric snapshot
  → Cashboard / detail / assistant / external agent
```

- Trace every caller of shared sync/category functions before editing, including backfill, cron, webhooks, manual imports, and user-triggered categorization.
- Process exact added/modified IDs; record sync progress only after successful required writes. Check deletion/balance/cursor write errors and make interrupted retries safe. Serialize or otherwise prevent overlapping syncs for the same item from racing.
- Handle added/modified/removed updates and pending-to-posted replacement without duplicate cash effects or lost corrections. Plaid represents posting with a new transaction and linkage to the pending record; use that linkage rather than amount/date guessing. [Plaid transaction states](https://plaid.com/docs/transactions/transactions-data/)
- Persist raw provider context separately from user decisions, either through atomic namespaced metadata updates or narrow explicit fields selected in the schema gate. No wholesale duplicate transaction store is required.
- Move slow AI work off the interactive connection/page-render path. Use the existing cron/deployment pattern plus a minimal durable pending-work record and bounded retries, not fire-and-forget promises. Do not add a queue service unless observed volume requires it.
- Treat free-form merchant descriptions and imported text as untrusted data, never tool instructions. Send only necessary financial context to AI; omit credentials and unnecessary identifiers.
- Keep category, financial meaning (income/refund/transfer/spend), recurring status, and review state distinct. Correctly categorizing a merchant does not prove its transfer or income meaning.
- Unknown category does not exclude a known debit from cash movement. Review cannot be a prerequisite for honest totals.
- Sample and evaluate automatic decisions against labeled examples. Track automation coverage separately from accuracy; 90% is a target, not a launch-time claim or model-reported probability.

### 3.4 One metric contract for all consumers

Extend the existing cashflow service/types and pure calculations; do not move them to another package solely for naming aesthetics. Add a small server-side Cashboard composition function only if needed to join review counts/action summaries to that snapshot.

Every headline carries amount/unit, currency, time window, as-of time, included-account coverage, evidence references, and assumptions/unavailability reason. Add a snapshot/version identifier sufficient for consistency and scenario comparisons; a persistent snapshot table is not required unless building real historical series.

| Metric | Required behavior |
| --- | --- |
| Available to spend | Additional spending possible now without crossing the buffer during the payday window. Include essential allowances and committed outflows. If payday is unknown, use a labeled provisional window. Show a shortfall, not a clamped reassuring zero. Keep a distinct 30-day/per-account risk warning. |
| Passive income | Identified passive-income cash receipts for a stated period: for example interest, cash dividends, user-confirmed rent/royalty receipts. Exclude wages, refunds, loan proceeds, own-account transfers, asset-sale proceeds, and unrealized gains. Separate reinvested income and gross rent from spendable/net cash. Label partial coverage. |
| Debt owed | Included credit and loan balances, with account-level sources/as-of dates and consistent sign conventions. APR, monthly interest, payoff dates, and strategies require actual supporting inputs; omit them otherwise. |
| Cash cushion | Designated emergency reserves divided by essential monthly outflows. Disclose whether the denominator is estimated from recurring bills/allowances or measured history; confirm one consistent definition against the existing calculator. Missing essentials means unavailable, not infinite months. |
| Net worth | Included asset balances minus liabilities, with missing coverage disclosed. No growth percentage/sparkline until comparable historical snapshots actually exist. |

Further rules:

- One calculation result feeds the tile and its breakdown. A subtraction list must include every component that explains the number; if the low occurs before the window ends, explain timing instead of forcing an inaccurate end-balance identity.
- Do not subtract a pending debit twice if it is already reflected in the chosen balance basis. Do not count a credit-card purchase and its repayment as two expenses.
- Money calculations use the existing cent-based conventions; reject nonfinite/invalid inputs at boundaries. Currency formatting is not currency conversion.
- Corrections, sync, account inclusion, buffer/recurring edits, and payment status updates invalidate affected views and assistant context. Render baseline/scenario results from the same input snapshot.
- Match all new UI, AI tools, and agent results on period and semantics. Keep old API fields compatible or version them explicitly.
- Cashflow math, review and account management remain usable without chat credits or model availability. Confirm the operating-cost policy for background AI separately from user-paid chat; do not silently charge for basic balance viewing.

### 3.5 Optional clarification: screen 3

- Query unresolved financial questions directly with pagination and correct counts; do not infer them solely from missing category or tax assignment.
- Rank by likely financial impact and ambiguity, not only confidence or merchant frequency. Show the reason for the question, not a claimed percentage of Cashboard accuracy.
- Present one transaction at a time with an optional explicitly scoped group of genuinely similar transactions.
- Choices can resolve financial meaning as well as category. Selecting own-account transfer must use the transfer/reconciliation path, not merely set a category named Transfers.
- Require an explicit selection before Save; the model's suggestion is not user confirmation. Provide Something else, Skip, and Done for now. Progress such as “3 of 11” refers to the review session, not measured financial accuracy.
- Remember for similar payments starts unchecked. Explain the matching scope and affected items; never silently classify all Zelle/Venmo payments alike or rewrite historical records in bulk.
- Persist answers with provenance, expose a correction/undo path in Activity, and preserve them across resync. Skip advances the session without falsely resolving the item. Store resume/defer state only if needed for the agreed UX.
- Validate ownership of transaction, category, account, and rule IDs; save decision/rule state atomically where partial writes would mislead users. Revalidate Cashboard, cashflow, Activity and the review queue, not only the existing Books routes.

### 3.6 Insights, Gremmy and agent access

- Use the current assistant overlay/API and orchestrator. Consumer copy says Ask Gremmy; tool and API identifiers can remain stable.
- Pass structured metric context/evidence IDs, not a browser-calculated competing answer. Natural-language scenario inputs must be normalized into visible amount/date/type controls before applying them.
- Start with one evidence-backed insight: cash risk, changed bill, subscription-cost change, or useful missing input. Allow dismissal using existing action state.
- Never infer that a subscription is unused from bank data alone. No invented savings, automatic cancellation claims, or generic advice feed.
- Add narrowly scoped summary/explanation capabilities to the existing registry; detailed transaction access is a separate permission. Validate schemas and actually enforce rate limits server-side, not only in discovery metadata.
- Preserve current REST integrations. If MCP is a launch promise, select a supported protocol version and implement/test the required transport, tool calls, and authorization with a real client; a JSON catalog is insufficient. [MCP transport reference](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

### 3.7 Payments: screen 4 is a separate product/security boundary

**Do not reuse the current agent-returned confirmation token as proof that a human approved a payment.** Keep payment authority inaccessible to agent credentials and model output.

Primary-owned design gate before implementation:

1. Select the actual rail/provider and confirm support for paying third-party billers, geography, onboarding, consumer authorization, fees, returns/disputes, and operational responsibilities. Existing Plaid connectivity or Stripe AI-credit billing does not establish that capability. Provider authorization and duplicate protection are separate steps in payment products. [Plaid transfer flow, illustrative rather than a provider selection](https://plaid.com/docs/transfer/creating-transfers/)
2. Specify verified recipient ownership/details, agent identity, allowed scope, per-payment and cumulative limits, source account, amount/currency, date, fees, and expiry.
3. Persist a request state machine: requested → approved or declined/expired → submitting → pending → settled or failed/returned. Approval is not settlement; a timeout is not proof of failure.
4. Human approval happens in an authenticated owner session with fresh step-up verification. “Approve with passkey” requires real enrolled WebAuthn credentials, verified challenge/origin/RP/user verification and a recovery policy. Until that exists, do not ship a passkey-labeled button that only posts a token.
5. Bind approval to the immutable request version and full payment details. Consume authorization once, atomically; changed amount/payee/date/fees require reapproval. Remove insecure signing fallbacks from any production approval path.
6. Recheck connection revocation, payee policy, available funds, limits and expiry immediately before execution. Reserve cumulative limits atomically so concurrent approvals cannot bypass them.
7. Use application/provider idempotency, authenticated deduplicated webhook handling, retry-safe status reconciliation, and a durable receipt. Reconcile the payment to bank records and forecast obligations to avoid double-counting.
8. A claim like “$1,840 available after payment — already budgeted” requires matching this request to that exact included obligation. Otherwise recalculate the effect; never hardcode unchanged availability.
9. Give users revoke/decline/status controls. Only offer cancellation when the rail still allows it. Audit decisions without logging secrets or unnecessary financial payloads.

Payment tables and endpoints are designed only after this gate; do not build speculative payments infrastructure in Release A. Initially, external agents may prepare a request, never approve it for the user. Autonomous standing mandates are deferred.

### 3.8 Persistence and security scope

Reuse `books_transactions`, account/category/rule tables, `cashflow_recurring_items`, `cashflow_action_state`, `user_settings`, and `agent_connections` where their semantics fit.

Primary must approve the smallest additive schema delta for currency/provider linkage, protected interpretation/provenance, and queryable review state. If existing metadata cannot be safely updated/queried, introduce explicit columns or one narrow decision record rather than a generic event-sourcing system. Version migrations and backfill idempotently without inventing historical values or overwriting manual corrections.

For new/changed persistence, test both grants and owner-scoped RLS, including inserts/updates that try to attach someone else's IDs. Service-role queries bypass RLS and therefore require explicit authenticated ownership scoping. Payment policy fields must not be writable through a generic client update path. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 4. GUI restyling

### 4.1 Design tokens and existing infrastructure

Keep Next.js/React, Tailwind 3, existing UI primitives, Lucide icons and the existing Inter font. Achieve the look through tokens, hierarchy and spacing; no framework/font/animation-library migration is necessary.

Proposed visual tokens (starting values, subject to contrast verification):

| Role | Value | Usage |
| --- | --- | --- |
| Canvas | `#181C21` | Consumer screen background |
| Surface | `#252B34` | Cards, inputs, dialogs |
| Raised surface | `#303744` | Hover/selected secondary states |
| Primary lime | `#C7F65A` | Available-to-spend tile, principal actions, active navigation |
| On lime | `#11180A` | Text/icons on lime; never white labels on this fill |
| Main text | `#F5F7FA` | Headings, values |
| Secondary text | `#B8C0CC` | Supporting copy; verify every pairing |
| Teal tile | `#153F48` | Passive income and scenario context |
| Violet tile | `#403958` | Debt and agent-request context |
| Slate tile | `#303C54` | Cushion |
| Border | `#46515F` | Interactive outlines; confirm 3:1 where required |
| Attention / danger | `#F3C76A` / `#FF8C88` | Genuine incomplete-data/risk states, always with text/icon |

- Map these into the existing semantic HSL variable format and UI-v2 selectors; do not paste unrelated hex values into each component.
- Scope the initial override to the enabled signed-in app root, including portal/overlay/toast roots. Do not accidentally recolor public marketing pages or break the old UI fallback.
- Replace relevant hardcoded light backgrounds, glass borders, gradient logos and status colors in shared shell/UI-v2 components. Theme native controls with `color-scheme` as appropriate.
- Card radius: roughly 20–24px; control radius: 12–16px; layout spacing in 4/8px increments; mobile side padding 16–20px.
- Hero numbers roughly 40–48px mobile; secondary values 28–32px. Use tabular numerals and responsive sizing, not clipped fixed-height boxes. Body text normally 14–16px.
- Reuse existing components first. Extract only repeated metric tile, status/evidence line, and choice-row patterns when needed; avoid a new design-system package.

### 4.2 Screen composition

**Screen 1 — Cashboard**

- Small greeting/connection status, restrained Gremmy, contextual Ask field.
- Dominant full-width lime spending tile; four secondary tiles in a 2×2 grid: passive income, debt, cushion, net worth.
- Optional clarification strip, one insight, then eligible action request. Urgent cash/data problems outrank optional insights.
- On small screens the secondary grid can stack at high zoom/large text; no horizontal scrolling to read an amount.

**Screen 2 — spending detail**

- Same amount/window/status as home; back navigation and a clear “How we got here” breakdown.
- Accessible forecast with current/projected distinction, buffer reference, dates and a text summary/table.
- Upcoming bills open useful detail/recurring correction; scenario action says **Preview transfer**, not Move money, in Release A.
- Display negative/provisional/unavailable states honestly; do not retain a celebratory lime spending card when it would imply the user can spend safely.

**Screen 3 — clarification**

- Compact progress, focused transaction, Gremmy suggestion, large radio-style choices.
- One clear Save & next action, secondary Skip, and easy exit. Preserve selection on request failure and prevent duplicate submissions.
- Announce save/progress changes accessibly; do not move on until persistence succeeds.

**Screen 4 — payment review**

- Agent identity, recipient, amount, source, date/fees, forecast effect, factual checks, then approval/decline.
- No playful animations or mascot celebration on approval; calm copy and clear pending/failed/returned states.
- Demo and production screens must be unmistakably separated. Never insert a fabricated request into a real user's home.

### 4.3 Gremmy and responsive behavior

- Reuse `apps/web/public/assets/gremlin-v3-crop.png` as the identity reference. It has a light image background: obtain a proper transparent cutout/derivative for dark UI rather than shipping a white rectangle or using unreliable blend modes. Preserve the original asset.
- Use one small greeting pose and an avatar first. Add more poses only for a concrete state, not a mascot animation system.
- Gremmy never overlaps numbers, form labels, warnings or payment details. Decorative imagery has empty alt text; meaningful status remains written text.
- Prefer “A quick question” and “Here’s what changed” over bookkeeping jargon. No debt shaming, streak pressure, or invented accuracy badges.
- Mobile: safe-area-aware bottom navigation; screen content and sticky actions clear the keyboard/home indicator. Desktop: useful wider layouts, not four phone frames rendered in the app. The walkthrough's phones are presentation framing only.
- Use short CSS state transitions and respect reduced motion. No continuous animation needed.
- Keyboard operation, visible focus, minimum 44px interaction targets, 200% text zoom/reflow, screen-reader labels, non-color status cues and contrast checks are release requirements.

### 4.4 App-wide styling coverage

Apply in controlled waves, not a global CSS swap followed by cleanup:

1. Signed-in shell, reusable controls, Cashboard and spending detail.
2. Clarification, Activity/detail, Accounts/connection states, recurring edits, What if, chat overlay, Settings, toasts/dialogs.
3. Reachable advanced workspaces: inherit coherent chrome/control tokens, remove unreadable light-on-dark conflicts, preserve dense layouts and all existing behavior.
4. Sign-in/onboarding/auth-recovery handoff: coordinated visual treatment without changing authentication semantics. Public marketing redesign is excluded.

## 5. Ordered implementation work packages

Primary owns architecture, metric definitions, security/migration decisions and final acceptance. Executor receives only bounded approved tasks. The primary writes this plan directly; no product pipeline is launched just to produce the plan.

| Package | Concrete deliverable | Dependencies / acceptance gate |
| --- | --- | --- |
| **P0 — contracts and baseline** | Inventory current flags/callers, migration status, account/currency coverage; hand-calculated fixtures; route/state map; before screenshots and test baseline. Resolve cushion/passive-income definitions. | Primary approval required. Do not assume the old plan's findings still apply or the mockup's data is real. |
| **P1 — ingestion and shared metrics** | Exact sync IDs, correction-safe lifecycle, durable AI retry path, complete review eligibility, new passive/debt contracts, canonical spending semantics and refresh behavior. | P0. Primary designs additive schema/security changes. Tests prove retries, pending replacement, unknown handling and financial totals. |
| **P2 — theme and consumer shell** | Scoped Midnight & Lime tokens, simplified routes/navigation, responsive shell, controls and Gremmy asset. | P0; may proceed while P1 runs if file ownership does not overlap. All existing flag combinations and reachable advanced routes remain usable. |
| **P3 — Cashboard and spending detail** | Screens 1–2, connected states, all tile drill-ins, scenarios and one evidence-backed insight. | P1 + P2. UI/detail/assistant same-snapshot values reconcile; no copied mockup facts in live screens. |
| **P4 — clarification and supporting journey** | Screen 3, atomic explicit decisions/rules, Activity/Accounts/Settings/recurring/chat styling, stale-data repair path. | P1 + P2; integrate with P3 before release. A correction survives resync, updates the correct totals and can be revised. |
| **P5 — read-only agents and Release A QA** | Shared summary/explanation capability, enforced permissions/validation/limits; MCP compatibility only if delivered/tested; end-to-end consumer acceptance. | P3 + P4. Unauthorized/cross-user access fails; no money movement or fake live requests. |
| **P6 — payment design and sandbox** | Provider/rail decision, threat model, request/approval persistence, real step-up flow, screen 4 sandbox and status lifecycle. | Separate primary/user approval of provider, authority and operational obligations; must not block Release A. |
| **P7 — controlled live payments** | Provider integration, durable submission/reconciliation, receipts, support procedures and narrow cohort rollout. | P6 plus security review, provider readiness, concurrency/replay/failure tests and explicit launch approval. |

No calendar estimate until P0 confirms data gaps, current test health and payment-provider scope. Payments are not a small UI follow-up.

For later implementation, use the repository's supervised `orca-per` / `scripts/orca-per.sh` Plan → Exec → Review workflow with one bounded package objective at a time. Planning owns `docs/plans`, execution owns product changes, review owns `docs/reviews` findings only. Launching the conductor is not completion; review does not fix or auto-merge. Primary resolves confirmed findings and verifies final results before accepting a package.

## 6. Verification and rollout

### Runnable baseline and regression checks

Run before implementation and after each relevant package, using a supported Node runtime for the repository's TypeScript test commands:

```sh
pnpm typecheck
pnpm --filter @cashpile/ai test:cashflow
pnpm --filter @cashpile/web test:books
pnpm --filter @cashpile/web test:ui-v2
pnpm --filter @cashpile/web test:release
pnpm ui-migration:test
pnpm build
```

These commands exist in current package scripts. They do not replace new service/API/security tests or browser checks, and are not claimed to have been run for this planning-only change. Inspect existing protected-path guards before capturing/checking baselines; do not recapture a changed baseline just to silence a regression.

Add focused tests alongside changed code using existing runners. Add browser automation only where existing tooling cannot cover the critical flow; record reproducible manual browser checks until automated coverage is in place. No testing-framework migration is required.

### Required acceptance scenarios

- Hand-calculated example: $4,020 − $1,280 bills − $400 savings − $500 buffer = $1,840, with every additional essential allowance shown when present. The mockup omits separate essentials; do not hide them in production.
- A pending debit posts under a new ID; retry, concurrent sync and user correction do not duplicate cash or erase decisions.
- Unknown debit/inflow, refund, own-account transfer, credit-card purchase/payment, passive receipt, asset sale, missing balance, stale account and mixed currency all produce honest distinct outcomes.
- Payday-window availability differs from 30-day risk; every consumer uses the correct labeled metric. Per-account shortfall is not hidden by aggregate cash.
- No history means no fabricated trend; no APR means no payoff/interest promise; missing reserve/essentials means no invented cushion.
- New user connects accounts and gets partial useful results without category setup; failed AI/background work does not blank the Cashboard.
- Review Save, Skip, exit/resume, revision, rule opt-in, request failure and concurrent refresh behave correctly. No forced review and no guessed “94% accurate” badge.
- Cross-user account/category/transaction/request IDs are rejected; unauthenticated, expired and revoked agent requests fail; prompt injection cannot authorize tools or money movement.
- All three navigation destinations, tile drill-ins, reconnect, Ask Gremmy and back links work on mobile and desktop. Home and deep links respect the same feature eligibility.
- Check 360px and 390px mobile, tablet and desktop widths, 200% zoom, keyboard, screen reader, focus/contrast, large values, reduced motion, loading/empty/error/stale states and on-screen keyboard overlap.
- For payments: preview changes, altered payload, reused/expired approval, revoked agent, concurrent limits, provider timeout, duplicate/out-of-order webhooks, failed/returned payment and unmatched forecast obligation are all tested. No “paid” before verified settlement.

### Release mechanics

- Record before/after screenshots and test evidence per package; report existing failures separately from regressions.
- Use the existing cohort infrastructure for consumer rollout, with independent server-side payment kill switch. Additive migrations must preserve legacy compatibility; primary owns staging/backfill/restore validation before production application.
- Rollback returns users to the prior presentation without deleting financial records/corrections. Stopping new payments must not stop reconciliation of submitted ones.
- Observe time-to-first-useful-Cashboard, audited automation accuracy/coverage, correction retention, metric mismatches, user comprehension and support issues. Do not log raw balances/descriptions in generic analytics.
- Proposed usability gate: representative users can find their spending amount/window and explain its main deductions without being taught accounting. Zero known duplicate-money, cross-user or approval-bypass defects at release.

## 7. Decisions that must not be silently invented

Before their respective packages, primary/user approval is required for:

1. Passive-income scope and gross/net/reinvestment labeling; data-provider coverage needed to support it.
2. Cushion denominator, reporting currency, account-inclusion defaults and essential-spending assumptions.
3. Background AI operating-cost/credit policy and data-processing boundaries.
4. Payment provider/rail, supported recipients/regions, fees, limits, human step-up/recovery policy and operational/compliance ownership.

These do not block producing this plan or building the approved visual direction. They gate the affected financial behavior; when evidence is missing, show an honest unavailable/estimated state rather than a convincing invented number.
