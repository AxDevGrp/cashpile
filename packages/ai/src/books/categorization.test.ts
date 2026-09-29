import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categorizeTransactionsWith,
  type CategorizationResult,
  type Category,
  type TransactionForCategorization,
} from "./categorization.ts";

const categories: Category[] = [
  { id: 1, name: "Groceries" },
  { id: 2, name: "Other" },
];

// None of these match the rule patterns, so every row needs the AI pass.
function unmatched(count: number): TransactionForCategorization[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `tx_${i + 1}`,
    description: `Unknown merchant ${i + 1}`,
    amount: -10,
  }));
}

describe("batch categorization fallback", () => {
  it("keeps one unique output per row when a later batch fails", async () => {
    let calls = 0;
    const categorizeBatch = async (batch: TransactionForCategorization[]): Promise<CategorizationResult[]> => {
      calls += 1;
      if (calls === 2) throw new Error("batch two unavailable");
      return batch.map((tx) => ({
        transactionId: tx.id,
        categoryName: "Groceries",
        confidence: 0.95,
        method: "ai" as const,
      }));
    };

    const results = await categorizeTransactionsWith(unmatched(21), categories, categorizeBatch);

    assert.equal(results.length, 21);
    assert.equal(new Set(results.map((r) => r.transactionId)).size, 21);

    // First batch resolved by AI, exactly one fallback for the failed batch row.
    assert.equal(results.filter((r) => r.method === "ai").length, 20);
    assert.equal(results.filter((r) => r.method === "fallback").length, 1);
  });
});
