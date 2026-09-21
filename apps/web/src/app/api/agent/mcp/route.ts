import { NextResponse } from "next/server";
import { getPublicAgentCapabilities } from "@/modules/agent/capabilities";
import { getAgentResources } from "@/modules/agent/executor";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    mcpVersion: "2024-11-05",
    server: { name: "cashpile", title: "Cashpile Agent Server", version: "0.1.0" },
    transport: { type: "https", endpoint: "/api/agent/tools/call" },
    tools: getPublicAgentCapabilities().map((capability) => ({
      name: capability.name,
      description: capability.description,
      inputSchema: capability.inputSchema,
      annotations: {
        title: capability.title,
        module: capability.module,
        kind: capability.kind,
        readOnlyHint: capability.kind === "read" || capability.kind === "export",
        destructiveHint: capability.kind === "write",
        requiresConfirmation: capability.requiresConfirmation,
        requiredScopes: capability.requiredScopes,
      },
    })),
    resources: getAgentResources(),
    prompts: [
      { name: "daily_financial_briefing", description: "Summarize transactions and cash flow into a concise, actionable daily briefing." },
    ],
  });
}
