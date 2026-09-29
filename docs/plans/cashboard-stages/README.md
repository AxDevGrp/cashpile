# Cashpile executor pack — Midnight & Lime

Date: 2026-09-28. Status: prescriptive design; implementation not started.

This pack replaces discretionary portions of [the roadmap](../cashboard-midnight-lime-implementation.md). Read this file and [the frozen contracts](contracts.md) before executing any stage. Financial, schema, authorization and rollout decisions belong to the primary, not the executor. These documents specify that design; they are not authorization to alter a production database or move money.

Visual acceptance reference: [Midnight & Lime walkthrough](reference/midnight-lime-walkthrough.png), copied into this plan bundle. Stage 00 must ensure the entire bundle/reference is included in the worktree handoff; no commit or pipeline launch was performed while creating this pack.

## Execution order

| Stage | Deliverable | Prerequisites | Execution status |
| --- | --- | --- | --- |
| [00 — baseline](00-baseline.md) | Reproducible environment, visual reference and known-failure baseline | None | Ready for primary-supervised execution |
| [01 — persistence](01-persistence.md) | Exact schema/RPC contracts for corrections and ingestion | 00 | Author migration in worktree; primary approves/applies in isolated DB |
| [02 — ingestion](02-ingestion.md) | Retry-safe sync, preserved corrections, bounded background interpretation | 01 schema tests pass | Ready after prerequisites |
| [03 — metrics](03-metrics.md) | Single typed Cashboard snapshot, financial fixtures | 02 | Ready after prerequisites |
| [04 — clarification](04-clarification.md) | Owner-scoped queue and explicit versioned correction actions | 03 | Ready after prerequisites |
| [05 — shell and theme](05-shell-theme.md) | Cohort-consistent Midnight & Lime navigation and controls | 00 | May run before 01–04; do not enable cohort publicly |
| [06 — consumer screens](06-consumer-screens.md) | Home, spending detail, metric drill-ins and clarification UI | 03, 04, 05 | Ready after prerequisites |
| [07 — supporting journey](07-supporting-journey.md) | Activity, Accounts, settings, scenarios, chat and advanced chrome | 06 | Ready after prerequisites |
| [08 — agents](08-agents.md) | Read-only summary/explanation API; connection/revoke UI | 03, 07 | Ready after prerequisites; no payment capability |
| [09 — acceptance](09-acceptance.md) | Full regression, browser evidence, staged rollout/rollback | 01–08 | Primary accepts and authorizes rollout |
| [10 — payments](10-payments-HOLD.md) | Explicit payment decision gate and sandbox/live boundary | Separate authorization | **HOLD. Not an executable payment implementation stage.** |

Release A is stages 00–09. It is useful without money movement. The approved fourth screen is retained as the future payment reference, not faked in users' live accounts.

## Rules for every executor assignment

1. Execute one stage only. Do not advance until the primary accepts the diff and evidence.
2. Read that stage's allowed files and contracts. First write the specified failing tests, then implement the minimum change to pass them.
3. Preserve existing URLs, API field meanings, protected data, user edits and unrelated work. No dependency upgrades, alternative design systems, framework migrations or broad cleanup.
4. If a required path/type differs from this checkout, stop and report the mismatch. Do not invent a replacement architecture. Tiny internal implementation choices are permitted; product/security contracts are not.
5. Do not catch a failure and return a success-shaped empty result. Use the specified unavailable/error state.
6. No production migrations, deployments, feature enablement, secrets printing, real AI/bank requests in tests, or payment operations without explicit primary approval.
7. Keep evidence outside the frozen plan. Report changed files, test commands/results, red→green cases, browser screenshots, known failures and any blocker in the handoff. Review writes findings under `docs/reviews`; review does not fix or merge.
8. For UI-only stage 05, protected backend paths must remain unchanged. Other stages intentionally touch protected paths: compare against the approved stage allowlist, never recapture a guard baseline to conceal changes.

Path convention: unless a path begins `apps/`, `packages/`, `scripts/` or `docs/`, paths beginning `app/`, `components/`, `modules/` or `lib/` are relative to `apps/web/src/`. New component paths are expanded in their stage; no choice of directory is left to the executor.

Use the repository's `scripts/orca-per.sh` launcher with a bounded stage objective when implementation is requested. It starts a conductor, not a completed pipeline. Planning owns `docs/plans`, execution owns product changes, review owns `docs/reviews`. Primary resolves confirmed findings and performs final acceptance. Do not launch it merely to read this pack.

Suggested objective template (not a command to run during planning):

> Implement only Cashpile stage NN from docs/plans/cashboard-stages/NN-….md, following contracts.md; stop at its exit gate. No production operations, no automatic merge, no next-stage work.

## Fixed scope and omissions

- Responsive web, USD-only consumer calculations in Release A; no implicit FX conversion.
- Keep Books/Tax/Trades/Pulse accessible in Advanced, with current authorization checks intact.
- Forecasts are estimates. Passive income means identified cash receipts, not tax treatment, investment performance or rental profit.
- AI categorizes/suggests; deterministic code computes; user permission controls writes.
- No new ledger, generic rules framework, vector store, workflow platform, theme picker or native app.
- No generated net-worth history, debt-free date, measured accuracy percentage, subscription-usage claim or autonomous payment.
- Existing REST agent integration ships first. Full MCP protocol implementation is explicitly deferred, not claimed complete by the current discovery route.

## Planning validation

Source inspected at the current checkout; deployed migration/feature status is unknown. A baseline attempt found `pnpm: command not found`; Node reports `v26.8.2`. No pnpm baseline suite passed during planning. Stage 00 resolves tooling without silently installing dependencies or changing versions. The primary must rerun current baselines before accepting implementation.
