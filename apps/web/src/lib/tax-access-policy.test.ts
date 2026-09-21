import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTaxTestingAllowed, isTaxTestingPath } from "./tax-access-policy.ts";

describe("tax testing access", () => {
  const tester = { email: "tester@example.com", email_confirmed_at: "2026-09-09" };
  it("denies access by default and to signed-out or ordinary users", () => {
    assert.equal(isTaxTestingAllowed(tester, undefined), false);
    assert.equal(isTaxTestingAllowed(null, "tester@example.com"), false);
    assert.equal(isTaxTestingAllowed(tester, "other@example.com"), false);
  });
  it("requires a confirmed email and an exact allowlist match", () => {
    assert.equal(isTaxTestingAllowed({ email: tester.email }, tester.email), false);
    assert.equal(isTaxTestingAllowed(tester, "other-tester@example.com"), false);
    assert.equal(isTaxTestingAllowed(tester, "*"), false);
    assert.equal(isTaxTestingAllowed(tester, "other@example.com, TESTER@example.com "), true);
  });
  it("covers tax pages, nested exports, entities, and legacy reports without blocking cleanup", () => {
    for (const path of ["/books/tax", "/books/entities/new", "/books/reports", "/api/tax/export", "/api/tax/workbook-templates/id/export"]) {
      assert.equal(isTaxTestingPath(path), true, path);
    }
    for (const path of ["/books/transactions", "/books/transactions/import", "/books/transactions/ai-review", "/books/accounts", "/cashboard", "/api/books/transactions", "/api/taxonomy"]) {
      assert.equal(isTaxTestingPath(path), false, path);
    }
  });
});
