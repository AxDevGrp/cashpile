import assert from "node:assert/strict";
import test from "node:test";

import {
  getHomeActions,
  getHomePriorityInsight,
  shouldRenderAiFirstHome,
} from "./home-model.ts";

test("AI-first Home is hidden for the legacy details view and disabled flag", () => {
  assert.equal(shouldRenderAiFirstHome(true, undefined), true);
  assert.equal(shouldRenderAiFirstHome(true, "details"), false);
  assert.equal(shouldRenderAiFirstHome(false, undefined), false);
});

test("Home actions keep their route order and gate Tax prep", () => {
  assert.deepEqual(getHomeActions(true), [
    { label: "Afford it?", href: "/cashflow" },
    { label: "Subscriptions", href: "/cashflow/recurring" },
    { label: "Tax prep", href: "/books/tax" },
    { label: "Modules", href: "#modules" },
  ]);
  assert.deepEqual(getHomeActions(false), [
    { label: "Afford it?", href: "/cashflow" },
    { label: "Subscriptions", href: "/cashflow/recurring" },
    { label: "Review books", href: "/books" },
    { label: "Modules", href: "#modules" },
  ]);
});

test("Home insight maps the ranked top reminder or a calm default", () => {
  assert.deepEqual(
    getHomePriorityInsight({
      id: "tight-cash",
      title: "Cash looks tight",
      body: "Pause extra spending.",
      cta: "Inspect cash flow",
      href: "/cashflow",
      priority: "high",
    }),
    {
      id: "tight-cash",
      severity: "critical",
      title: "Cash looks tight",
      detail: "Pause extra spending.",
      actionLabel: "Inspect cash flow",
      actionHref: "/cashflow",
    },
  );
  assert.deepEqual(getHomePriorityInsight(), {
    id: "all-clear",
    severity: "info",
    title: "Everything looks calm",
    detail: "Cash has no priority chores for you right now.",
    actionLabel: "View dashboard details",
    actionHref: "/cashboard?view=details",
  });
});
