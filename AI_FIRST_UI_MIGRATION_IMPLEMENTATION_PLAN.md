# Cashpile AI-First UI Migration Implementation Plan

**Status:** Phases 0 through 7 implemented; Phase 8 is next  
**Last updated:** August 2, 2026  
**Scope:** Frontend-only UI migration  
**Backend policy:** No backend functional changes permitted

## 1. Purpose

Migrate Cashpile from its current dashboard and menu-oriented interface to a simpler AI-first experience while preserving all existing backend behavior.

The target experience uses:

- Cash, represented by the existing Cashpile gremlin, as the primary AI presence.
- A simple AI request input as the main starting point.
- A small number of visual, outcome-oriented shortcuts.
- One prioritized observation instead of a dashboard full of alerts.
- Secondary module navigation for Cash Flow, Books, Tax, Trades, and Pulse.
- Focused task workspaces for detailed financial operations.

This project is a presentation-layer migration. It is not a backend refactor, data-model change, or product-capability rewrite.

## 2. Design direction

Cashpile should be treated as a trust-sensitive fintech product with:

- Low-density entry screens.
- Purpose-built density inside working screens.
- Progressive disclosure instead of feature-heavy menus.
- The gremlin as the visible embodiment of Cash.
- AI available throughout the application without forcing every action into chat.

The interaction hierarchy is:

1. Ask Cash.
2. Select a common task.
3. Respond to one relevant observation.
4. Enter a module for deeper work.
5. Use conventional financial controls when precision is required.

## 3. Objectives

The migration must:

- Replace the current navigation and dashboard presentation with the AI-first structure.
- Retain all current backend functionality.
- Preserve all existing routes and deep links.
- Keep authentication and entitlements server-authoritative.
- Preserve existing API and server-action contracts.
- Keep Plaid, Stripe, AI credits, tax, imports, exports, and agent capabilities functioning identically.
- Maintain detailed controls on data-heavy screens.
- Support desktop, tablet, mobile, keyboard, and screen-reader usage.
- Provide a safe rollback path throughout implementation.

## 4. Non-goals

The migration will not:

- Change the database schema.
- Add or edit database migrations.
- Change Supabase RLS policies.
- Refactor backend services.
- Modify API request or response contracts.
- Change server-action signatures.
- Add new AI tools or agent capabilities.
- Change Stripe billing logic or credit calculations.
- Change Plaid synchronization behavior.
- Change Tax or Pulse entitlement rules.
- Rename or restructure existing route URLs.
- Change pricing, plans, or module ownership.
- Rewrite business calculations.
- Fix unrelated defects without separate approval.

## 5. Protected backend boundary

The following paths are backend-owned and must not be changed during the UI migration:

```text
apps/web/src/app/api/**
apps/web/src/modules/**
apps/web/src/lib/plaid*
apps/web/src/lib/tax-access.ts
apps/web/src/middleware.ts
packages/ai/**
packages/db/**
```

Also protected:

- Database migrations and database functions.
- Supabase authentication and cookie behavior.
- Stripe webhooks.
- Plaid link-token, exchange, sync, backfill, and webhook behavior.
- AI capability names, tool schemas, and confirmations.
- Credit deduction and top-up rules.
- Entitlement and feature-access calculations.
- API methods, payloads, status codes, and errors.
- Server-action inputs, outputs, and side effects.
- OAuth and authentication redirect destinations.

### 5.1 CI protection

Before UI implementation begins, add a migration-specific CI check that fails when a pull request changes any protected backend path.

Any required backend change discovered during migration must:

1. Stop the affected migration work.
2. Be documented separately.
3. Receive explicit approval.
4. Be implemented outside this frontend migration scope.

## 6. Mixed frontend and server page files

Some Next.js pages contain both data acquisition and rendered UI. Important examples include:

```text
apps/web/src/app/(app)/cashboard/page.tsx
apps/web/src/app/(app)/cashflow/page.tsx
apps/web/src/app/(app)/books/page.tsx
apps/web/src/app/(app)/books/reports/page.tsx
apps/web/src/app/(app)/books/tax/page.tsx
apps/web/src/app/(app)/trades/performance/page.tsx
apps/web/src/app/(app)/pulse/page.tsx
```

These page files may require presentation-level changes, but their authentication, queries, action calls, error handling, and calculations must remain functionally unchanged.

The required pattern is:

```text
Existing page
├── Existing authentication
├── Existing queries and actions
├── Existing calculations
└── New presentation component receiving existing results
```

Do not move, rewrite, consolidate, optimize, or otherwise improve backend-related code while migrating the presentation.

## 7. Target information architecture

### 7.1 Level 1: Home

The Home experience contains:

