import { NextRequest } from "next/server";
import { AGENT_CAPABILITIES } from "@/modules/agent/capabilities";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const body = `# Cashpile.ai

Cashpile.ai is an AI-first financial platform combining Books (accounting), Trades (prop trading), and Pulse (market intelligence).

## Agent integration

- Capability registry: ${origin}/api/agent/capabilities
- Agent tool call endpoint: ${origin}/api/agent/tools/call
- Agent resources: ${origin}/api/agent/resources
- MCP-style manifest: ${origin}/api/agent/mcp
- Agent discovery: ${origin}/.well-known/cashpile-agent.json
- OpenAPI: ${origin}/openapi.json

## Safety rules

Agents must request user confirmation before write operations. Cashpile enforces server-side confirmation tokens for write capabilities and logs agent calls.

## Capabilities

${AGENT_CAPABILITIES.map((capability) => `- ${capability.name}: ${capability.description} Scopes: ${capability.requiredScopes.join(", ")}.`).join("\n")}
`;

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
