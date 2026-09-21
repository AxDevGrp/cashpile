import { createHash, createPublicKey, createVerify, type JsonWebKey } from "node:crypto";

const JWKS_URL = "https://plaid.com/.well-known/plaid-verification.jwks";
const JWKS_TTL_MS = 5 * 60_000;
const IAT_TOLERANCE_SECONDS = 300;

export interface PlaidVerificationResult {
  valid: boolean;
  reason?: string;
}

interface Jwks {
  keys: JsonWebKey[];
}

let jwksCache: { jwks: Jwks; fetchedAt: number } | null = null;

async function defaultFetchJwks(): Promise<Jwks> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.jwks;
  const response = await fetch(JWKS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`failed to load Plaid JWKS (${response.status})`);
  const jwks = (await response.json()) as Jwks;
  jwksCache = { jwks, fetchedAt: Date.now() };
  return jwks;
}

export function resetPlaidJwksCache() {
  jwksCache = null;
}

function b64urlToJson<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

/** Convert a raw P-256 ECDSA signature (r||s, 32 bytes each) to DER encoding. */
function rawSignatureToDer(raw: Buffer): Buffer {
  if (raw.length !== 64) throw new Error("unexpected ECDSA signature length");

  const toDerInt = (half: Buffer): Buffer => {
    let start = 0;
    while (start < half.length - 1 && half[start] === 0) start++;
    let bytes = half.subarray(start);
    if (bytes.length > 0 && (bytes[0] & 0x80) !== 0) bytes = Buffer.concat([Buffer.from([0x00]), bytes]);
    return Buffer.concat([Buffer.from([0x02, bytes.length]), bytes]);
  };

  const content = Buffer.concat([toDerInt(raw.subarray(0, 32)), toDerInt(raw.subarray(32))]);
  return Buffer.concat([Buffer.from([0x30, content.length]), content]);
}

export async function verifyPlaidWebhook(args: {
  verificationHeader: string | null;
  rawBody: string;
  now?: number;
  fetchJwks?: () => Promise<Jwks>;
}): Promise<PlaidVerificationResult> {
  const { verificationHeader, rawBody } = args;
  if (!verificationHeader) return { valid: false, reason: "missing plaid-verification header" };

  const [headerB64, payloadB64, signatureB64] = verificationHeader.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return { valid: false, reason: "malformed verification token" };

  let header: { alg?: string; kid?: string };
  let payload: { iat?: unknown; request_body_sha256?: unknown };
  try {
    header = b64urlToJson(headerB64);
    payload = b64urlToJson(payloadB64);
  } catch {
    return { valid: false, reason: "verification token is not valid JSON" };
  }
  if (header.alg !== "ES256") return { valid: false, reason: "unexpected token algorithm" };

  const jwks = await (args.fetchJwks ?? defaultFetchJwks)();
  const jwk = jwks.keys.find((key) => (key as { kid?: string }).kid === header.kid);
  if (!jwk) return { valid: false, reason: "unknown signing key" };

  let signatureValid = false;
  try {
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    signatureValid = createVerify("SHA256")
      .update(`${headerB64}.${payloadB64}`)
      .verify(publicKey, rawSignatureToDer(Buffer.from(signatureB64, "base64url")));
  } catch {
    return { valid: false, reason: "signature verification failed" };
  }
  if (!signatureValid) return { valid: false, reason: "signature does not match" };

  const nowSeconds = Math.floor((args.now ?? Date.now()) / 1000);
  if (typeof payload.iat !== "number" || Math.abs(nowSeconds - payload.iat) > IAT_TOLERANCE_SECONDS) {
    return { valid: false, reason: "token expired or issued too far in the future" };
  }

  const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  if (payload.request_body_sha256 !== bodyHash) {
    return { valid: false, reason: "request body does not match the signed token" };
  }

  return { valid: true };
}