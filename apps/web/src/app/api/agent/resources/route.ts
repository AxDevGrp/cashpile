import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest, hasScopes } from "@/modules/agent/auth";
import { getAgentResources } from "@/modules/agent/executor";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const principal = await authenticateAgentRequest(req);
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resources = getAgentResources().filter((resource) => hasScopes(principal, resource.scopes as any));
  return NextResponse.json({ resources, principal: { agentName: principal.agentName, authMethod: principal.authMethod, scopes: principal.scopes } });
}
