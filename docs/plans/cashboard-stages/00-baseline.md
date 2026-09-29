# Stage 00 — baseline and reproducible handoff

Prerequisite: read README.md and contracts.md. No product behavior change.

## Allowed changes

- None to application code or dependencies.
- Execution evidence may be attached to the handoff; primary archives approved visual references under `docs/plans/cashboard-stages/reference/` and updates plan links. Do not stage unrelated `output/`, `.next.stale-*`, tsbuildinfo or state.lock files.

## Ordered tasks

1. Record `git status --short`, `git rev-parse HEAD`, Node version, and `package.json` packageManager. The checkout requests pnpm 10.30.3. Find the existing pnpm executable/environment; if unavailable, stop and request primary environment repair. Do not install an arbitrary latest pnpm or run npm install against this monorepo.
2. Verify all stage paths against this checkout and migration IDs 027–029 are unused. If not, report the collision; primary issues a revised pack.
3. Record (without changing) the two UI gate values in local/staging. Do not print credentials or real-user cohort UUID lists in public logs.
4. Primary supplies an isolated test DB containing existing migrations through 026 and synthetic owners A/B. Do not connect test writes to production. Record actual schema vs repository migrations; missing prerequisites block stage 01.
5. Run the baseline commands below individually, preserving exit codes. Existing failure is not permission to delete a test. Classify environment, pre-existing behavior and new regression separately.
6. Capture local screenshots at 390×844 and 1440×1000 for Cashboard, cashflow details, review, Activity, Accounts, Settings, chat, and one advanced Books screen. Use fixture data only.
7. Primary archives the approved walkthrough PNG and original Gremmy reference alongside the pack, or attaches immutable files to each executor handoff. Do not hand off a local image path that will not exist in the Orca worktree.
8. List all readers/writers of `books_transactions`, `books_financial_accounts`, `syncPlaidItem`, `backfillPlaidItemTransactions`, `categorizeTransactionsByIds`, `CashflowSnapshot`, `safeToSpend` and `availableUntilPayday`. Record additional callers not covered by this pack and stop the affected stage for primary amendment.

## Baseline commands

```sh
pnpm typecheck
pnpm --filter @cashpile/ai test:cashflow
pnpm --filter @cashpile/web test:books
pnpm --filter @cashpile/web test:ui-v2
pnpm --filter @cashpile/web test:release
pnpm ui-migration:test
pnpm build
```

No command here applies migrations or launches the implementation pipeline. Run builds only in the isolated worktree to avoid disturbing an active local Next server.

## Exit gate

- Primary has a baseline with actual commands, exit codes, screenshots and caller inventory.
- Unknown environment/schema failures are resolved or explicitly block the affected package; they are not counted as passes.
- Reference files are accessible in the executor worktree.
- Stage 01 may author SQL only after primary reviews contracts.md; database application remains primary-controlled.
