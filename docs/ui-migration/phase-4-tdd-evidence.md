# Phase 4 TDD evidence

## Source plan and journeys

Source: [`AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md`](../../AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md), Phase 4.

Validated journeys:

1. A UI V2 user receives a task-oriented module entrance.
2. A flag-off user continues to receive the existing detailed module page.
3. A user can add `?view=details` to reach the existing presentation.
4. Every entrance presents exactly four tested destinations and no unsupported
   `/trades/metrics` link.
5. Each entrance surfaces at most one observation from data already acquired.
6. Contextual Cash opens the existing overlay with a prefilled prompt without
   submitting it.
7. An unauthorized Tax user continues to receive the existing 404.

## RED

The executor first created `module-home-model.test.ts` and ran:

```sh
pnpm --dir apps/web test:ui-v2
```

Result: failed as intended with `ERR_MODULE_NOT_FOUND` because
`module-home-model.ts` did not exist.

## GREEN

After the minimum shared model and entrance presentation were implemented, the
same command passed 11 tests with 0 failures. The Phase 4 tests cover:

- UI V2 versus flag-off and `view=details` selection.
- Exact action ordering and route destinations for all six entrances.
- The three-to-four action constraint.
- Exclusion of the unavailable `/trades/metrics` route.

Primary review then changed the detail anchor to Next.js client navigation and
corrected amount and count formatting. The 11 tests and web typecheck passed
again after those corrections.

## Test specification

| Guarantee | Test or command | Result |
|---|---|---|
| UI V2 renders an entrance unless `view=details` | `module-home-model.test.ts` | PASS |
| A disabled flag renders the existing page | `module-home-model.test.ts` | PASS |
| Module action order and routes remain exact | `module-home-model.test.ts` | PASS |
| No entrance exposes `/trades/metrics` | `module-home-model.test.ts` | PASS |
| Protected backend hashes remain unchanged | `pnpm ui-migration:guard:check` | PASS |
| Required routes remain present | `pnpm ui-migration:routes` | PASS |

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

- UI V2 presentation models: 11 tests passed.
- Migration guard and route validator: 6 tests passed; 34 routes validated
  with the documented `/trades/metrics` exception.
- Books services: 11 tests passed.
- Workspace typecheck passed.
- Production build passed and generated 68 application routes.
- Protected-path and whitespace checks passed.

The Node test runner continues to emit the existing package module-type warning.
No package metadata was changed for that warning.

## Visual and interaction smoke review

The flagged entrances were reviewed read-only in an authenticated local session
at the default desktop viewport. Cash Flow was also reviewed at 375 by 812.

Verified:

- Cash Flow, Subscriptions, Books, Trades, and Pulse each rendered exactly four
  icon-led actions and one current observation.
- Tax continued to return 404 for the tested tax-disabled account.
- The contextual "Ask Cash" button opened the existing overlay with the
  module-specific prompt prefilled and did not submit it.
- "Open detailed workspace" navigated to `/cashflow?view=details`, where the
  existing "Cash Flow Copilot" presentation rendered.
- Mobile document width equaled the 375-pixel viewport with no horizontal
  overflow, and the actions formed a two-by-two grid.
- No browser console errors were reported.

Authenticated screenshots were intentionally not persisted because the
available session contained live financial data.

## Coverage and known gaps

No percentage coverage command exists for the Node UI model target, so no
coverage percentage is claimed. Tax's authorized entrance was covered by the
shared model, server branch review, typecheck, and production build; the
available browser account was correctly unauthorized and therefore could not
render that entrance without bypassing access controls.

## Git evidence

No checkpoint commits were created because the shared working tree already
contained unrelated tracked and untracked changes. This report preserves the
actual RED and GREEN evidence without staging or committing unrelated work.
