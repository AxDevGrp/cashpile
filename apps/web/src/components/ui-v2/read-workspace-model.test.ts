import assert from "node:assert/strict";
import test from "node:test";
import { getReadWorkspaceDefinition, readWorkspaceIds, shouldRenderReadWorkspace } from "./read-workspace-model.ts";

test("read workspaces respect the UI V2 flag", () => {
  assert.equal(shouldRenderReadWorkspace(true), true);
  assert.equal(shouldRenderReadWorkspace(false), false);
});

test("read workspace definitions retain exact route metadata", () => {
  const expected = [
    ["reports", "/books/reports", "Reports", "Review tax-ready records.", "Help me understand my reports"],
    ["recurring", "/cashflow/recurring?view=details", "Recurring cash flow", "Review detected recurring money.", "What recurring charges should I review?"],
    ["performance", "/trades/performance", "Performance", "Review trading performance.", "Help me understand my trading performance"],
    ["events", "/pulse/events", "Events", "Review recent market events.", "What events should I watch?"],
    ["correlations", "/pulse/correlations", "Correlations", "Compare market relationships.", "Help me understand these correlations"],
    ["accounts", "/books/accounts", "Accounts", "Manage financial accounts.", "What should I review in my accounts?"],
    ["entities", "/books/entities", "Entities", "Organize tax entities.", "What should I review for my entities?"],
  ] as const;
  assert.deepEqual(readWorkspaceIds, expected.map(([id]) => id));
  for (const [id, route, title, detail, cashPrompt] of expected) {
    assert.deepEqual(getReadWorkspaceDefinition(id), { route, title, detail, cashPrompt });
  }
});
