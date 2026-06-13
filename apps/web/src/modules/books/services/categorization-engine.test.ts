import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toReviewSuggestion } from "./ai-review-suggestions.ts";

const category = { id: 12, name: "Software & Subscriptions", category_type: "expense" };

describe("AI categorization review suggestions", () => {
  it("queues AI matches below auto-apply confidence for review", () => {
    const suggestion = toReviewSuggestion(
      { transactionId: "tx_1", confidence: 0.72, method: "ai" },
      category,
      0.85
    );

    assert.deepEqual(suggestion, {
      transactionId: "tx_1",
      categoryId: 12,
      categoryName: "Software & Subscriptions",
      confidence: 0.72,
      method: "ai",
    });
  });

  it("does not queue confident or very low confidence matches", () => {
    assert.equal(
      toReviewSuggestion({ transactionId: "tx_2", confidence: 0.9, method: "ai" }, category, 0.85),
      null
    );
    assert.equal(
      toReviewSuggestion({ transactionId: "tx_3", confidence: 0.3, method: "fallback" }, category, 0.85),
      null
    );
  });
});
