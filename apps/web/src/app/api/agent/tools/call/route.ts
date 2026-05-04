import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "@/modules/agent/auth";
import { callAgentCapability } from "@/modules/agent/executor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const principal = await authenticateAgentRequest(req);
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; input?: Record<string, unknown>; confirmationToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const result = await callAgentCapability({
    principal,
    name: body.name,
    input: body.input as Record<string, any> | undefined,
    confirmationToken: body.confirmationToken,
    requestId: req.headers.get("x-request-id"),
  });

  const status = result.ok ? 200 : result.requiresConfirmation ? 409 : 400;
  return NextResponse.json(result, { status });
}
