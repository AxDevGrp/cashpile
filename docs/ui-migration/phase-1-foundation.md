# UI migration phase 1 foundation

## Scope

The isolated UI V2 foundation lives in `apps/web/src/components/ui-v2`. It does
not replace or alter any production page. `NEXT_PUBLIC_UI_V2` is represented by
the pure `isUiV2Enabled` helper, with explicit accepted values: `1`, `true`,
`yes`, and `on` (case and surrounding whitespace are ignored). It is not wired
into existing routes in this phase.

## Components

- `AppShellV2`, `IconRail`, and `MobileNavigation` provide responsive workspace
  navigation.
- `CashPresence`, `CashPrompt`, and `ContextualCashTrigger` provide the Cash
  entry points. Prompt and trigger callbacks are optional so a future page can
  connect the existing Cash overlay without backend changes.
- `VisualAction`, `PriorityInsight`, `ModuleDock`, `ModuleEntrance`, and
  `WorkspaceHeader` compose the low-density AI-first workspace.
- `LoadingState`, `EmptyState`, `ErrorState`, and `UnauthorizedState` provide
  practical accessible states.

The model exports `matchesNavigationPath` and `selectPriorityInsight` to keep
active navigation and priority selection deterministic.

Static shell, navigation, module, insight, header, and state components remain
server-compatible. Only `CashPrompt`, `CashPresence`, and
`ContextualCashTrigger` are isolated in the client module because they contain
interactive behavior.

## Development preview

With `NODE_ENV=development`, open `/ui-v2-preview`. It renders static,
non-sensitive sample data and does not call APIs. The page calls `notFound()`
outside development.

Reviewed reference captures:

- [`screenshots/phase-1-desktop.jpg`](screenshots/phase-1-desktop.jpg)
- [`screenshots/phase-1-mobile.jpg`](screenshots/phase-1-mobile.jpg)

## Accessibility and responsive behavior

Controls use semantic buttons/links, visible focus treatment through native
focus plus prompt focus styling, labelled navigation, screen-reader prompt
text, and status/alert roles for detailed states. The icon rail changes to a
labelled bottom navigation on narrow screens. The scoped stylesheet honors
`prefers-reduced-motion`.

## Backend statement

Phase 1 makes no backend, API, data-model, authentication, middleware, or
existing-page changes.
