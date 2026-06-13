import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCategoryRuleMatch, transactionMatchesTaxRule } from "./rule-matching.ts";

describe("account-scoped category rules", () => {
  const categories = [{ id: 1, name: "Software & Subscriptions", category_type: "expense" }];

  it("matches scoped rules only within the matching account", () => {
    const rule = {
      id: "rule_1",
      pattern: "ANTHROPIC",
      match_type: "contains" as const,
      category_id: 1,
      priority: 100,
      financial_account_id: "acct_blue",
    };

    const matching = getCategoryRuleMatch(
      {
        id: "tx_1",
        description: "ANTHROPIC CLAUDE",
        financial_account_id: "acct_blue",
      },
      [rule],
      categories
    );

    const otherAccount = getCategoryRuleMatch(
      {
        id: "tx_2",
        description: "ANTHROPIC CLAUDE",
        financial_account_id: "acct_plum",
      },
      [rule],
      categories
    );

    assert.equal(matching?.categoryName, "Software & Subscriptions");
    assert.equal(otherAccount, null);
  });

  it("still allows global rules to match any account", () => {
    const rule = {
      id: "rule_2",
      pattern: "OPENAI",
      match_type: "contains" as const,
      category_id: 1,
      priority: 80,
      financial_account_id: null,
    };

    const match = getCategoryRuleMatch(
      {
        id: "tx_3",
        description: "OPENAI API",
        financial_account_id: "acct_any",
      },
      [rule],
      categories
    );

    assert.equal(match?.categoryName, "Software & Subscriptions");
  });
});

describe("account-scoped tax assignment rules", () => {
  const rule = {
    id: "tax_rule_1",
    user_id: "user_1",
    pattern: "LOWES",
    match_type: "contains" as const,
    tax_entity_id: "rental_1",
    business_percentage: 100,
    deduction_percentage: 100,
    is_active: true,
    priority: 100,
    financial_account_id: "acct_rental_card",
  };

  it("matches scoped tax rules only within the matching account", () => {
    assert.equal(
      transactionMatchesTaxRule(
        {
          description: "LOWES HOME IMPROVEMENT",
          financial_account_id: "acct_rental_card",
        },
        rule
      ),
      true
    );

    assert.equal(
      transactionMatchesTaxRule(
        {
          description: "LOWES HOME IMPROVEMENT",
          financial_account_id: "acct_personal_card",
        },
        rule
      ),
      false
    );
  });
});
