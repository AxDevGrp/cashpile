# UI migration phase 7 authentication, edge states, and accessibility

## Scope

Phase 7 adds the UI V2 presentation and accessibility layer to:

- Login and signup.
- Plaid OAuth resume.
- Seven route loading boundaries.
- Five route error boundaries.
- The application not-found and unavailable-module presentation.
- Shared empty-state semantics.
- AI credit exhaustion and credit-balance semantics.
- Desktop skip navigation and mobile navigation.
- The contextual Cash dialog's keyboard and screen-reader behavior.
- Reduced-motion and reduced-transparency preferences.

The replacement presentation remains gated by `NEXT_PUBLIC_UI_V2`. Existing
authentication, authorization, OAuth, API, and financial behavior remains in
the original operational components.

## Authentication presentation

Login and signup now use Cash, represented by the existing gremlin, as the
single calm guide when UI V2 is enabled. Each page has one heading, one form,
clear labels, visible focus, responsive spacing, autocomplete metadata, busy
state semantics, and associated error messages.

The following behavior is unchanged:

- Login still calls `signInWithPassword` with the same email and password.
- Successful login still navigates to `/cashboard?gremmy=welcome` and refreshes.
- Signup still sends `display_name` and the same auth callback URL.
- Signup still uses the same required fields, six-character minimum, error
  handling, and confirmation state.
- Login still retains its existing `next` query behavior. Phase 7 does not add,
  remove, or reinterpret it.
- Field order and link destinations remain unchanged.

## Plaid OAuth resume

The Plaid resume page receives the same public UI V2 surface and semantic live
status and error regions. Its local-storage keys, token handling, import
options, hook configuration, callback order, fetch sequence, request payloads,
cleanup order, messages, retry button, and `/books/accounts` destination remain
unchanged.

## Loading, error, empty, and unavailable states

UI V2 uses a shared, low-density gremlin surface for seven loading boundaries
and five error boundaries. Flag-off routes retain the original `PageSkeleton`
card counts and original error presentation.

Error boundaries still display the existing `error.message` and pass the same
`reset` callback to the same Try Again action. The special Next.js not-found
boundary provides the unavailable-module presentation while preserving an
actual HTTP 404 response. Tax access continues to use the existing
server-authoritative 404 decision.

Visual skeletons are hidden from assistive technology while their wrapper
announces that the page is loading. The shared empty-state component now uses a
polite status region. Existing route-specific empty-state records, decisions,
copy, and actions from Phases 5 and 6 remain unchanged.

## Keyboard and screen-reader behavior

- UI V2 provides a first-focusable skip link to a stable, focusable main-content
  target.
- Desktop and mobile navigation retain the same routes, labels, ordering,
  filtering, and active-route behavior.
- Mobile navigation includes safe-area spacing and five flexible destinations
  designed to fit at 320 pixels without hiding labels.
- Decorative navigation icons are hidden from assistive technology.
- The Cash surface exposes dialog, modal, title, input, close, credit, status,
  busy, and error semantics.
- The Cash dialog contains Tab navigation, supports Escape as before, and
  restores focus to the trigger when closed.
- AI credit balance exposes progressbar semantics. Exhausted and low-credit
  states use status or alert semantics and improved UI V2 contrast.

## Motion and responsive behavior

The Phase 7 public and edge surfaces use `100dvh`, a 320-pixel fallback, and
reduced-motion rules for transitions, loading motion, and scroll behavior.
Reduced-transparency preferences receive solid public, rail, and mobile-nav
backgrounds. The Cash dialog uses dynamic viewport height in UI V2.

## Rollback

Disable `NEXT_PUBLIC_UI_V2` and rebuild or restart the web application. Login,
signup, Plaid resume, loading boundaries, error boundaries, navigation, and the
Cash surface continue to use their legacy presentation or semantics while the
same operational handlers remain in place.

## Backend statement

Phase 7 changes presentation, accessibility attributes, focus management, and
a tested presentation registry. It does not change the auth callback,
middleware, authentication cookies, authorization rules, API routes, status
codes, Supabase calls, Plaid exchange logic, Stripe behavior, server actions,
database code, or AI request behavior. The protected-path guard passed after
implementation.
