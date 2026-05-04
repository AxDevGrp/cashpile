import { createServiceRoleClient } from "@cashpile/db";
import type { AgentPrincipal } from "./types";

export async function auditAgentCall(params: {
  principal: AgentPrincipal;
  capability: string;
  kind: string;
  status: "preview" | "success" | "error";
  input: unknown;
  result?: unknown;
  error?: string;
  requestId?: string | null;
}) {
  const payload = {
    user_id: params.principal.userId,
    agent_connection_id: params.principal.agentId,
    agent_name: params.principal.agentName,
    capability: params.capability,
    kind: params.kind,
    status: params.status,
    request_id: params.requestId,
    input: params.input,
    result: params.result ?? null,
    error: params.error ?? null,
  };

  try {
    await (createServiceRoleClient() as any).from("agent_audit_logs").insert(payload);
  } catch {
    console.info("[agent-audit]", JSON.stringify(payload));
  }
}
