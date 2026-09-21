import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash, createSign, createPublicKey, generateKeyPairSync } from "node:crypto";
import { verifyPlaidWebhook } from "./plaid-webhook-verification.ts";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key-1", alg: "ES256" } as Record<string, unknown>;
const fetchJwks = async () => ({ keys: [jwk as never] });

function b64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function derToRaw(der: Buffer): Buffer {
  assert.equal(der[0], 0x30);
  let offset = 2;
  const readInt = (): Buffer => {
    assert.equal(der[offset], 0x02);
    const length = der[offset + 1];
    const bytes = der.subarray(offset + 2, offset + 2 + length);
    offset += 2 + length;
    return bytes;
  };
  const r = readInt();
  const s = readInt();
  const pad = (bytes: Buffer) => {
    const stripped = bytes.length > 1 && bytes[0] === 0 ? bytes.subarray(1) : bytes;
    return Buffer.concat([Buffer.alloc(32 - stripped.length), stripped]);
  };
  return Buffer.concat([pad(r), pad(s)]);
}

function makeToken(body: string, now: number, overrides: { bodyHash?: string; iat?: number } = {}): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: "ES256", kid: "test-key-1" })));
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        iat: overrides.iat ?? Math.floor(now / 1000),
        request_body_sha256: overrides.bodyHash ?? createHash("sha256").update(body, "utf8").digest("hex"),
      }),
    ),
  );
  const signer = createSign("SHA256");
  signer.update(`${header}.${payload}`);
  const derSignature = signer.sign(privateKey);
  return `${header}.${payload}.${b64url(derToRaw(derSignature))}`;
}

describe("plaid webhook signature verification", () => {
  const body = JSON.stringify({ webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: "item_123" });
  const now = Date.parse("2026-09-10T12:00:00Z");

  it("accepts a correctly signed webhook", async () => {
    const result = await verifyPlaidWebhook({
      verificationHeader: makeToken(body, now),
      rawBody: body,
      now,
      fetchJwks,
    });
    assert.deepEqual(result, { valid: true });
  });

  it("rejects when the header is missing or malformed", async () => {
    const missing = await verifyPlaidWebhook({ verificationHeader: null, rawBody: body, now, fetchJwks });
    assert.equal(missing.valid, false);
    const malformed = await verifyPlaidWebhook({ verificationHeader: "not-a-jwt", rawBody: body, now, fetchJwks });
    assert.equal(malformed.valid, false);
  });

  it("rejects a token signed for a different body", async () => {
    const result = await verifyPlaidWebhook({
      verificationHeader: makeToken(body, now),
      rawBody: JSON.stringify({ item_id: "item_evil", webhook_type: "ITEM", webhook_code: "ERROR" }),
      now,
      fetchJwks,
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, "request body does not match the signed token");
  });

  it("rejects a tampered signature", async () => {
    const token = makeToken(body, now);
    const parts = token.split(".");
    const tampered = Buffer.from(parts[2], "base64url");
    tampered[10] = tampered[10] ^ 0xff;
    const result = await verifyPlaidWebhook({
      verificationHeader: `${parts[0]}.${parts[1]}.${b64url(tampered)}`,
      rawBody: body,
      now,
      fetchJwks,
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, "signature does not match");
  });

  it("rejects stale or future-issued tokens", async () => {
    const stale = await verifyPlaidWebhook({
      verificationHeader: makeToken(body, now, { iat: Math.floor(now / 1000) - 600 }),
      rawBody: body,
      now,
      fetchJwks,
    });
    assert.equal(stale.valid, false);
    assert.equal(stale.reason, "token expired or issued too far in the future");

    const future = await verifyPlaidWebhook({
      verificationHeader: makeToken(body, now, { iat: Math.floor(now / 1000) + 600 }),
      rawBody: body,
      now,
      fetchJwks,
    });
    assert.equal(future.valid, false);
  });

  it("rejects tokens from an unknown key", async () => {
    const otherPair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const otherJwk = { ...otherPair.publicKey.export({ format: "jwk" }), kid: "other-key", alg: "ES256" };
    const result = await verifyPlaidWebhook({
      verificationHeader: makeToken(body, now),
      rawBody: body,
      now,
      fetchJwks: async () => ({ keys: [otherJwk as never] }),
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, "unknown signing key");
  });
});