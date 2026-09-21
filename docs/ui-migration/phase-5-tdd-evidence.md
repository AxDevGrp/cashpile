# Phase 5 TDD evidence

## Source plan and journeys

Source: [`AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md`](../../AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md), Phase 5.

Validated journeys:

1. A UI V2 user receives the shared read-workspace hierarchy on every planned
   Phase 5 route.
2. A flag-off user continues to receive the existing presentation.
3. Contextual Cash opens with a workspace-specific prompt without submitting it.
4. Existing records, totals, ordering, filters, calculations, access decisions,
   and embedded actions remain unchanged.
5. Empty and unauthorized states preserve their existing decisions.

## RED

The executor first created `read-workspace-model.test.ts` and ran:

```sh
pnpm --dir apps/web test:ui-v2
```

Result: failed as intended with `ERR_MODULE_NOT_FOUND` because
`read-workspace-model.ts` did not exist.

## GREEN

After implementing the minimum registry and workspace presentation, the same
command passed 13 tests with 0 failures. The Phase 5 tests cover:

- UI V2 versus flag-off workspace selection.
- Exact IDs, routes, titles, purpose copy, and contextual Cash prompts for all
  seven route surfaces.

Primary review rejected the initial wrapper-only pass because it duplicated
legacy headings. The corrected implementation passes the UI V2 boolean into the
presentation clients, renders one workspace heading, retains existing actions,
and adds scoped control and table styling. Primary review also brought the
Reports no-entity state into the V2 frame and removed duplicate React row keys
without changing recurring records or order.

## Test specification

| Guarantee | Test or command | Result |
|---|---|---|
| Flag-off preserves the legacy workspace selection | `read-workspace-model.test.ts` | PASS |
| Seven workspace definitions retain exact route metadata | `read-workspace-model.test.ts` | PASS |
| Protected backend hashes remain unchanged | `pnpm ui-migration:guard:check` | PASS |
| Required routes remain present | `pnpm ui-migration:routes` | PASS |
| Existing Books service behavior remains green | `pnpm --filter @cashpile/web test:books` | PASS |

## Additional validation

The following commands passed after primary review:

```sh
pnpm --dir apps/web test:ui-v2
pnpm ui-migration:test
pnpm --filter @cashpile/web test:books
pnpm typecheck
pnpm build
pnpm ui-migration:routes
pnpm ui-migration:guard:check
git diff --check
```

Results:

- UI V2 presentation models: 13 tests passed.
- Migration guard and route validator: 6 tests passed; 34 routes validated
  with the documented `/trades/metrics` exception.
- Books services: 11 tests passed.
- Workspace typecheck passed.
- Production build passed and generated 68 application routes.
- Protected-path and whitespace checks passed.

The Node test runner continues to emit the existing package module-type warning.
No package metadata was changed for that warning.

## Visual and interaction smoke review

The flagged workspaces were reviewed read-only in an authenticated local session
at the default desktop viewport. Events, Accounts, and recurring details were
also checked at 375 by 812.

Verified:

- Reports, recurring details, performance, events, correlations, and accounts
  rendered the V2 workspace heading and one contextual Cash trigger.
- Reports preserved its no-entity creation link.
- Tax Entities continued to return 404 for the tested unauthorized account.
- The Events controls kept their visible values and selecting Fed updated the
  URL to `?category=fed`.
- Contextual Cash opened with "What events should I watch?" prefilled and did
  not submit a message.
- Desktop and mobile widths had no document-level horizontal overflow.
- A fresh recurring-details load reported no browser console errors after the
  React key correction.

Authenticated screenshots were intentionally not persisted because the
available session contained live financial data.

## Coverage and known gaps

No percentage coverage command exists for the Node UI model target, so no
coverage percentage is claimed. The available account had no Reports entity,
no Trades account, and no Tax Entity entitlement; those states were verified as
the correct existing empty or unauthorized outcomes. Populated report and
performance value parity remains covered by code review, unchanged data paths,
typecheck, and the production build rather than seeded browser fixtures.

## Git evidence

No checkpoint commits were created because the shared working tree already
contained unrelated tracked and untracked changes. This report preserves the
actual RED and GREEN evidence without staging or committing unrelated work.
