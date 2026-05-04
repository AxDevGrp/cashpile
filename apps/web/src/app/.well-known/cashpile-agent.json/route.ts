import { NextRequest, NextResponse } from "next/server";
import { AGENT_CAPABILITIES } from "@/modules/agent/capabilities";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    name: "Cashpile.ai",
    description: "Agent-ready financial platform for Books, Trades, Pulse, tax workflows, and AI briefings.",
    version: "0.1.0",
    agent_api_version: "2026-05-02",
    auth: {
      supported: ["Supabase user JWT bearer", "Cashpile agent token bearer", "web session cookie"],
      scopes: Array.from(new Set(AGENT_CAPABILITIES.flatMap((capability) => capability.requiredScopes))).sort(),
    },
    endpoints: {
      capabilities: `${origin}/api/agent/capabilities`,
      tools: `${origin}/api/agent/tools/call`,
      confirmations: `${origin}/api/agent/confirmations`,
      resources: `${origin}/api/agent/resources`,
      mcp_manifest: `${origin}/api/agent/mcp`,
      openapi: `${origin}/openapi.json`,
      llms: `${origin}/llms.txt`,
    },
    safety: {
      write_actions_require_confirmation: true,
      audit_logged: true,
      user_scoped_data: true,
    },
  });
}
