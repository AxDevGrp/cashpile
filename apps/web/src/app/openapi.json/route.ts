import { NextRequest, NextResponse } from "next/server";
import { AGENT_CAPABILITIES } from "@/modules/agent/capabilities";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "Cashpile Agent API", version: "2026-05-02" },
    servers: [{ url: origin }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      schemas: {
        AgentToolCall: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", enum: AGENT_CAPABILITIES.map((capability) => capability.name) },
            input: { type: "object", additionalProperties: true },
            confirmationToken: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/api/agent/capabilities": {
        get: { summary: "List Cashpile agent capabilities", responses: { "200": { description: "Capability registry" } } },
      },
      "/api/agent/resources": {
        get: { summary: "List resources available to the authenticated agent", security: [{ bearerAuth: [] }], responses: { "200": { description: "Resources" }, "401": { description: "Unauthorized" } } },
      },
      "/api/agent/tools/call": {
        post: {
          summary: "Call a Cashpile agent capability",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AgentToolCall" } } } },
          responses: { "200": { description: "Executed" }, "409": { description: "Confirmation required" }, "400": { description: "Invalid call" }, "401": { description: "Unauthorized" } },
        },
      },
      "/api/agent/confirmations": {
        post: { summary: "Create a write-action confirmation preview/token", security: [{ bearerAuth: [] }], responses: { "201": { description: "Confirmation preview" }, "401": { description: "Unauthorized" } } },
      },
      "/api/agent/mcp": {
        get: { summary: "Return MCP-style manifest for Cashpile tools/resources/prompts", responses: { "200": { description: "MCP manifest" } } },
      },
    },
  });
}
