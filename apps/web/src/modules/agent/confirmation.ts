import { createHmac, timingSafeEqual } from "crypto";

const VERSION = "v1";

function secret() {
  return process.env.AGENT_CONFIRMATION_SECRET ?? process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-agent-confirmation-secret";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createConfirmationToken(params: {
  userId: string;
  capability: string;
  input: unknown;
  expiresInSeconds?: number;
}) {
  const expiresAt = Math.floor(Date.now() / 1000) + (params.expiresInSeconds ?? 600);
  const payload = Buffer.from(
    JSON.stringify({ v: VERSION, userId: params.userId, capability: params.capability, input: params.input, exp: expiresAt })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyConfirmationToken(token: string, params: { userId: string; capability: string; input: unknown }) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return false;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

  let parsed: any;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (parsed.v !== VERSION || parsed.userId !== params.userId || parsed.capability !== params.capability) return false;
  if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return false;
  return stableStringify(parsed.input) === stableStringify(params.input);
}
