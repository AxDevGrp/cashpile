import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAgentCapability, getPublicAgentCapabilities } from "./capabilities.ts";

describe("initial-release agent discovery", () => {
  it("keeps tax capabilities implemented but excludes them from public discovery", () => {
    assert.ok(getAgentCapability("tax.report.generate"));
    assert.equal(getPublicAgentCapabilities().some((capability) => capability.module === "tax"), false);
    assert.equal(/tax|trades|pulse/i.test(JSON.stringify(getPublicAgentCapabilities())), false);
  });
  it("retains transaction cleanup and cash outlook without changing tester schemas", () => {
    const capabilities = getPublicAgentCapabilities();
    assert.ok(capabilities.some((capability) => capability.name === "books.transactions.categorize"));
    assert.ok(capabilities.some((capability) => capability.name === "cashflow.snapshot.get"));
    assert.ok(JSON.stringify(getAgentCapability("books.accounts.list")).includes("taxEntityId"));
  });
});
