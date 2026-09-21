import assert from "node:assert/strict";
import test from "node:test";

import {
  getPhase7Surface,
  phase7SurfaceIds,
  shouldRenderPhase7Surface,
} from "./phase-7-model.ts";

test("Phase 7 surfaces follow the UI V2 flag", () => {
  assert.equal(shouldRenderPhase7Surface(true), true);
  assert.equal(shouldRenderPhase7Surface(false), false);
});

test("Phase 7 registry retains exact audited surface metadata", () => {
  const expected = [
    ["login", "auth", "Welcome back", "Sign in to continue with Cash."],
    ["signup", "auth", "Create your account", "Start free. No credit card required."],
    ["plaid-oauth", "oauth", "Finishing Plaid Link", "Cash is securely resuming your bank connection."],
    ["unavailable", "unavailable", "Page unavailable", "This page could not be found or is not available to this account."],
    ["dashboard-loading", "loading", "Loading dashboard", "Cash is preparing your financial overview."],
    ["reports-loading", "loading", "Loading reports", "Cash is preparing your reports."],
    ["transactions-loading", "loading", "Loading transactions", "Cash is preparing your transaction workspace."],
    ["correlations-loading", "loading", "Loading correlations", "Cash is comparing market relationships."],
    ["events-loading", "loading", "Loading events", "Cash is gathering recent market events."],
    ["journal-loading", "loading", "Loading journal", "Cash is preparing your trade journal."],
    ["performance-loading", "loading", "Loading performance", "Cash is preparing your trading performance."],
    ["dashboard-error", "error", "Something went wrong loading the dashboard", "Try the dashboard again."],
    ["books-error", "error", "Something went wrong in Books", "Try Books again."],
    ["pulse-error", "error", "Something went wrong in Pulse", "Try Pulse again."],
    ["settings-error", "error", "Something went wrong in Settings", "Try Settings again."],
    ["trades-error", "error", "Something went wrong in Trades", "Try Trades again."],
  ] as const;

  assert.deepEqual(phase7SurfaceIds, expected.map(([id]) => id));
  for (const [id, kind, title, detail] of expected) {
    assert.deepEqual(getPhase7Surface(id), { kind, title, detail });
  }
});