- The Cashpile gremlin as Cash.
- One primary natural-language input.
- Four visual shortcuts.
- One prioritized observation.
- A secondary module dock.

Suggested initial shortcuts:

| Shortcut | Existing destination |
|---|---|
| Afford it? | `/cashflow` |
| Subscriptions | `/cashflow/recurring` |
| Tax ready | `/books/tax`, only when authorized |
| More | Detailed overview or all available functions |

### 7.2 Level 2: Module entrances

Each module opens with a small number of clear tasks instead of every submenu.

#### Books

- Clean up transactions.
- Import activity.
- Organize accounts.
- Run a report.

#### Cash Flow

- Can I afford this?
- Review subscriptions.
- See what is coming.
- Review assumptions.

#### Tax Ready

- Review readiness.
- Assign transactions.
- Manage entities.
- Export a package.

#### Trades

- Add an account.
- Log a trade.
- Review performance.
- Check drawdown.

#### Pulse

- See important events.
- Review alerts.
- Manage a watchlist.
- Explore correlations.

### 7.3 Level 3: Task workspaces

Detailed workspaces retain appropriate financial controls, including:

- Tables.
- Filters.
- Forms.
- Wizards.
- Reports.
- Charts.
- Pagination.
- Bulk actions.
- Confirmations.

These screens should be visually cleaner, but they must not be made artificially sparse at the expense of efficiency or precision.

### 7.4 Level 4: Contextual Cash

Cash remains available throughout the application to:

- Explain the current screen.
- Navigate to existing functionality.
- Open supported workflows.
- Prepare actions supported by current tools.
- Execute existing tools using current confirmation requirements.

No new AI backend capability is part of this migration. The redesigned UI may only expose functionality already supported by the current backend.

## 8. Migration phases

## Phase 0: Establish the functional baseline

**Implementation status:** Complete (2026-07-31)

### Purpose

Create evidence that backend and user-visible behavior remain identical throughout the migration.

### Work

1. Inventory all current routes and deep links.
2. Record UI-to-API request methods, payloads, responses, and errors.
3. Record all server actions directly invoked by UI components.
4. Capture current desktop and mobile screenshots.
5. Add frontend route and interaction smoke tests.
6. Add the protected-path CI guard.
7. Run and record the current test, typecheck, and build baseline.
8. Record current authentication and entitlement behavior.
9. Record loading, empty, error, unauthorized, and credit-exhausted states.

### Required baseline cases

- Logged-out application routes redirect to login.
- Authentication callback returns to `/cashboard?gremmy=welcome`.
- Tax-disabled users cannot access Tax pages or Tax APIs.
- Pulse limits remain dependent on the user's current plan.
- AI credit exhaustion retains the existing HTTP 402 behavior.
- Agent confirmations retain the existing HTTP 409 behavior.
- Agent rate limiting retains the existing HTTP 429 behavior.
- Plaid creation, update, OAuth resume, exchange, sync, and backfill work.
- Stripe top-ups remain webhook-authoritative.

### Exit gate

No UI migration begins until the critical workflows have a documented baseline and the protected-path guard is active.

## Phase 1: Build an isolated UI foundation

**Implementation status:** Complete (2026-07-31)

### Purpose

Create the new visual and interaction language without changing existing screens.

### Frontend components

Add new components alongside existing components rather than globally rewriting current primitives:

- `AppShellV2`
- `IconRail`
- `MobileNavigation`
- `CashPresence`
- `CashPrompt`
- `VisualAction`
- `PriorityInsight`
- `ModuleDock`
- `ModuleEntrance`
- `WorkspaceHeader`
- `ContextualCashTrigger`
- V2 loading, empty, error, and unauthorized states

### Styling approach

- Introduce scoped V2 design tokens.
- Avoid broad changes to existing global classes.
- Preserve the current Cashpile brand palette.
- Use the existing gremlin character asset.
- Use one consistent icon family.
- Establish consistent spacing, radius, focus, and motion rules.
- Support reduced motion.
- Validate WCAG contrast.

### UI feature flag

Place the new presentation behind a frontend-only UI flag.

Do not modify or repurpose `/api/features`. It remains the source for existing server-authoritative feature access such as Tax visibility.

### Exit gate

All V2 components render correctly in isolation at desktop, tablet, and mobile widths without changing existing route behavior.

## Phase 2: Migrate the global shell

**Implementation status:** Complete (2026-07-31)

### Purpose

Simplify navigation before redesigning individual workflows.

### Primary scope

```text
apps/web/src/app/(app)/layout.tsx
packages/ui/src/components/layout/**
```

### Target shell

- Slim icon rail on desktop.
- Compact mobile navigation.
- Home.
- Ask Cash.
- Activity.
- Modules.
- Settings.
- Notifications and user controls.

