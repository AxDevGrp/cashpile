# Phase 2 TDD evidence

## Source plan and journeys

Source: [`AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md`](../../AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md), Phase 2.

Validated journeys:

1. A user can switch to the new global shell without changing the page or its
   backend behavior.
2. A tax-disabled user never sees a Tax shell destination.
3. A tax-enabled user sees Tax and receives the most-specific active state.
4. A mobile user receives a compact, stable set of core destinations.
5. Disabling UI V2 restores the existing Sidebar shell.

## RED and GREEN

### Navigation model

The executor added tests before the navigation model implementation and ran:

```sh
pnpm --dir apps/web test:ui-v2
```

RED result: failed as intended because `model.ts` did not export
`getAppNavigation`.

After implementation, the same command passed 5 tests with 0 failures.

### Preview compatibility correction

Primary review found that filtering on a truthy `mobile` property would hide
the older Phase 1 preview destinations, whose items omit that optional field.
A regression test was added first.

RED result: failed as intended because `model.ts` did not export
`isMobileNavigationItem`.

After the compatibility helper and component fix:

```text
tests 6
pass 6
fail 0
```

The review also extended the shell's focus-visible and reduced-motion styles
from preview mode to application mode.

## Test specification

| Guarantee | Test or command | Result |
|---|---|---|
| The UI V2 flag accepts only explicit truthy values | `model.test.ts` | PASS |
| Nested routes match without prefix collisions | `model.test.ts` | PASS |
| Tax is absent when disabled and present when enabled | `model.test.ts` | PASS |
| `/books/tax` selects Tax instead of Books | `model.test.ts` | PASS |
| Preview items remain in mobile navigation unless explicitly hidden | `model.test.ts` | PASS |
| Existing insight priority remains deterministic | `model.test.ts` | PASS |
| Protected backend hashes are unchanged | `pnpm ui-migration:guard:check` | PASS |
| All documented routes remain present | `pnpm ui-migration:routes` | PASS |

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

- UI V2 model: 6 tests passed.
- Migration guard and route validator: 6 tests passed; 34 routes validated
  with the documented `/trades/metrics` exception.
- Books services: 11 tests passed.
- Workspace typecheck passed.
- Production build passed and generated 68 application routes.
- Protected-path guard and whitespace validation passed.

The Node test runner continues to emit the existing package module-type
warning. No package metadata change was made for that warning.

## Visual smoke review

The flagged shell was reviewed read-only in an authenticated local session at
desktop and at 375 by 812. The desktop rail, active Home state, gremlin brand,
and mobile bottom navigation rendered correctly. The Ask Cash destination was
clicked and successfully opened `/ai`, where the existing AI Assistant rendered.

The unflagged local application continued to render the existing Sidebar shell.
Authenticated screenshots were intentionally not saved because the available
session contained live financial data.

## Coverage and known gaps

No percentage coverage command exists for this small Node test target, so no
coverage percentage is claimed. A seeded non-production account is still
needed before authenticated reference screenshots can be committed safely.

The repository still has the pre-existing `/trades/metrics` missing deep-link
exception. Phase 2 does not repair or expose it.

## Git evidence

No checkpoint commits were created because the shared working tree already
contained unrelated tracked and untracked changes. This report preserves the
actual RED and GREEN evidence without staging or committing unrelated work.
