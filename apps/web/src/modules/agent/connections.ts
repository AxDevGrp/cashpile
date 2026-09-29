import { createHash, randomBytes } from "crypto";
import { z } from "zod";

export const CONSUMER_AGENT_SCOPE = "cashboard:read";
export const MAX_ACTIVE_CONNECTIONS = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const connectionNameSchema = z.string().trim().min(1).max(80);
export const createConnectionSchema = z.object({ name: connectionNameSchema }).strict();

export interface AgentConnectionView {
  id: string;
  name: string;
  scopes: string[];
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export class ConnectionError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "ConnectionError";
    this.code = code;
    this.status = status;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newConnectionToken(): string {
  return randomBytes(32).toString("hex");
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const RPC_CODE_STATUS: Record<string, number> = {
  invalid_input: 400,
  not_found: 404,
  limit_reached: 409,
  forbidden: 403,
};

/** Translate a security-definer RPC failure code into a mapped ConnectionError. */
export function mapConnectionError(err: unknown): ConnectionError {
  if (err instanceof ConnectionError) return err;
  const raw = err && typeof err === "object" && "message" in err ? String((err as any).message) : "";
  const code = raw.trim();
  if (code in RPC_CODE_STATUS) return new ConnectionError(code, RPC_CODE_STATUS[code]);
  return new ConnectionError("unavailable", 503);
}

export function parseConnection(row: any): AgentConnectionView {
  return {
    id: row.id,
    name: row.agent_name ?? "",
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    status: row.status ?? "active",
    createdAt: row.created_at ?? null,
    lastUsedAt: row.last_used_at ?? null,
  };
}

export async function listConnections(supabase: any): Promise<AgentConnectionView[]> {
  const { data, error } = await supabase
    .from("agent_connections")
    .select("id, agent_name, scopes, status, created_at, last_used_at")
    .order("created_at", { ascending: false });
  if (error) throw new ConnectionError("unavailable", 503);
  return (data ?? []).map(parseConnection);
}

/**
 * Creates a connection. Generates the token here, stores only its SHA-256 hash
 * via a narrowly scoped RPC, and returns the plaintext exactly once.
 */
export async function createConnection(
  supabase: any,
  name: unknown
): Promise<{ connection: AgentConnectionView; token: string }> {
  const parsed = createConnectionSchema.safeParse({ name });
  if (!parsed.success) throw new ConnectionError("invalid_input", 400);

  const token = newConnectionToken();
  const { data, error } = await supabase.rpc("consumer_create_agent", {
    p_name: parsed.data.name,
    p_token_hash: hashToken(token),
  });
  if (error) throw mapConnectionError(error);

  return {
    connection: {
      id: String(data),
      name: parsed.data.name,
      scopes: [CONSUMER_AGENT_SCOPE],
      status: "active",
      createdAt: null,
      lastUsedAt: null,
    },
    token,
  };
}

export async function revokeConnection(supabase: any, id: unknown): Promise<void> {
  if (!isUuid(id)) throw new ConnectionError("invalid_input", 400);
  const { error } = await supabase.rpc("consumer_revoke_agent", { p_id: id });
  if (error) throw mapConnectionError(error);
}
