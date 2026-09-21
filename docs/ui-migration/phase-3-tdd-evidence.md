# Phase 3 TDD evidence

## Source plan and journeys

Source: [`AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md`](../../AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md), Phase 3.

Validated journeys:

1. A UI V2 user lands on a sparse AI-first Home instead of the dense dashboard.
2. A flag-off user continues to receive the existing Cashboard.
3. A user can open `/cashboard?view=details` to reach every legacy capability.
4. A tax-disabled user receives a Books action and never receives a Tax action
   or Tax module entrance.
5. Cash shows exactly one insight based on the already-ranked top reminder.
6. The Home prompt opens the existing Cash overlay without new chat logic.

## RED

The executor first created `home-model.test.ts` and ran:

```sh
pnpm --dir apps/web test:ui-v2
```

Result: failed as intended with `ERR_MODULE_NOT_FOUND` because
`home-model.ts` did not exist.

## GREEN

After the minimal model and presentation implementation, the same command
passed 9 tests with 0 failures. The three Phase 3 tests cover:

- UI V2 versus legacy/details selection.
- Exact Home action ordering and Tax gating.
- Top-reminder insight mapping and the calm default insight.

Primary review then removed descriptive tile copy, corrected module icon
semantics, and changed the detailed overview anchor to client-side navigation.
The same 9 tests and web typecheck passed after the correction.

## Test specification

| Guarantee | Test or command | Result |
|---|---|---|
| UI V2 renders Home unless `view=details` | `home-model.test.ts` | PASS |
| A disabled flag renders the legacy dashboard | `home-model.test.ts` | PASS |
| Home action order remains stable | `home-model.test.ts` | PASS |
| Tax is replaced by Books when access is absent | `home-model.test.ts` | PASS |
| The top reminder maps to the correct insight severity and action | `home-model.test.ts` | PASS |
| No reminder produces one calm fallback insight | `home-model.test.ts` | PASS |
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

- UI V2 and Home models: 9 tests passed.
- Migration guard and route validator: 6 tests passed; 34 routes validated
  with the documented `/trades/metrics` exception.
- Books services: 11 tests passed.
- Workspace typecheck passed.
- Production build passed and generated 68 application routes.
- Protected-path and whitespace checks passed.

The Node test runner continues to emit the existing package module-type warning.
No package metadata was changed for that warning.

## Visual and interaction smoke review

The flagged Home was reviewed read-only in an authenticated local session at the
default desktop viewport and at 375 by 812.

Verified:

- Cash and the primary prompt are the visual focal point.
- The four action tiles contain icons and short labels only.
- Exactly one priority insight is presented.
- Tax was absent for the tested tax-disabled account.
- The module shortcut updated the URL to `/cashboard#modules`.
- Clicking "View dashboard details" navigated to
  `/cashboard?view=details`, where the existing "Cashpile Dashboard" rendered.
- Mobile document and body width both equaled the 375-pixel viewport, with no
  horizontal overflow.
- No browser console errors were reported.

Authenticated screenshots were intentionally not persisted because the
available session contained live financial data.

## Coverage and known gaps

No percentage coverage command exists for the Node UI model target, so no
coverage percentage is claimed. The Cash prompt bridge was not submitted during
the browser review because doing so would call the existing AI endpoint and
consume account credits; its callback wiring is covered by code review and web
typecheck.

Seeded non-production data is still required before authenticated reference
screenshots or write-path browser tests can be committed safely.

## Git evidence

No checkpoint commits were created because the shared working tree already
contained unrelated tracked and untracked changes. This report preserves the
actual RED and GREEN evidence without staging or committing unrelated work.
