# UI migration phase 3 AI-first Home

## Scope

Phase 3 adds a sparse AI-first Home presentation to `/cashboard` when
`NEXT_PUBLIC_UI_V2` is enabled. It does not replace the existing Cashboard data
preparation or backend behavior. The current detailed dashboard remains the
flag-off fallback and is also available at `/cashboard?view=details` while UI V2
is enabled.

## Home structure

The new Home contains only these primary layers:

1. Cash, represented by the existing gremlin, with the central "What are we
   doing today?" prompt.
2. Four icon-led actions: affordability, subscriptions, Tax or Books depending
   on access, and the module dock shortcut.
3. One prioritized insight mapped from the existing top Gremmy reminder.
4. A compact module dock for Flow, Books, conditional Tax, Trades, and Pulse.
5. A subtle link to the detailed dashboard.

Action tiles deliberately omit secondary descriptions to retain the approved
low-density direction rather than recreating a text-heavy dashboard.

## Preserved behavior

- Authentication and user lookup are unchanged.
- Existing cash-flow, briefing, Books, subscription, income, leak, budget,
  savings, recent-transaction, and reminder calculations still run unchanged.
- The existing top-ranked Gremmy reminder determines the single Home insight.
- `?gremmy=welcome` still opens the existing reminder modal with the same
  reminders and dismissal behavior.
- The central prompt calls the existing `CashOverlayProvider` through a small
  client bridge. It does not duplicate chat logic or introduce a new endpoint.
- Tax visibility uses the existing `canUseTaxModule` helper and never exposes
  the Tax route to a user without access.
- The legacy `CashInputStrip`, affordability form, detailed metrics, trends,
  transactions, and question cards remain unchanged in the detailed view.

## Progressive disclosure and reachability

The Home shows only the highest-priority signal. Existing dashboard information
is one interaction away through "View dashboard details." Module workspaces and
primary workflows are also directly reachable through the four actions and
module dock.

## Responsive and accessibility behavior

The Home uses a scoped CSS module, a visually hidden page-level heading, semantic
regions and navigation, visible focus treatment, and reduced-motion behavior.
The four actions collapse from four columns to a two-by-two grid on mobile. A
375 by 812 review confirmed no horizontal overflow.

## Rollback

Either disable `NEXT_PUBLIC_UI_V2` and rebuild/restart the web application, or
open `/cashboard?view=details`. Both paths render the unchanged detailed
Cashboard presentation.

## Backend statement

Phase 3 changes the Cashboard presentation branch, adds UI-only presentation and
model files, and adds tests and documentation. No API, database, middleware,
authentication, AI package, financial calculation, or protected backend file
was changed. The protected-path guard passed after implementation.
