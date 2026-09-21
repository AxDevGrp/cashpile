# Phase 7 TDD evidence

## Source plan and journeys

Source: [`AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md`](../../AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md), Phase 7.

Validated journeys:

1. A UI V2 user can reach login and signup in a clear Cash-led presentation
   without changing either Supabase request or success destination.
2. A returning Plaid OAuth user sees a clear resume state without changing any
   provider call, local state, cleanup, or redirect behavior.
3. Loading, error, empty, and unavailable states are understandable to visual
   and screen-reader users while retaining their original decisions and retry
   actions.
4. Keyboard users can bypass repeated navigation and operate the contextual
   Cash dialog without losing their place.
5. Credit exhaustion is announced without changing the existing 402
   interpretation or top-up flow.
6. Reduced-motion, reduced-transparency, and mobile-navigation fallbacks are
   present without changing navigation routes or access rules.

## RED

The executor first added `phase-7-model.test.ts` and ran:

```sh
pnpm --dir apps/web test:ui-v2
```

Result: failed as intended with `ERR_MODULE_NOT_FOUND` because
`phase-7-model.ts` did not exist.

## GREEN

The minimum typed registry and flag decision were implemented, followed by the
shared public and edge surfaces. Primary review strengthened the test from a
nonempty-title check to exact deep equality for every ID, kind, title, and
detail.

The same command passed 17 tests with 0 failures. The two Phase 7 tests cover:

- UI V2 versus flag-off surface selection.
- Exact metadata for login, signup, Plaid OAuth, unavailable, seven loading,
  and five error surfaces.

## Test specification

| Guarantee | Test or command | Result |
|---|---|---|
| Flag-off preserves legacy surface selection | `phase-7-model.test.ts` | PASS |
| Sixteen Phase 7 definitions retain exact metadata | `phase-7-model.test.ts` | PASS |
| Protected backend hashes remain unchanged | `pnpm ui-migration:guard:check` | PASS |
| Required routes remain present | `pnpm ui-migration:routes` | PASS |
| Existing Books service behavior remains green | `pnpm --filter @cashpile/web test:books` | PASS |
| Unknown routes retain HTTP 404 | `curl` against the local unknown route | PASS, 404 |

## Full validation

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

- UI V2 presentation models: 17 tests passed.
- Migration guard and route validator: 6 tests passed; 34 routes validated
  with the documented `/trades/metrics` exception.
- Books services: 11 tests passed.
- Workspace typecheck passed.
- Production build passed and generated 68 application routes.
- Protected-path and whitespace checks passed.

The Node test runner continues to emit the existing package module-type
warning. No package metadata was changed for that warning.

## Browser and interaction review

Read-only checks were run against an authenticated local UI V2 session and the
public auth surfaces.

Verified:

- Login rendered one Phase 7 marker, one heading, one form, exact email and
  current-password autocomplete values, and no document-level overflow.
- Signup rendered one marker, one heading, one form, all three required fields,
  the same six-character password minimum, and no document-level overflow.
- Plaid OAuth without a resumable local session rendered one heading, one live
  status, one alert, and a disabled Resume Plaid button. No provider flow ran.
- An unknown route rendered the Phase 7 unavailable surface and returned HTTP
  404.
- The authenticated app exposed the skip link, `main-content` target, and the
  unchanged five visible mobile-navigation labels.
- Contextual Cash opened with one labelled modal dialog, focussed the labelled
  input, kept a Tab action within the dialog, closed without submitting, and
  restored focus to its Ask Cash trigger.
- The reviewed desktop routes had no document-level horizontal overflow.

No login, signup, AI message, financial mutation, Plaid connection, Stripe
top-up, import, export, or download was executed. Screenshots containing
authenticated financial data were not persisted.

The browser-control surface did not expose viewport resizing, so no runtime
mobile screenshot is claimed. Mobile support was reviewed through the explicit
320-pixel CSS fallback, flexible five-item navigation, safe-area calculations,
`100dvh` public surfaces, typecheck, and production build. A real-device or
resizable-browser pass remains a rollout check before the Phase 8 cohort
expands.

## Coverage and Git evidence

No percentage coverage command exists for the Node UI model target, so no
coverage percentage is claimed. No checkpoint commits were created because the
shared working tree already contained unrelated tracked and untracked changes.
Nothing was staged or committed.
