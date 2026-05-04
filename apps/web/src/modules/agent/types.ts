export type AgentScope =
  | "books:read"
  | "books:write"
  | "trades:read"
  | "pulse:read"
  | "tax:read"
  | "tax:write"
  | "billing:read";

export type AgentCapabilityKind = "read" | "write" | "export";

export interface AgentCapability {
  name: string;
  title: string;
  description: string;
  module: "books" | "trades" | "pulse" | "tax" | "cashpile";
  kind: AgentCapabilityKind;
  requiredScopes: AgentScope[];
  requiresConfirmation: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  rateLimit: { requests: number; windowSeconds: number };
}

export interface AgentPrincipal {
  userId: string;
  agentId: string | null;
  agentName: string;
  scopes: AgentScope[];
  authMethod: "session" | "supabase_jwt" | "agent_token";
}

export interface AgentCallResult {
  ok: boolean;
  capability: string;
  result?: unknown;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  preview?: unknown;
  error?: string;
}
