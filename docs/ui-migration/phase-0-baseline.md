# Phase 0 UI migration baseline

Captured: 2026-07-31. This baseline supports a frontend-only migration; it does not assert backend behavior through live calls.

## Critical route inventory

The machine-readable route inventory is [`scripts/ui-migration/critical-routes.json`](../../scripts/ui-migration/critical-routes.json). It covers the current marketing, authentication, Plaid OAuth, Cashboard/AI/settings, Cash Flow, Books, Trades, and Pulse page routes, including the dynamic `/books/accounts/[accountId]/transactions` deep link.

`/trades/metrics` is intentionally recorded as `pre-existing-missing`. It is a known missing deep link, not a route to add or repair during this migration. The validator fails if any required route disappears or if that documented exception becomes present without updating the baseline deliberately.

## Protected contract areas

The content-hash guard covers these backend-owned paths:

- `apps/web/src/app/api/**`
- `apps/web/src/modules/**`
- `apps/web/src/lib/plaid*`
- `apps/web/src/lib/tax-access.ts`
- `apps/web/src/middleware.ts`
- `packages/ai/**`
- `packages/db/**`

It hashes every currently present protected file, including untracked files. It excludes generated/dependency artifacts (`node_modules`, `.next`, `.turbo`, `dist`, `coverage`, and `*.tsbuildinfo`) so normal build output does not invalidate the baseline. The stored manifest contains only relative paths and SHA-256 hashes, never file contents.

## User journeys and acceptance checks

Before and after each UI-only migration increment, preserve and verify:

1. Logged-out app routes redirect to login; the auth callback returns to `/cashboard?gremmy=welcome`.
2. Tax-disabled users cannot access Tax pages or Tax APIs.
3. Pulse plan limits remain entitlement-driven.
4. AI credit exhaustion remains HTTP 402; agent confirmation remains HTTP 409; agent rate limiting remains HTTP 429.
5. Plaid creation, update, OAuth resume, exchange, sync, and backfill remain functional.
6. Stripe top-ups remain webhook-authoritative.
7. Every required route in the route manifest remains reachable; `/trades/metrics` remains the documented pre-existing exception.

## Current test gaps

This repository baseline has unit coverage for the new filesystem guard and route-manifest validator only. It has no Phase 0 browser smoke suite, screenshots, live backend contract tests, or verified coverage percentage. Those checks remain manual or require a separately approved test environment; no coverage claim is made here.

An authenticated read-only browser smoke check was completed against the local development server on July 31, 2026. The public landing page and authenticated `/cashboard` rendered successfully. Screenshots were intentionally not persisted because the available authenticated session contained live financial data. Capture desktop and mobile reference screenshots only with a seeded, non-production account.

An unauthenticated HTTP smoke check also confirmed:

```text
GET /cashboard -> 307 Location: /login?next=%2Fcashboard
GET /          -> 200
```

A migration-specific GitHub workflow is deferred: this baseline is captured from an already dirty working tree, so a committed CI baseline would not safely represent the repository state. Add CI only after a clean, reviewed baseline is captured.

## Local commands

```sh
pnpm ui-migration:test
pnpm ui-migration:guard:capture
pnpm ui-migration:guard:check
pnpm ui-migration:routes
```

Run `ui-migration:guard:capture` only when deliberately resetting the approved baseline. Use `ui-migration:guard:check` before and after UI work. The check detects added, deleted, and content-modified protected files.

## Dirty-worktree caveat

The manifest deliberately represents the protected files as they existed in the working tree at capture time, including pre-existing tracked edits and untracked protected files. It is not a clean-HEAD comparison and must not be used to erase, stage, or normalize unrelated worktree changes.
