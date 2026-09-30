import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("./consumer-review-client.tsx", import.meta.url), "utf8");

describe("consumer review category preservation", () => {
  it("resets form state by transaction and keeps the existing category selected", () => {
    assert.match(source, /setCategoryId\(item\?\.categoryId \?\? null\);/);
    assert.match(source, /\}, \[item\?\.transactionId\]\);/);
    assert.match(source, /Keep current category/);
  });
});
