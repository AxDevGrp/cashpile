import assert from "node:assert/strict";
import test from "node:test";
import { getWriteWorkflow, shouldRenderWriteWorkflow, writeWorkflowIds } from "./write-workflow-model.ts";

test("write workflows respect the UI V2 flag", () => {
  assert.equal(shouldRenderWriteWorkflow(true), true);
  assert.equal(shouldRenderWriteWorkflow(false), false);
});

test("write workflow registry preserves every planned surface and risk group", () => {
  const expected = [
    ["accounts", "/books/accounts", "A", "Help me review these accounts"],
    ["account-new", "/books/accounts/new", "A", "Help me add an account"],
    ["entities", "/books/entities", "A", "Help me review these entities"],
    ["entity-new", "/books/entities/new", "A", "Help me add an entity"],
    ["category-rules", "/books/category-rules", "A", "Help me set up category rules"],
    ["trade-accounts", "/trades/accounts", "A", "Help me review trade accounts"],
    ["trade-account-new", "/trades/accounts/new", "A", "Help me add a trade account"],
    ["journal", "/trades/journal", "A", "Help me review my trade journal"],
    ["journal-new", "/trades/journal/new", "A", "Help me log this trade"],
    ["alerts", "/pulse/alerts", "A", "Help me review these alerts"],
    ["watchlist", "/pulse/watchlist", "A", "Help me review my watchlist"],
    ["settings", "/settings", "A", "Help me understand these settings"],
    ["transactions", "/books/transactions", "B", "Help me review these transactions"],
    ["account-transactions", "/books/accounts/[accountId]/transactions", "B", "Help me review this account"],
    ["ai-review", "/books/transactions/ai-review", "B", "Help me review these suggestions"],
    ["duplicates", "/books/transactions/duplicates", "B", "Help me review possible duplicates"],
    ["import", "/books/transactions/import", "B", "Help me import transactions"],
    ["tax-details", "/books/tax?view=details", "B", "Help me review this tax workspace"],
    ["plaid", "embedded-plaid", "B", "Help me connect an account"],
    ["topup", "embedded-stripe-topup", "B", "Help me understand AI credits"],
  ] as const;

  assert.deepEqual(writeWorkflowIds, expected.map(([id]) => id));
  for (const [id, route, riskGroup, cashPrompt] of expected) {
    assert.deepEqual(getWriteWorkflow(id), { route, riskGroup, cashPrompt });
  }
});
