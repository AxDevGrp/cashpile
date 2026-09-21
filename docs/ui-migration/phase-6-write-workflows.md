# UI migration phase 6 write workflows

## Scope

Phase 6 adds the UI V2 write-workflow presentation to the planned standard
CRUD, financial, bulk, provider, and payment surfaces. It remains gated by
`NEXT_PUBLIC_UI_V2`; flag-off users continue to receive the existing
presentation.

The registry documents 20 workflow surfaces:

### Group A: Standard CRUD

- Accounts and New Account.
- Entities and New Entity.
- Category Rules.
- Trade Accounts and New Trade Account.
- Trade Journal and New Trade.
- Pulse Alerts.
- Pulse Watchlist.
- Settings.

Accounts and Entities already use the Phase 5 read-workspace presentation.
Phase 6 records them in the write-workflow registry without adding a second
outer shell. The remaining Group A routes receive the shared Phase 6 frame.

### Group B: Financial and bulk operations

- Transactions and account-scoped Transactions.
- AI Transaction Review.
- Duplicate Review.
- Transaction Import.
- Tax details, including assignments, exports, and workbook templates.
- Embedded Plaid connection and reconnection.
- Embedded Stripe AI-credit top-up.

## Presentation structure

The route workflows share a quiet guide bar above their existing content:

1. A reminder to review changes before saving.
2. A workflow-specific "Ask Cash" trigger.
3. The original form, table, controls, confirmations, and results below it.

The shared frame adds scoped focus styling, responsive spacing, reduced-motion
handling, and a constrained content width. It does not replace a route's
existing heading or operational controls. Plaid and Stripe retain their
existing dialogs and receive only a flag-gated presentation class.

## Preserved behavior

Phase 6 did not reimplement handlers or operational components. Existing field
names, defaults, validation, payloads, action arguments, mutation order,
refresh behavior, confirmations, downloads, error interpretation, and
optimistic-update semantics remain in place.

In particular:

- Account creation keeps the existing create, assignment, and navigation
  sequence.
- Category Rules keeps its seed-before-read order and create, toggle, and
  delete behavior.
- Trade Account and Journal workflows keep their existing defaults, payloads,
  filters, and service calls.
- Alerts and Watchlist keep their existing URL, transition, add, remove, and
  toggle behavior.
- Transactions keeps its existing query, patch, bulk categorization, delete,
  rollback, and backfill behavior.
- AI Review keeps its per-suggestion and sequential bulk behavior.
- Duplicate Review keeps its destructive confirmations and chunk order.
- Import keeps its preview-then-execute sequence and defaults.
- Tax keeps its server-authoritative access decision, render-time backfill,
  assignments, exports, and workbook-template flows.
- Plaid keeps its token, local state, callbacks, effects, and provider-call
  order.
- Stripe top-up keeps the existing amounts and redirect behavior.

## Access and rollback

The existing Tax unauthorized response remains a 404. No access rule moved to
the client, and Settings user metadata remains display-only.

Disable `NEXT_PUBLIC_UI_V2` and rebuild or restart the web application to
restore the legacy presentation. The operational components remain the same in
both presentations.

## Backend statement

Phase 6 changes only presentation files and adds a tested workflow registry.
It does not change protected API, action, service, database, middleware,
authentication, authorization, query, mutation, provider, payment, or AI
implementations. The protected-path guard passed after implementation.
