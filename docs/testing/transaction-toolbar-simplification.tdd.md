# Transaction Toolbar Simplification — TDD Evidence

## Source

The user journey and acceptance criteria were derived in this task; no separate
plan file was supplied.

## User journey

As a Cashpile user cleaning up transactions, I want one clear starting action
and progressively disclosed maintenance tools so that I do not need to
understand Cashpile's rules, AI, duplicate, or Plaid implementation details.

## RED → GREEN evidence

| Guarantee | RED evidence | GREEN evidence |
| --- | --- | --- |
| Cleanup modes are grouped behind **Clean up transactions**, maintenance actions are grouped under **More**, and Plaid backfill is absent from this page. | `node --test scripts/ui-migration/test/transactions-toolbar.test.js` failed against the original toolbar. | The same command passed 2/2 focused tests after implementation. |
| The cleanup explanation accurately distinguishes high-confidence matches from uncertain suggestions. | The focused test failed after adding the expected high-confidence/review copy. | The same focused test passed after correcting the menu explanation. |
| Review navigation is contextual rather than always visible. | Covered by the original focused RED test. | The focused test verifies the main AI-review link is guarded by a positive suggestion count. |
| Cleanup shows a truthful, accessible in-progress state without inventing a percentage. | The focused test failed after adding the required status, busy, and indeterminate progress semantics. | The same focused test passed after adding the mode-specific progress panel. |

## Additional validation

- `pnpm --dir apps/web test:ui-v2` — passed 17/17.
- `pnpm --dir apps/web typecheck` — passed.
- `npm run ui-migration:test` — passed 9/9 and validated 34 routes with one documented exception.
- `node scripts/ui-migration/protected-path-guard.js check` — passed.
- Live local browser verification confirmed both menus, their options, the
  explanatory copy, and removal of the old top-level controls.

No backend file or API behavior was changed.
