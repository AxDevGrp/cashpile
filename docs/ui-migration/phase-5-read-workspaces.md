# UI migration phase 5 read-heavy workspaces

## Scope

Phase 5 adds the UI V2 workspace presentation to these read-heavy surfaces:

- Books reports.
- Cash Flow recurring details.
- Trades performance.
- Pulse events.
- Pulse correlations.
- Books account and Tax Entity lists.

The new presentation is enabled only by `NEXT_PUBLIC_UI_V2`. Flag-off users
continue to receive the existing presentation.

## Workspace structure

The migrated workspaces share:

1. One purpose-led workspace heading.
2. A contextual "Ask Cash" trigger that prefills the existing Cash overlay.
3. A restrained filter or controls surface where filters already exist.
4. Responsive, readable metrics, tables, event cards, lists, and empty states.
5. Existing secondary actions in the same workspace context.

Cash is available as a guide without replacing precise filters, tables, or
financial controls.

## Preserved behavior

- Reports retains the existing default entity and year, five-year selector,
  annual date range, independent report error handling, row order, property
  order, expense order, values, and displayed expense sum.
- Recurring details retains authentication, the existing detection call and
  fallback, item order, values, signs, dates, confidence, and review-only note.
- Performance retains the account default, date parameters, on-blur behavior,
  service calls, service-provided ordering, calculations, thresholds, and
  formatting.
- Events retains the fixed 50-record request, filters and their change/blur
  semantics, event order, relative-time display, and the existing Predict
  action and pending state.
- Correlations retains the selected/default instrument rules, lookback clamp,
  instrument and category order, URL behavior, fallback cells, scores, colors,
  tooltips, and explanation.
- Accounts retains all Plaid sync and backfill behavior, create, merge, rename,
  assignment, confirmation, payload, state, modal, and reload behavior. Phase 5
  changes only its outer workspace and list presentation; deeper workflow work
  remains in Phase 6.
- Tax Entities retains the server-authoritative 404 access gate, entity order,
  category counts, and exact destination links.

React keys on recurring rows include their source position so duplicate source
identifiers cannot cause React to omit a displayed row. This does not change the
items, their order, or their values.

## Empty and access states

Reports, recurring items, performance, events, correlations, accounts, and
entities retain their existing empty-state decisions and copy within the new
workspace frame. Reports now keeps its no-entity creation link inside the V2
workspace. The available browser account was not entitled to Tax Entities, and
the existing 404 remained intact.

## Responsive and accessibility behavior

The shared workspace uses scoped focus styling, reduced-motion handling,
wrapping header actions, responsive filter controls, and existing horizontal
table containers. Reviews at the default desktop viewport and 375 by 812
confirmed no document-level horizontal overflow.

## Rollback

Disable `NEXT_PUBLIC_UI_V2` and rebuild or restart the web application. The
original workspace headings, layout, filters, lists, tables, and actions remain
the flag-off presentation.

## Backend statement

Phase 5 changes presentation components and adds a tested presentation registry.
No protected API, database, middleware, authentication, action, service, query,
calculation, sorting, filtering, pagination, access, or mutation implementation
was changed. The protected-path guard passed after implementation.