### Behavior to preserve

- `CashOverlayProvider`.
- Existing mobile navigation behavior.
- Tax visibility from `/api/features`.
- Existing agent-discovery attributes.
- Existing protected routes.
- Existing route URLs.
- Entitlement-driven module access.

A module must not become accessible merely because a visual icon is present.

### Exit gate

Every currently reachable page remains reachable, and every currently restricted page remains restricted.

## Phase 3: Replace Cashboard with AI-first Home

**Implementation status:** Complete (2026-08-01)

### Purpose

Deliver the central AI-first experience while preserving existing dashboard capabilities.

The current Cashboard page is a high-risk surface because it combines substantial data preparation and presentation in one file.

### Safe implementation approach

1. Leave authentication, queries, AI calls, and calculations unchanged.
2. Pass already-computed values into a new pure Home presentation component.
3. Replace only the rendered dashboard presentation.
4. Keep the legacy detailed overview available behind **More** during transition.

### Cash behavior

The primary input continues using the existing:

- `CashOverlayProvider`.
- `useCashOverlay` behavior.
- `/api/ai/chat` endpoint.
- AI credit handling.
- Tool-call indicators.
- Top-up experience.

### Gremlin behavior

- The existing gremlin is the embodiment of Cash.
- Existing `?gremmy=welcome` behavior remains supported.
- Existing reminder calculations remain unchanged.
- Only character placement and presentation change.

### Existing information that must remain reachable

- Safe-to-spend amount.
- Upcoming bills.
- Subscription totals.
- Spending trends.
- Recent transactions.
- Money-leak signals.
- Budget signals.
- Savings progress.
- AI money moves.
- Affordability check.

### Exit gate

The Home screen is understandable in seconds, while every previous dashboard capability remains available within two interactions.

## Phase 4: Migrate module entrances

**Implementation status:** Complete (2026-08-02)

### Purpose

Replace directory-style landing pages with task-oriented entrances.

### Pages

```text
/cashboard
/cashflow
/cashflow/recurring
/books
/books/tax
/trades
/pulse
```

### Rules

- Limit each entrance to approximately four primary tasks.
- Surface no more than one primary current observation.
- Preserve all existing data acquisition.
- Link to existing routes rather than creating new backend workflows.
- Preserve entitlement decisions.
- Preserve empty, unavailable, and upgrade states.
- Keep Cash accessible but secondary to the active task.

### Exit gate

Every existing module destination remains reachable from its new entrance.

## Phase 5: Migrate read-heavy workspaces

**Implementation status:** Complete (2026-08-02)

### Suggested order

1. Books reports.
2. Cash Flow recurring items.
3. Trades performance.
4. Pulse events.
5. Pulse correlations.
6. Account and entity lists.

### Permitted changes

- Layout.
- Typography.
- Spacing.
- Information hierarchy.
- Responsive behavior.
- Loading skeletons.
- Empty states.
- Contextual access to Cash.

### Prohibited changes

- Query behavior.
- Calculations.
- Sorting defaults.
- Filtering semantics.
- Report values.
- Pagination behavior.
- Access rules.

### Exit gate

The same records, totals, ordering, filters, and report values appear before and after redesign.

## Phase 6: Migrate write and high-risk workflows

**Implementation status:** Complete (2026-08-02)

### Group A: Standard CRUD

- Accounts.
- Entities.
- Category rules.
- Trade accounts.
- Trade journal.
- Pulse alerts.
- Pulse watchlist.
- Settings.

### Group B: Financial and bulk operations

- Transaction editing.
- Bulk categorization.
- AI transaction review.
- Duplicate resolution.
- Transaction imports.
- Tax assignments.
- Tax exports.
- Tax workbook templates.
- Plaid connection and reconnection.
- Stripe top-ups.

### Preservation requirements

Do not change:

- Form field names.
- Default values.
- Validation behavior.
- Request payloads.
- Action arguments.
- Mutation order.
- Refresh behavior.
- Confirmation requirements.
- File-download behavior.
- Error interpretation.
- Optimistic-update semantics.

Existing forms and controls may be wrapped or restyled, but their operational logic must not be reimplemented.

### Exit gate

For every write workflow, the same input produces the same request, mutation, and resulting state in both interfaces.

## Phase 7: Authentication, edge states, and accessibility

**Implementation status:** Complete (2026-08-02)

### Scope

- Login.
- Signup.
- Plaid OAuth resume presentation.
- Loading screens.
- Error screens.
- Empty states.
- Credit exhaustion.
- Unauthorized and unavailable-module states.
- Mobile navigation.
- Keyboard navigation.
- Screen-reader labeling.
- Reduced motion.

