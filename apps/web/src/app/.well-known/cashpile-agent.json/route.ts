import { NextRequest, NextResponse } from "next/server";
import { getPublicAgentCapabilities } from "@/modules/agent/capabilities";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    name: "Cashpile.ai",
    description: "Import finances, clean up transactions with AI, and find practical next steps on your Cashboard.",
    version: "0.1.0",
    agent_api_version: "2026-05-02",
    auth: {
      supported: ["Supabase user JWT bearer", "Cashpile agent token bearer", "web session cookie"],
      scopes: Array.from(new Set(getPublicAgentCapabilities().flatMap((capability) => capability.requiredScopes))).sort(),
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
