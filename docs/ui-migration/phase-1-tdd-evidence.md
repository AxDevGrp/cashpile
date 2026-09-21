# Phase 1 TDD evidence

## RED

Command run before `src/components/ui-v2/model.ts` existed:

```sh
pnpm --dir apps/web test:ui-v2
```

Result: failed as intended with `ERR_MODULE_NOT_FOUND` for
`src/components/ui-v2/model.ts` imported by `model.test.ts`.

## GREEN

After implementing the pure UI V2 model helpers:

```sh
pnpm --dir apps/web test:ui-v2
```

Result: passed — 3 tests, 0 failures. Coverage includes explicit feature-flag
truthy/falsey handling, exact and nested navigation matching, and stable
priority-insight selection for equal severities.

## Additional validation

```sh
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Result: both passed. The test command emits Node's existing
`MODULE_TYPELESS_PACKAGE_JSON` warning because the web package does not declare
`"type": "module"`; no package metadata change was made for this warning.

`pnpm --dir apps/web lint` was also attempted. It remains blocked by Next.js's
interactive ESLint setup prompt, so no lint configuration was added in this
bounded phase.

## Supervising-agent review

The primary agent independently reviewed and exercised the development preview.
The first runtime review exposed a server/client serialization error caused by
passing icon component functions into an all-client shell. The implementation
was corrected by keeping static foundation components server-compatible and
isolating only the interactive Cash components in `interactive.tsx`.

The review also corrected preview links from the nonexistent `/transactions`
path to existing Cashpile routes and promoted the existing gremlin from a small
status avatar to the primary Cash presence.

After correction:

- `/ui-v2-preview` returned 200 in development.
- Desktop visual verification passed at 1440 by 1000.
- Mobile visual verification passed at 375 by 812.
- All preview links target existing Cashpile routes.
- `pnpm --dir apps/web test:ui-v2` passed 3 of 3 tests.
- `pnpm typecheck` passed.
- `pnpm ui-migration:guard:check` passed.
