# Phase 0 TDD evidence

## RED — 2026-07-31

Command run before implementation:

```sh
node --test scripts/ui-migration/test/*.test.js
```

Actual result: exit code `1`.

```text
Error: Cannot find module '../protected-path-guard'
Error: Cannot find module '../route-manifest'
# tests 2
# pass 0
# fail 2
```

The tests were written first to require path selection, deterministic hash manifests, added/modified/deleted comparison, route validation in temporary directories, and the documented `/trades/metrics` exception.

## GREEN — 2026-07-31

Commands run after implementation and manifest capture:

```sh
pnpm ui-migration:test
pnpm ui-migration:guard:check
```

Actual result: both commands exited `0`.

```text
# tests 6
# pass 6
# fail 0
Route manifest validated: 34 routes (1 documented exception).
Protected-path check passed: docs/ui-migration/protected-path-manifest.json
```

The capture command also completed successfully:

```sh
node scripts/ui-migration/protected-path-guard.js capture
# Captured protected-path manifest: docs/ui-migration/protected-path-manifest.json
```

No coverage measurement was run or claimed.

## Supervising-agent verification

The primary agent independently reran the Phase 0 checks after reviewing the executor's diff.

| Check | Result | Evidence |
|---|---|---|
| Protected backend baseline | PASS | `pnpm ui-migration:guard:check` reported no added, modified, or deleted protected files. |
| Phase 0 unit and route tests | PASS | `pnpm ui-migration:test`: 6 passed, 0 failed; 34 routes validated with 1 documented exception. |
| Existing Books tests | PASS | `pnpm --filter @cashpile/web test:books`: 11 passed, 0 failed. |
| TypeScript | PASS | `pnpm typecheck`: 4 tasks successful. |
| Production build | PASS | `pnpm build`: Next.js production build completed and generated 67 static/dynamic pages. |
| Lint | BLOCKED BY PRE-EXISTING CONFIG GAP | `pnpm lint` opens the interactive Next.js ESLint setup prompt because the repository has no ESLint configuration, then exits 1. No lint configuration was added during this frontend-baseline phase. |
| Runtime smoke | PASS, LIMITED | Public `/` returned 200; unauthenticated `/cashboard` returned 307 to `/login?next=%2Fcashboard`; an authenticated read-only `/cashboard` render succeeded in the local browser. |

Authenticated screenshots were not persisted because the available session contained live financial data. A seeded non-production account is required for safe screenshot baselines and broader browser automation.
