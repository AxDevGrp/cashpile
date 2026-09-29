import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isConsumerEligible } from "./consumer-experience-policy.ts";

const USER = "11111111-1111-1111-1111-111111111111";

describe("consumer experience eligibility", () => {
  it("is disabled without a session", () => {
    assert.equal(isConsumerEligible({ enabled: true, cohorts: [] }, null), false);
    assert.equal(isConsumerEligible({ enabled: true, cohorts: [] }, undefined), false);
  });

  it("is disabled when the flag row is missing or errored", () => {
    assert.equal(isConsumerEligible(null, USER), false);
    assert.equal(isConsumerEligible(undefined, USER), false);
  });

  it("is enabled when the flag is on for everyone", () => {
    assert.equal(isConsumerEligible({ enabled: true, cohorts: [] }, USER), true);
  });

  it("is enabled only for a matching cohort", () => {
    assert.equal(isConsumerEligible({ enabled: false, cohorts: [USER] }, USER), true);
    assert.equal(isConsumerEligible({ enabled: false, cohorts: ["other-user"] }, USER), false);
  });

  it("treats malformed cohorts as disabled", () => {
    assert.equal(isConsumerEligible({ enabled: false, cohorts: null }, USER), false);
    assert.equal(isConsumerEligible({ enabled: false, cohorts: "user" }, USER), false);
    assert.equal(isConsumerEligible({ enabled: false, cohorts: {} }, USER), false);
  });
});
