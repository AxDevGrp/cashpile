# Phase 6 TDD evidence

## Source plan and acceptance criteria

Source: [`AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md`](../../AI_FIRST_UI_MIGRATION_IMPLEMENTATION_PLAN.md), Phase 6.

Validated criteria:

1. UI V2 users receive a shared, lower-density frame on the planned write
   workflows.
2. Flag-off users continue to receive the existing presentation.
3. Every workflow exposes a contextual Cash prompt without automatically
   submitting it.
4. Operational components, calls, payloads, mutation order, confirmation
   boundaries, downloads, refresh behavior, and optimistic semantics remain
   unchanged.
5. Existing authentication and Tax access outcomes remain authoritative.

## RED

The executor first added `write-workflow-model.test.ts` and ran:

```sh
pnpm --dir apps/web test:ui-v2
```

Result: failed as intended with `ERR_MODULE_NOT_FOUND` because
`write-workflow-model.ts` did not exist.

## GREEN

The minimum registry, flag decision, shared frame, route wrappers, and
presentation-only embedded-dialog classes were then implemented. The same
command passed 15 tests with 0 failures.

The Phase 6 model tests cover:

- UI V2 versus flag-off selection.
- Exact IDs, routes, risk groups, and contextual Cash prompts for all 20
  registered workflow surfaces.

## Review evidence

Primary review compared the targeted pages with their pre-Phase 6 snapshots.
The route changes are imports, a retained child tree, and a flag-gated outer
frame. Existing client handlers and server actions were not extracted or
rewritten. Plaid and Stripe changes only append a CSS class while UI V2 is
enabled.

The existing Phase 5 Accounts and Entities workspaces were intentionally not
wrapped a second time. The Tax frame is applied only to the detailed workspace,
after its existing access and data-loading decisions.

## Test specification

| Guarantee | Test or command | Result |
|---|---|---|
| Flag-off preserves legacy workflow selection | `write-workflow-model.test.ts` | PASS |
| Twenty workflow definitions retain exact metadata | `write-workflow-model.test.ts` | PASS |
| Protected backend hashes remain unchanged | `pnpm ui-migration:guard:check` | PASS |
| Required routes remain present | `pnpm ui-migration:routes` | PASS |
| Existing Books service behavior remains green | `pnpm --filter @cashpile/web test:books` | PASS |

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

- UI V2 presentation models: 15 tests passed.
- Migration guard and route validator: 6 tests passed; 34 routes validated
  with the documented `/trades/metrics` exception.
- Books services: 11 tests passed.
- Workspace typecheck passed.
- Production build passed and generated 68 application routes.
- Protected-path and whitespace checks passed.

The Node test runner continues to emit the existing package module-type
warning. No package metadata was changed for that warning.

## Visual and interaction smoke review

The flagged workflows were reviewed read-only in an authenticated local
session at the default desktop viewport.

Verified:

- New Account, Category Rules, Transactions, AI Review, Duplicate Review,
  Import, New Trade Account, New Trade, Alerts, Watchlist, and Settings rendered
  the expected Phase 6 marker and one contextual Cash trigger.
- New Account and New Trade retained their existing forms.
- Tax continued to return 404 for the tested unauthorized account.
- New Account and New Trade had no document-level horizontal overflow at the
  tested viewport.
- The New Account contextual Cash trigger opened the existing Cash surface with
  `Help me add an account` prefilled and did not submit a message.

No write, delete, import, export, AI apply, Plaid, Stripe, or provider action was
executed against the authenticated data. Screenshots were not persisted because
the session could expose financial information. A mobile viewport was not
available in this browser-control session, so no Phase 6 mobile screenshot or
runtime mobile-width claim is made; the scoped 760-pixel layout rule was
reviewed in source and the production build passed.

## Coverage and Git evidence

No percentage coverage command exists for the Node UI model target, so no
coverage percentage is claimed. No checkpoint commits were created because the
shared working tree already contained unrelated tracked and untracked changes.
Nothing was staged or committed.
