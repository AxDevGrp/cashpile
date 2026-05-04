import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { createServerSupabaseClient, createServiceRoleClient } from "@cashpile/db";
import type { AgentPrincipal, AgentScope } from "./types";

const ALL_SCOPES: AgentScope[] = [
  "books:read",
  "books:write",
  "trades:read",
  "pulse:read",
  "tax:read",
  "tax:write",
  "billing:read",
];

function parseScopes(value: unknown): AgentScope[] {
  if (!Array.isArray(value)) return [];
  return value.filter((scope): scope is AgentScope => ALL_SCOPES.includes(scope as AgentScope));
}

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

async function authenticateAgentToken(token: string): Promise<AgentPrincipal | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const service = createServiceRoleClient() as any;

  const { data } = await service
    .from("agent_connections")
    .select("id, user_id, agent_name, scopes, status")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return null;
  return {
    userId: data.user_id,
    agentId: data.id,
    agentName: data.agent_name ?? "Connected agent",
    scopes: parseScopes(data.scopes),
    authMethod: "agent_token",
  };
}

async function authenticateSupabaseJwt(token: string): Promise<AgentPrincipal | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    userId: data.user.id,
    agentId: null,
    agentName: "Supabase JWT client",
    scopes: ALL_SCOPES,
    authMethod: "supabase_jwt",
  };
}

async function authenticateSession(): Promise<AgentPrincipal | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    userId: data.user.id,
    agentId: null,
    agentName: "Cashpile web session",
    scopes: ALL_SCOPES,
    authMethod: "session",
  };
}

export async function authenticateAgentRequest(req: NextRequest): Promise<AgentPrincipal | null> {
  const token = bearerToken(req);
  if (token) {
    try {
      const agent = await authenticateAgentToken(token);
      if (agent) return agent;
    } catch (err) {
      // The migration may not be applied yet. Fall through to Supabase JWT auth.
      console.warn("[agent-auth] agent token lookup skipped:", err instanceof Error ? err.message : err);
    }

    return authenticateSupabaseJwt(token);
  }

  return authenticateSession();
}

export function hasScopes(principal: AgentPrincipal, required: AgentScope[]) {
  return required.every((scope) => principal.scopes.includes(scope));
}
