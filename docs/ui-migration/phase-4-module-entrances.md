# UI migration phase 4 module entrances

## Scope

Phase 4 replaces directory-style module landing pages with sparse,
task-oriented entrances when `NEXT_PUBLIC_UI_V2` is enabled. The affected
entrances are Cash Flow, Subscriptions, Books, Tax, Trades, and Pulse.
Subscriptions remains part of Cash Flow technically and is presented at
`/cashflow/recurring` as a distinct user-facing capability.

The existing detailed presentations remain unchanged and available through
`?view=details`. Disabling UI V2 also restores the existing presentations.

## Entrance structure

Every entrance uses the same presentation hierarchy:

1. Module name and a one-line purpose.
2. A contextual "Ask Cash" button.
3. Four icon-led primary tasks with short labels and no descriptive copy.
4. At most one current observation based on data the page already acquired.
5. A subtle link to the existing detailed workspace.

The exact primary destinations are held in a tested presentation model. No new
workflow routes or backend operations were created. The documented missing
`/trades/metrics` route is not exposed.

## Preserved behavior

- Each page performs its existing authentication, entitlement, data loading,
  calculations, and plan checks before selecting a presentation.
- Tax still resolves access server-side and returns the existing 404 for an
  unauthorized user before the UI V2 entrance can render.
- Pulse retains its existing plan and upgrade-state data for the detailed view.
- Existing empty and unavailable data maps to restrained entrance observations
  rather than fabricated values.
- Flag-off users and `?view=details` users receive the existing detailed page.
- Contextual Cash opens the existing global Cash overlay with a module-specific
  prompt. Opening it does not submit a request or consume AI credits.

## Detailed fallbacks

| Entrance | Detailed presentation |
|---|---|
| Cash Flow | `/cashflow?view=details` |
| Subscriptions | `/cashflow/recurring?view=details` |
| Books | `/books?view=details` |
| Tax | `/books/tax?view=details` |
| Trades | `/trades?view=details` |
| Pulse | `/pulse?view=details` |

## Responsive and accessibility behavior

The shared entrance uses semantic headings and labelled regions, visible focus
treatment, reduced-motion behavior, and a responsive action grid. Four actions
render in one row at desktop width and in a two-by-two grid on mobile. A 375 by
812 review confirmed no horizontal overflow.

## Rollback

Disable `NEXT_PUBLIC_UI_V2` and rebuild/restart the web application, or add
`?view=details` to an affected entrance URL. Both paths preserve the existing
detailed presentation.

## Backend statement

Phase 4 adds presentation-only shared components and a tested entrance model,
then adds conditional presentation branches to existing pages. No protected
API, database, middleware, authentication, AI package, query, mutation,
financial calculation, or entitlement behavior was changed. The protected-path
guard passed after implementation.
