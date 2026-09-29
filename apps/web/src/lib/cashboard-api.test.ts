import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleCashboardSnapshot } from "./cashboard-api.ts";

const snapshot = { version: 1, asOf: "2026-09-28T15:00:00.000Z" } as any;

describe("cashboard snapshot handler", () => {
  it("rejects an unauthenticated caller with 401", async () => {
    const res = await handleCashboardSnapshot({
      getUserId: async () => null,
      loadSnapshot: async () => snapshot,
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers["Cache-Control"], "private, no-store");
  });

  it("returns the snapshot for the session owner with no-store", async () => {
    let seen: string | null = null;
    const res = await handleCashboardSnapshot({
      getUserId: async () => "user-1",
      loadSnapshot: async (userId) => {
        seen = userId;
        return snapshot;
      },
    });
    assert.equal(res.status, 200);
    assert.equal(seen, "user-1");
    assert.deepEqual(res.body, snapshot);
    assert.equal(res.headers["Cache-Control"], "private, no-store");
  });

  it("returns 503 instead of a fabricated snapshot when the loader fails", async () => {
    const res = await handleCashboardSnapshot({
      getUserId: async () => "user-1",
      loadSnapshot: async () => {
        throw new Error("db down");
      },
    });
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { error: { code: "snapshot_unavailable" } });
  });
});
