import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ConnectionError,
  connectionNameSchema,
  createConnection,
  createConnectionSchema,
  hashToken,
  isUuid,
  listConnections,
  mapConnectionError,
  newConnectionToken,
  parseConnection,
  revokeConnection,
} from "./connections.ts";

describe("token handling", () => {
  it("hashes to a 64-char lowercase hex digest and never returns plaintext", () => {
    const token = newConnectionToken();
    const digest = hashToken(token);
    assert.equal(digest.length, 64);
    assert.equal(/^[0-9a-f]{64}$/.test(digest), true);
    assert.notEqual(digest, token);
  });

  it("generates random distinct tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newConnectionToken()));
    assert.equal(tokens.size, 50);
    assert.equal([...tokens].every((t) => /^[0-9a-f]{64}$/.test(t)), true);
  });
});

describe("name validation", () => {
  it("trims and bounds the name, rejects extras and missing", () => {
    assert.equal(connectionNameSchema.safeParse("  My agent  ").success, true);
    assert.deepEqual(createConnectionSchema.parse({ name: " My agent " }), { name: "My agent" });
    assert.equal(createConnectionSchema.safeParse({ name: "" }).success, false);
    assert.equal(createConnectionSchema.safeParse({ name: "x".repeat(81) }).success, false);
    assert.equal(createConnectionSchema.safeParse({ name: "ok", scopes: ["books:read"] }).success, false);
    assert.equal(createConnectionSchema.safeParse({}).success, false);
  });
});

describe("error mapping", () => {
  it("maps RPC failure codes to statuses and unknown to 503", () => {
    assert.deepEqual(mapConnectionError({ message: "not_found" }), new ConnectionError("not_found", 404));
    assert.equal(mapConnectionError({ message: "limit_reached" }).status, 409);
    assert.equal(mapConnectionError({ message: "invalid_input" }).status, 400);
    assert.equal(mapConnectionError(new Error("boom")).status, 503);
    assert.equal(mapConnectionError(null).code, "unavailable");
  });
});

describe("uuid + row parsing", () => {
  it("accepts only canonical uuids", () => {
    assert.equal(isUuid("11111111-1111-1111-1111-111111111111"), true);
    assert.equal(isUuid("not-a-uuid"), false);
    assert.equal(isUuid(42), false);
  });

  it("maps a DB row and never exposes a token hash", () => {
    const view = parseConnection({
      id: "abc",
      agent_name: "Assistant",
      scopes: ["cashboard:read"],
      status: "active",
      created_at: "2026-09-29T00:00:00Z",
      last_used_at: null,
      token_hash: "should-not-leak",
    });
    assert.deepEqual(view, {
      id: "abc",
      name: "Assistant",
      scopes: ["cashboard:read"],
      status: "active",
      createdAt: "2026-09-29T00:00:00Z",
      lastUsedAt: null,
    });
    assert.equal(JSON.stringify(view).includes("should-not-leak"), false);
  });
});

function listClient(result: unknown) {
  return { from: () => ({ select: () => ({ order: async () => result }) }) };
}

function rpcClient(result: unknown, sink?: (name: string, args: unknown) => void) {
  return {
    rpc: async (name: string, args: unknown) => {
      sink?.(name, args);
      return result;
    },
  };
}

describe("list/create/revoke service glue", () => {
  it("lists owned rows and fails closed to 503", async () => {
    const rows = [{ id: "a", agent_name: "A", scopes: ["cashboard:read"], status: "active" }];
    const out = await listConnections(listClient({ data: rows, error: null }));
    assert.equal(out.length, 1);
    assert.equal(out[0].name, "A");
    await assert.rejects(() => listConnections(listClient({ data: null, error: { message: "nope" } })), (err: unknown) => {
      assert.ok(err instanceof ConnectionError);
      assert.equal(err.status, 503);
      return true;
    });
  });

  it("creates via RPC with a 64-hex hash and returns the plaintext once", async () => {
    let captured: any;
    const out = await createConnection(
      rpcClient({ data: "11111111-1111-1111-1111-111111111111", error: null }, (name, args) => {
        captured = { name, args };
      }),
      "  My agent  "
    );
    assert.equal(captured.name, "consumer_create_agent");
    assert.equal(captured.args.p_name, "My agent");
    assert.equal(captured.args.p_token_hash, hashToken(out.token));
    assert.equal(out.connection.scopes[0], "cashboard:read");
    assert.equal(out.connection.id, "11111111-1111-1111-1111-111111111111");
  });

  it("rejects an invalid name before any RPC and maps RPC failures", async () => {
    let calls = 0;
    await assert.rejects(
      () => createConnection(rpcClient({ data: null, error: null }, () => { calls += 1; }), "x".repeat(81)),
      (err: unknown) => err instanceof ConnectionError && err.status === 400
    );
    assert.equal(calls, 0);

    await assert.rejects(
      () => createConnection(rpcClient({ data: null, error: { message: "limit_reached" } }), "ok"),
      (err: unknown) => err instanceof ConnectionError && err.code === "limit_reached" && err.status === 409
    );
  });

  it("revokes a valid uuid and rejects a malformed one locally", async () => {
    let called = "";
    await revokeConnection(
      rpcClient({ data: null, error: null }, (name) => { called = name; }),
      "11111111-1111-1111-1111-111111111111"
    );
    assert.equal(called, "consumer_revoke_agent");

    await assert.rejects(
      () => revokeConnection(rpcClient({ data: null, error: null }), "not-a-uuid"),
      (err: unknown) => err instanceof ConnectionError && err.status === 400
    );
  });
});
