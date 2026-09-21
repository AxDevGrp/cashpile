# UI migration phase 2 global shell

## Scope

Phase 2 integrates the UI V2 shell around the existing authenticated pages. It
does not redesign or replace any page workspace. The migration is controlled by
`NEXT_PUBLIC_UI_V2`; the legacy Sidebar shell remains the default and immediate
fallback when the flag is not explicitly enabled.

## Navigation

The desktop icon rail uses existing protected routes only:

- Home: `/cashboard`
- Ask Cash: `/ai`
- Activity: `/cashflow`
- Books: `/books`
- Tax: `/books/tax`, shown only when `/api/features` grants access
- Settings: `/settings`
- Notifications: `/pulse/alerts`

The compact mobile navigation exposes Home, Ask Cash, Activity, Books, and
Settings. Tax remains reachable through Books but is not placed in the compact
mobile bar. Route matching selects the most-specific destination, so a Tax page
does not mark both Books and Tax active.

The rail brand uses the existing Cash gremlin asset and links to Cashboard. No
new route, entitlement, API, or access rule was introduced.

## Preserved behavior

- Existing page children render unchanged inside a full-width, full-height
  workspace main area.
- `CashOverlayProvider`, its keyboard shortcut, and the existing AI APIs are
  unchanged.
- Tax visibility continues to come from the existing `/api/features` request.
- The legacy pin state and mobile drawer remain unchanged in the fallback.
- `Toaster` remains available in both shells.
- Agent surface, module, capabilities, and discovery attributes remain on the
  main application surface.
- Existing authentication, middleware, deep links, and route-level access
  controls continue to decide whether a destination is reachable.

## Responsive and accessibility behavior

Desktop uses a 76-pixel icon rail without reducing the available workspace
width. At 760 pixels and below, the rail becomes a five-item labelled bottom
navigation. The shell uses `100dvh`, retains page scrolling, provides visible
focus styles, and honors reduced-motion preferences.

The Phase 1 preview remains compatible: navigation items without an explicit
mobile setting are still shown on mobile unless they are explicitly hidden.

## Rollback

Unset `NEXT_PUBLIC_UI_V2` or set it to a false value and rebuild/restart the web
application. The existing Sidebar shell will render without reverting code.

## Backend statement

Phase 2 changes frontend shell, UI model, tests, and scoped CSS only. The
protected-path content guard passed after implementation. No backend, API,
database, authentication, middleware, AI package, or data-model code was
changed by this phase.