### Protected behavior

Do not change:

- Supabase callback handling.
- Redirect destinations.
- `next` query behavior.
- Authentication cookies.
- OAuth code exchange.
- Middleware.
- Tax 404 behavior.
- API 401, 402, 409, or 429 behavior.

### Exit gate

Critical workflows work with keyboard-only navigation and at supported mobile widths without changing authentication or authorization behavior.

## Phase 8: Controlled rollout and cleanup

### Rollout sequence

1. Internal users.
2. AI-first Home only.
3. One module at a time.
4. Small eligible-user cohort.
5. Half of eligible users.
6. Full deployment.

### Rollback

Keep the previous presentation available behind the UI flag until:

- Functional parity is confirmed.
- Error rates remain stable.
- Support issues are resolved.
- Mobile behavior is verified.
- No backend contract differences appear.

### Cleanup

After final acceptance:

- Remove legacy presentation components.
- Remove the UI flag.
- Keep all backend files untouched.
- Keep existing route names and deep links stable.

## 9. Functional parity checklist

### Authentication and access

- Login and signup.
- Logout.
- Session refresh.
- Redirect to the requested page.
- Welcome and reminder query parameters.
- Tax gating.
- Pulse plan limits.
- Unauthorized API behavior.

### Cash and AI

- Streaming conversation.
- Suggested prompts.
- Tool-call display.
- Insufficient-credit state.
- Top-up flow.
- Credit-balance refresh.
- Confirmation-required actions.
- Error recovery.

### Plaid

- New institution connection.
- Additional account connection.
- Update mode.
- OAuth resume.
- Token exchange.
- Initial synchronization.
- Backfill.
- Reconnection.
- Failure states.

### Books

- Accounts.
- Transactions.
- Categories.
- Category rules.
- Entities.
- Imports.
- Duplicate detection.
- AI review.
- Reports.

### Tax

- Feature visibility.
- Assignments.
- Bulk assignments.
- Rules.
- Reports.
- Exports.
- Workbook templates and mappings.

### Cash Flow

- Snapshot.
- Safe-to-spend amount.
- Affordability.
- Recurring items.
- Upcoming obligations.
- Assumptions.

### Trades

- Accounts.
- Trades.
- Sessions.
- Journal.
- Drawdown.
- Performance.

### Pulse

- Events.
- Watchlist.
- Alerts.
- Correlations.
- Plan-dependent limits.

### External agent functionality

- OpenAPI document.
- Agent capability manifest.
- MCP interface.
- Tool-call schemas.
- Confirmation flow.
- Rate limiting.

## 10. Verification after every phase

Run:

```bash
pnpm --filter @cashpile/web test:books
pnpm typecheck
pnpm build
```

Also verify:

- Protected backend paths have no diff.
- Existing route URLs still resolve.
- API methods and payloads are unchanged.
- Server actions receive identical arguments.
- Downloads still produce valid files.
- Mobile screenshots at approximately 375px and 768px.
- Desktop screenshots at approximately 1440px.
- Keyboard navigation and visible focus states.
- Loading, empty, error, and unauthorized states.
- Old and new interfaces display the same underlying values for the same user.

## 11. Per-screen acceptance criteria

Every migrated screen must satisfy all of the following before its UI flag is enabled:

- Existing data is present and accurate.
- Existing actions remain available.
- Existing validations remain intact.
- Existing error states remain understandable.
- Existing URLs and query parameters work.
- Existing entitlement decisions are preserved.
- Loading and empty states are implemented.
- Keyboard access is complete.
- Mobile behavior is verified.
- No protected backend path changed.
- The previous UI can still be restored with the frontend flag.

## 12. Definition of completion

The migration is complete only when:

1. No backend-owned file has changed.
2. No database migration has been added.
3. Every existing user function remains reachable.
4. Every existing mutation produces identical results.
5. Existing route paths remain valid.
6. Authentication and entitlements remain server-authoritative.
7. Plaid, Stripe, AI credits, and Tax exports pass parity testing.
8. The new Home is visibly simpler than the current dashboard.
9. Detailed workflows retain the controls required for serious financial work.
10. The old presentation can be disabled without removing any capability.

## 13. Known pre-existing issue

The Trades landing page currently links to `/trades/metrics`, but no corresponding page was found during the planning audit.

This should be recorded as a pre-existing defect. It must not be silently fixed or folded into the UI migration without separate approval.

## 14. Implementation rule

If a desired UI behavior requires a new API, altered action, new database field, changed entitlement, or new AI tool, that behavior is outside this migration plan.

The implementation must stop at the frontend boundary, document the dependency, and request separate approval before any backend work is considered.
