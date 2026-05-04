import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "@/modules/agent/auth";
import { callAgentCapability } from "@/modules/agent/executor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const principal = await authenticateAgentRequest(req);
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const result = await callAgentCapability({
    principal,
    name: body.name,
    input: body.input ?? {},
    requestId: req.headers.get("x-request-id"),
  });

  if (!result.requiresConfirmation) {
    return NextResponse.json({ error: "Capability does not require confirmation or could not be previewed", result }, { status: 400 });
  }

  return NextResponse.json(result, { status: 201 });
}
