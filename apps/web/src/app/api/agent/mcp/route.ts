import { NextResponse } from "next/server";
import { AGENT_CAPABILITIES } from "@/modules/agent/capabilities";
import { getAgentResources } from "@/modules/agent/executor";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    mcpVersion: "2024-11-05",
    server: { name: "cashpile", title: "Cashpile Agent Server", version: "0.1.0" },
    transport: { type: "https", endpoint: "/api/agent/tools/call" },
    tools: AGENT_CAPABILITIES.map((capability) => ({
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
      { name: "daily_financial_briefing", description: "Summarize Books, Trades, and Pulse into a concise daily briefing." },
      { name: "tax_prep_review", description: "Review tax assignments and missing categorization for a tax year." },
      { name: "trading_risk_review", description: "Review drawdown, breach risk, and recent performance." },
    ],
  });
}
